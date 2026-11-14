"""
Transport and queue lifecycle service for the remote/local GPU Vision pull worker.

Handles:
- Constant-time Bearer token verification (separate from staff auth & CSRF)
- Worker heartbeat persistence (DB-backed for multi-worker Gunicorn safety)
- Stale lease reclamation after VISION_LEASE_SECONDS
- Atomic 1-item claim with select_for_update(skip_locked=True)
- Safe completion/error handling & AIDescriptionBatchJob progress synchronization
- Enqueueing bulk and single-item catalog name/description jobs without blocking Gunicorn
"""

import base64
import hmac
import logging
import uuid
from datetime import timedelta
from typing import Any, Dict, List, Optional, Tuple

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .ai_service import get_vision_worker_config, optimize_image_for_ai
from .models import AIDescriptionBatchJob, Item, Store, VisionWorkerStatus
from .vision_prompts import (
    build_catalog_vision_messages,
    parse_vision_model_output,
    strip_invented_pack_quantity,
    verify_spec_tokens_preserved,
)

logger = logging.getLogger(__name__)

WAITING_FOR_WORKER_MSG = "Waiting for local Vision laptop to come online..."


def verify_vision_worker_token(auth_header: str) -> bool:
    """Validates `Authorization: Bearer <token>` against VISION_WORKER_TOKEN."""
    if not auth_header or not isinstance(auth_header, str):
        return False
    parts = auth_header.strip().split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return False
    provided_token = parts[1].strip()
    expected_token = get_vision_worker_config().get("worker_token", "").strip()
    if not expected_token or not provided_token:
        return False
    return hmac.compare_digest(provided_token.encode("utf-8"), expected_token.encode("utf-8"))


def record_worker_heartbeat(worker_id: str, model: str = "") -> VisionWorkerStatus:
    """Persists the latest heartbeat timestamp for a pull worker."""
    cleaned_id = (worker_id or "default-worker").strip()[:120] or "default-worker"
    cleaned_model = (model or "").strip()[:120]
    obj, _ = VisionWorkerStatus.objects.update_or_create(
        worker_id=cleaned_id,
        defaults={
            "last_seen_at": timezone.now(),
            "last_model": cleaned_model,
        },
    )
    return obj


def is_vision_worker_online(max_age_seconds: int = 30) -> bool:
    """Returns True if any pull worker sent a heartbeat within max_age_seconds."""
    latest = VisionWorkerStatus.objects.order_by("-last_seen_at").first()
    if not latest or not latest.last_seen_at:
        return False
    age = (timezone.now() - latest.last_seen_at).total_seconds()
    return age <= max_age_seconds


def sync_batch_job_progress(job: AIDescriptionBatchJob) -> AIDescriptionBatchJob:
    """
    Recalculates AIDescriptionBatchJob counters from current Item states,
    updates completion status when all items finish, and surfaces offline
    worker status when pending items are waiting with no recent heartbeat.
    """
    item_ids = list(job.item_ids or [])
    if not item_ids:
        return job

    items = list(
        Item.objects.filter(id__in=item_ids).only(
            "id",
            "ai_description_status",
            "ai_name_status",
            "vision_job_type",
        )
    )

    completed = 0
    failed = 0
    skipped = 0
    pending_count = 0
    generating_count = 0

    for it in items:
        desc_st = it.ai_description_status
        name_st = it.ai_name_status
        is_name_only = it.vision_job_type == "name_only" and desc_st in ("none", "applied", "ready")

        if desc_st in ("pending", "generating") or name_st in ("pending", "generating"):
            if desc_st == "generating" or name_st == "generating":
                generating_count += 1
            else:
                pending_count += 1

        if is_name_only:
            if name_st in ("ready", "applied"):
                completed += 1
            elif name_st == "failed":
                failed += 1
            elif name_st == "skipped_no_image":
                skipped += 1
        else:
            if desc_st in ("ready", "applied"):
                completed += 1
            elif desc_st == "failed":
                failed += 1
            elif desc_st == "skipped_no_image":
                skipped += 1

    update_fields: List[str] = []
    if job.completed_items != completed:
        job.completed_items = completed
        update_fields.append("completed_items")
    if job.failed_items != failed:
        job.failed_items = failed
        update_fields.append("failed_items")
    if job.skipped_items != skipped:
        job.skipped_items = skipped
        update_fields.append("skipped_items")

    in_progress = pending_count + generating_count
    if job.status == AIDescriptionBatchJob.STATUS_RUNNING:
        if in_progress == 0:
            job.status = AIDescriptionBatchJob.STATUS_COMPLETED
            update_fields.append("status")
            if job.status_message == WAITING_FOR_WORKER_MSG:
                job.status_message = ""
                update_fields.append("status_message")
        else:
            worker_online = is_vision_worker_online(max_age_seconds=30)
            if not worker_online and generating_count == 0 and pending_count > 0:
                if job.status_message != WAITING_FOR_WORKER_MSG:
                    job.status_message = WAITING_FOR_WORKER_MSG
                    update_fields.append("status_message")
            elif (worker_online or generating_count > 0) and job.status_message == WAITING_FOR_WORKER_MSG:
                job.status_message = ""
                update_fields.append("status_message")

    if update_fields:
        update_fields.append("updated_at")
        job.save(update_fields=update_fields)

    return job


def sync_running_batch_jobs(store_id: Optional[int] = None) -> None:
    """Refreshes counters and status for active running batch jobs."""
    qs = AIDescriptionBatchJob.objects.filter(status=AIDescriptionBatchJob.STATUS_RUNNING)
    if store_id is not None:
        qs = qs.filter(store_id=store_id)
    for job in qs:
        sync_batch_job_progress(job)


def reclaim_stale_vision_leases() -> int:
    """
    Finds items stuck in 'generating' beyond `vision_lease_expires_at` and either
    resets them to 'pending' (up to VISION_MAX_RETRIES) or marks them 'failed'.
    """
    config = get_vision_worker_config()
    max_retries = config["max_retries"]
    now = timezone.now()
    reclaimed_count = 0
    affected_store_ids = set()

    with transaction.atomic():
        stale_items = list(
            Item.objects.select_for_update(skip_locked=True)
            .filter(
                vision_lease_expires_at__isnull=False,
                vision_lease_expires_at__lt=now,
            )
            .filter(Q(ai_description_status="generating") | Q(ai_name_status="generating"))
        )

        for item in stale_items:
            if item.store_id:
                affected_store_ids.add(item.store_id)
            update_fields = [
                "vision_lease_expires_at",
                "vision_claimed_at",
                "vision_worker_id",
                "vision_job_id",
                "vision_retry_count",
            ]

            if item.vision_retry_count < max_retries:
                item.vision_retry_count += 1
                if item.ai_description_status == "generating":
                    item.ai_description_status = "pending"
                    update_fields.append("ai_description_status")
                if item.ai_name_status == "generating":
                    item.ai_name_status = "pending"
                    update_fields.append("ai_name_status")
            else:
                err_msg = "Local Vision worker lease expired after maximum retries."
                if item.ai_description_status == "generating":
                    item.ai_description_status = "failed"
                    item.ai_description_error = err_msg
                    update_fields.extend(["ai_description_status", "ai_description_error"])
                if item.ai_name_status == "generating":
                    item.ai_name_status = "failed"
                    item.ai_name_error = err_msg
                    update_fields.extend(["ai_name_status", "ai_name_error"])

            item.vision_lease_expires_at = None
            item.vision_claimed_at = None
            item.vision_worker_id = ""
            item.vision_job_id = ""
            item.save(update_fields=update_fields)
            reclaimed_count += 1

    if reclaimed_count:
        for sid in affected_store_ids:
            sync_running_batch_jobs(store_id=sid)

    return reclaimed_count


def _build_item_prompt_metadata(item: Item) -> Dict[str, Any]:
    cat_name = item.effective_primary_category.name if item.effective_primary_category else ""
    subcat_name = item.effective_primary_subcategory.name if item.effective_primary_subcategory else ""
    variant_names = []
    has_variants = getattr(item, "has_variants", False)
    if has_variants:
        variant_names = list(item.design_variants.values_list("name", flat=True)[:10])

    # Collect all images (up to 3) for multi-image support
    all_images = list(item.images.order_by("order", "id")[:3])
    image_count = len(all_images)
    is_multi_design = has_variants and len(variant_names) > 1

    # Selling unit: derive from stock_quantity context (simple heuristic: always "1 piece" unless name says pack/set)
    selling_unit = ""  # Will be derived from item name spec tokens or left blank

    return {
        "name": item.name,
        "category_name": cat_name,
        "subcategory_name": subcat_name,
        "description": item.description,
        "selling_price": str(item.selling_price),
        "mrp": str(item.mrp) if item.mrp else "",
        "weight": str(item.weight) if item.weight else "",
        "variant_names": variant_names,
        "selling_unit": selling_unit,
        "is_multi_design": is_multi_design,
        "image_count": image_count,
        "_all_images": all_images,  # private key, consumed by claim_next_vision_job
    }


def claim_next_vision_job(worker_id: str) -> Optional[Dict[str, Any]]:
    """
    Records heartbeat, reclaims expired leases, atomically claims 1 pending item
    using select_for_update(skip_locked=True), and returns the worker payload or None.
    """
    config = get_vision_worker_config()
    cleaned_worker_id = (worker_id or "default-worker").strip()[:120] or "default-worker"
    record_worker_heartbeat(cleaned_worker_id, model=config["model"])
    reclaim_stale_vision_leases()

    while True:
        claimed_item: Optional[Item] = None
        effective_type = "name_and_description"
        job_id = ""
        img_bytes: Optional[bytes] = None

        with transaction.atomic():
            item = (
                Item.objects.select_for_update(skip_locked=True)
                .filter(Q(ai_description_status="pending") | Q(ai_name_status="pending"))
                .order_by("updated_at", "id")
                .first()
            )
            if not item:
                sync_running_batch_jobs()
                return None

            primary_img = item.primary_image
            if not primary_img or not primary_img.image:
                update_fields: List[str] = []
                if item.ai_description_status == "pending":
                    item.ai_description_status = "skipped_no_image"
                    item.ai_description_error = "No product image uploaded"
                    update_fields.extend(["ai_description_status", "ai_description_error"])
                if item.ai_name_status == "pending":
                    item.ai_name_status = "skipped_no_image"
                    item.ai_name_error = "No product image uploaded"
                    update_fields.extend(["ai_name_status", "ai_name_error"])
                item.vision_job_id = ""
                item.vision_lease_expires_at = None
                update_fields.extend(["vision_job_id", "vision_lease_expires_at"])
                item.save(update_fields=update_fields)
                sync_running_batch_jobs(store_id=item.store_id)
                continue

            try:
                with primary_img.image.open("rb") as img_file:
                    img_bytes = img_file.read()
            except Exception as file_err:
                err_msg = f"Failed to read image file: {file_err}"
                update_fields = []
                if item.ai_description_status == "pending":
                    item.ai_description_status = "failed"
                    item.ai_description_error = err_msg
                    update_fields.extend(["ai_description_status", "ai_description_error"])
                if item.ai_name_status == "pending":
                    item.ai_name_status = "failed"
                    item.ai_name_error = err_msg
                    update_fields.extend(["ai_name_status", "ai_name_error"])
                item.vision_job_id = ""
                item.vision_lease_expires_at = None
                update_fields.extend(["vision_job_id", "vision_lease_expires_at"])
                item.save(update_fields=update_fields)
                sync_running_batch_jobs(store_id=item.store_id)
                continue

            if item.ai_name_status == "pending" and item.ai_description_status == "pending":
                effective_type = "name_and_description"
            elif item.ai_name_status == "pending":
                effective_type = "name_only"
            elif item.ai_description_status == "pending":
                effective_type = "description_only"
            else:
                effective_type = item.vision_job_type or "name_and_description"

            now = timezone.now()
            job_id = f"{item.id}-{uuid.uuid4().hex[:12]}"
            item.vision_job_id = job_id
            item.vision_job_type = effective_type
            item.vision_worker_id = cleaned_worker_id
            item.vision_claimed_at = now
            item.vision_lease_expires_at = now + timedelta(seconds=config["lease_seconds"])

            update_fields = [
                "vision_job_id",
                "vision_job_type",
                "vision_worker_id",
                "vision_claimed_at",
                "vision_lease_expires_at",
            ]
            if item.ai_description_status == "pending":
                item.ai_description_status = "generating"
                item.ai_description_error = ""
                update_fields.extend(["ai_description_status", "ai_description_error"])
            if item.ai_name_status == "pending":
                item.ai_name_status = "generating"
                item.ai_name_error = ""
                update_fields.extend(["ai_name_status", "ai_name_error"])

            item.save(update_fields=update_fields)
            claimed_item = item

        # Build optimized base64 images (up to 3) & prompt payload outside the lock
        item_data = _build_item_prompt_metadata(claimed_item)
        all_images = item_data.pop("_all_images", [])

        # Primary image (always required - already read above)
        opt_bytes, opt_mime = optimize_image_for_ai(img_bytes)
        b64_str = base64.b64encode(opt_bytes).decode("ascii")
        primary_data_uri = f"data:{opt_mime};base64,{b64_str}"

        # Additional images (2nd and 3rd) for multi-design products
        extra_image_uris: List[str] = []
        primary_img_obj = claimed_item.primary_image
        for img_obj in all_images:
            if img_obj == primary_img_obj or img_obj.id == (primary_img_obj.id if primary_img_obj else -1):
                continue
            if len(extra_image_uris) >= 2:
                break
            try:
                with img_obj.image.open("rb") as ef:
                    extra_raw = ef.read()
                extra_opt, extra_mime = optimize_image_for_ai(extra_raw)
                extra_b64 = base64.b64encode(extra_opt).decode("ascii")
                extra_image_uris.append(f"data:{extra_mime};base64,{extra_b64}")
            except Exception:
                pass

        messages = build_catalog_vision_messages(
            item_data=item_data,
            job_type=effective_type,
            extra_images=extra_image_uris if extra_image_uris else None,
        )

        sync_running_batch_jobs(store_id=claimed_item.store_id)

        return {
            "job_id": job_id,
            "model": config["model"],
            "messages": messages,
            "image_base64": primary_data_uri,
            "temperature": 0.2,
            "max_tokens": 800,
            "response_format": {"type": "json_object"},
        }


def complete_vision_job(job_id: str, payload: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
    """
    Applies worker output (`ready`) or error (`failed`) for a claimed job_id,
    clears lease metadata, and updates AIDescriptionBatchJob counters.
    """
    config = get_vision_worker_config()
    worker_id = str(payload.get("worker_id") or "").strip()
    model_used = str(payload.get("model") or config["model"]).strip()
    if worker_id:
        record_worker_heartbeat(worker_id, model=model_used)

    reported_status = str(payload.get("status") or "").strip().lower()

    with transaction.atomic():
        item = Item.objects.select_for_update().filter(vision_job_id=job_id).first()
        if not item:
            return 404, {"error": f"Vision job '{job_id}' not found or lease already expired."}

        effective_type = item.vision_job_type or "name_and_description"
        update_fields = [
            "vision_job_id",
            "vision_lease_expires_at",
            "vision_claimed_at",
        ]

        if reported_status != "ready":
            err_msg = str(payload.get("error") or "Local Vision worker reported failure.").strip()[:1000]
            retryable = bool(payload.get("retryable", False))
            if retryable and item.vision_retry_count < config["max_retries"]:
                item.vision_retry_count += 1
                update_fields.append("vision_retry_count")
                if item.ai_description_status == "generating":
                    item.ai_description_status = "pending"
                    update_fields.append("ai_description_status")
                if item.ai_name_status == "generating":
                    item.ai_name_status = "pending"
                    update_fields.append("ai_name_status")
                item.vision_job_id = ""
                item.vision_lease_expires_at = None
                item.vision_claimed_at = None
                item.vision_worker_id = ""
                update_fields.append("vision_worker_id")
                item.save(update_fields=update_fields)
                sync_running_batch_jobs(store_id=item.store_id)
                return 200, {"success": True, "status": "pending", "requeued": True, "item_id": item.id}

            if item.ai_description_status == "generating" or effective_type in ("description_only", "name_and_description"):
                if item.ai_description_status == "generating":
                    item.ai_description_status = "failed"
                    item.ai_description_error = err_msg
                    update_fields.extend(["ai_description_status", "ai_description_error"])
            if item.ai_name_status == "generating" or effective_type in ("name_only", "name_and_description"):
                if item.ai_name_status == "generating":
                    item.ai_name_status = "failed"
                    item.ai_name_error = err_msg
                    update_fields.extend(["ai_name_status", "ai_name_error"])

            item.vision_job_id = ""
            item.vision_lease_expires_at = None
            item.vision_claimed_at = None
            item.save(update_fields=update_fields)
            sync_running_batch_jobs(store_id=item.store_id)
            return 200, {"success": True, "status": "failed", "item_id": item.id, "error": err_msg}

        # Success path: parse structured output
        try:
            parsed = parse_vision_model_output(
                content=str(payload.get("content") or ""),
                parsed_json=payload.get("parsed_json"),
                job_type=effective_type,
            )
        except ValueError as parse_err:
            err_msg = str(parse_err)
            if item.ai_description_status == "generating":
                item.ai_description_status = "failed"
                item.ai_description_error = err_msg
                update_fields.extend(["ai_description_status", "ai_description_error"])
            if item.ai_name_status == "generating":
                item.ai_name_status = "failed"
                item.ai_name_error = err_msg
                update_fields.extend(["ai_name_status", "ai_name_error"])
            item.vision_job_id = ""
            item.vision_lease_expires_at = None
            item.vision_claimed_at = None
            item.save(update_fields=update_fields)
            sync_running_batch_jobs(store_id=item.store_id)
            return 200, {"success": False, "status": "failed", "item_id": item.id, "error": err_msg}

        now = timezone.now()
        if effective_type in ("name_only", "name_and_description"):
            if "name" in parsed:
                generated_name = parsed["name"]
                # Safety net 1: Strip invented set/pack counts if original name had no quantity specs
                generated_name = strip_invented_pack_quantity(item.name, generated_name)
                # Safety net 2: if spec tokens from original name are missing from generated name, log warning
                if not verify_spec_tokens_preserved(item.name, generated_name):
                    logger.warning(
                        "Spec token mismatch: original='%s' generated='%s' job_id=%s",
                        item.name, generated_name, job_id,
                    )
                item.ai_name_draft = generated_name
                item.ai_name_status = "ready"
                item.ai_name_error = ""
                item.ai_name_updated_at = now
                update_fields.extend(["ai_name_draft", "ai_name_status", "ai_name_error", "ai_name_updated_at"])
            elif item.ai_name_status == "generating":
                item.ai_name_status = "failed"
                item.ai_name_error = "Vision model output missing 'name'."
                update_fields.extend(["ai_name_status", "ai_name_error"])

        if effective_type in ("description_only", "name_and_description"):
            if "description" in parsed:
                item.ai_description_draft = parsed["description"]
                item.ai_description_status = "ready"
                item.ai_description_error = ""
                item.ai_description_updated_at = now
                update_fields.extend(
                    ["ai_description_draft", "ai_description_status", "ai_description_error", "ai_description_updated_at"]
                )
            elif item.ai_description_status == "generating":
                item.ai_description_status = "failed"
                item.ai_description_error = "Vision model output missing 'description'."
                update_fields.extend(["ai_description_status", "ai_description_error"])

        item.vision_job_id = ""
        item.vision_lease_expires_at = None
        item.vision_claimed_at = None
        item.save(update_fields=update_fields)

    sync_running_batch_jobs(store_id=item.store_id)
    return 200, {
        "success": True,
        "status": "ready",
        "item_id": item.id,
        "job_id": job_id,
        "model": model_used,
    }


def enqueue_bulk_catalog_vision_job(
    store: Store,
    target_ids: List[int],
    valid_gen_name_ids: List[int],
) -> AIDescriptionBatchJob:
    """
    Queues a batch of items as 'pending' for the local Vision pull worker.
    Items without a primary image are marked 'skipped_no_image' immediately.
    Never spawns a Gemini thread or calls call_gemini_api.
    """
    gen_name_set = set(valid_gen_name_ids)
    items = list(Item.objects.filter(id__in=target_ids).prefetch_related("images"))

    eligible_ids: List[int] = []
    skipped_ids: List[int] = []

    for it in items:
        primary_img = it.primary_image
        if not primary_img or not primary_img.image:
            skipped_ids.append(it.id)
        else:
            eligible_ids.append(it.id)

    if skipped_ids:
        Item.objects.filter(id__in=skipped_ids).update(
            ai_description_status="skipped_no_image",
            ai_description_error="No product image uploaded",
            vision_job_id="",
            vision_lease_expires_at=None,
            vision_claimed_at=None,
        )
        skipped_with_name = [pk for pk in skipped_ids if pk in gen_name_set]
        if skipped_with_name:
            Item.objects.filter(id__in=skipped_with_name).update(
                ai_name_status="skipped_no_image",
                ai_name_error="No product image uploaded",
            )

    eligible_both = [pk for pk in eligible_ids if pk in gen_name_set]
    eligible_desc_only = [pk for pk in eligible_ids if pk not in gen_name_set]

    if eligible_both:
        Item.objects.filter(id__in=eligible_both).update(
            ai_description_status="pending",
            ai_description_error="",
            ai_name_status="pending",
            ai_name_error="",
            vision_job_type="name_and_description",
            vision_job_id="",
            vision_worker_id="",
            vision_claimed_at=None,
            vision_lease_expires_at=None,
            vision_retry_count=0,
        )

    if eligible_desc_only:
        Item.objects.filter(id__in=eligible_desc_only).update(
            ai_description_status="pending",
            ai_description_error="",
            vision_job_type="description_only",
            vision_job_id="",
            vision_worker_id="",
            vision_claimed_at=None,
            vision_lease_expires_at=None,
            vision_retry_count=0,
        )

    worker_online = is_vision_worker_online(max_age_seconds=30)
    if eligible_ids:
        job_status = AIDescriptionBatchJob.STATUS_RUNNING
        status_message = "" if worker_online else WAITING_FOR_WORKER_MSG
    else:
        job_status = AIDescriptionBatchJob.STATUS_COMPLETED
        status_message = ""

    job = AIDescriptionBatchJob.objects.create(
        store=store,
        status=job_status,
        total_items=len(target_ids),
        completed_items=0,
        failed_items=0,
        skipped_items=len(skipped_ids),
        item_ids=target_ids,
        generate_name_ids=valid_gen_name_ids,
        status_message=status_message,
    )
    return job


def enqueue_single_catalog_vision_item(
    item: Item,
    job_type: str = "description_only",
) -> Item:
    """
    Queues a single item as 'pending' for the local Vision pull worker
    without blocking Gunicorn or calling Gemini.
    """
    normalized_type = job_type if job_type in ("name_only", "description_only", "name_and_description") else "description_only"
    update_fields = [
        "vision_job_type",
        "vision_job_id",
        "vision_worker_id",
        "vision_claimed_at",
        "vision_lease_expires_at",
        "vision_retry_count",
    ]
    item.vision_job_type = normalized_type
    item.vision_job_id = ""
    item.vision_worker_id = ""
    item.vision_claimed_at = None
    item.vision_lease_expires_at = None
    item.vision_retry_count = 0

    if normalized_type in ("description_only", "name_and_description"):
        item.ai_description_status = "pending"
        item.ai_description_error = ""
        update_fields.extend(["ai_description_status", "ai_description_error"])

    if normalized_type in ("name_only", "name_and_description"):
        item.ai_name_status = "pending"
        item.ai_name_error = ""
        update_fields.extend(["ai_name_status", "ai_name_error"])

    item.save(update_fields=update_fields)
    return item

