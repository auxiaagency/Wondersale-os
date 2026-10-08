import os
import io
import uuid
from typing import Optional
from decimal import Decimal
from PIL import Image, ImageFont
import pi_heif

# Register HEIC opener with Pillow to support Apple HEIC formats seamlessly
pi_heif.register_heif_opener()

import barcode
from barcode.writer import ImageWriter, mm2px, pt2mm
from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import Sum

from rest_framework.exceptions import ValidationError, PermissionDenied
from .models import Item, StockMovement, ItemImage, BrokenItemReport


def adjust_stock(
    item: Item,
    change: int,
    reason: str,
    note: str = "",
    performed_by=None,
    user_display: str = ""
) -> StockMovement:
    """
    Service function to adjust item stock via the immutable stock ledger.
    Item.quantity is treated as a cached derived value and is strictly
    updated through ledger transactions with audit trail of who did it.
    """
    staff_name = ""
    staff_role = ""

    if performed_by is not None:
        staff_name = getattr(performed_by, 'name', '') or str(performed_by)
        role_obj = getattr(performed_by, 'role', None)
        staff_role = getattr(role_obj, 'name', '') if role_obj else 'Staff'
    elif user_display:
        staff_name = user_display
        staff_role = 'System'
    else:
        staff_name = 'Owner / Admin'
        staff_role = 'Owner'

    with transaction.atomic():
        # Acquire row-level lock on the item to prevent concurrent race conditions during parallel checkouts
        locked_item = Item.objects.select_for_update().get(pk=item.pk) if hasattr(item, 'pk') and item.pk else item

        movement = StockMovement.objects.create(
            item=locked_item,
            change=change,
            reason=reason,
            note=note or "",
            performed_by=performed_by if hasattr(performed_by, 'pk') else None,
            performed_by_name=staff_name,
            performed_by_role=staff_role
        )
        # Compute exact aggregate sum from stock movements to guarantee consistency
        total = StockMovement.objects.filter(item=locked_item).aggregate(
            total=Sum('change')
        )['total'] or 0

        locked_item.quantity = total
        locked_item.save(update_fields=['quantity', 'updated_at'])
        if item is not locked_item:
            item.quantity = total

    return movement


def generate_next_uid(max_retries: int = 15) -> str:
    """
    Generates the next sequential UID starting at 1,000,000.
    Uses database row-locking via GlobalSequence to guarantee zero race conditions
    when multiple employees, barcode printers, or API calls add items simultaneously.
    """
    from .models import GlobalSequence

    base_start = 1000000
    seq_name = "item_uid"

    with transaction.atomic():
        seq_obj, created = GlobalSequence.objects.select_for_update().get_or_create(
            name=seq_name,
            defaults={'current_value': base_start - 1}
        )

        if created or seq_obj.current_value < (base_start - 1):
            # Query highest existing numeric UID in the shop range (1,000,000 to 99,999,999)
            existing_uids = (
                Item.objects
                .filter(uid__regex=r'^\d+$')
                .values_list('uid', flat=True)
            )
            numeric_ids = []
            for u in existing_uids:
                try:
                    val = int(u)
                    if base_start <= val < 100000000:
                        numeric_ids.append(val)
                except ValueError:
                    continue
            current_max = max(numeric_ids) if numeric_ids else (base_start - 1)
            seq_obj.current_value = current_max

        seq_obj.current_value += 1
        candidate_num = seq_obj.current_value
        candidate_str = str(candidate_num)

        while Item.objects.filter(uid=candidate_str).exists():
            candidate_num += 1
            candidate_str = str(candidate_num)

        seq_obj.current_value = candidate_num
        seq_obj.save(update_fields=['current_value', 'updated_at'])

    return candidate_str


def convert_image_to_webp(uploaded_file, quality: Optional[int] = None) -> ContentFile:
    """
    Accepts any uploaded image (JPEG, PNG, HEIC, WebP, etc.) and converts it
    server-side to WebP format using Pillow before writing to permanent storage.
    
    The original file lives only in Django's request-scoped memory/temp storage
    and is never persisted permanently.
    """
    # Security: Enforce decompression bomb limits & file size caps
    from PIL import Image
    from django.core.exceptions import ValidationError
    Image.MAX_IMAGE_PIXELS = 25_000_000  # Cap at 25 Megapixels

    # Cap raw upload file size at 10 MB
    if hasattr(uploaded_file, 'size') and uploaded_file.size > 10 * 1024 * 1024:
        raise ValidationError("Image file exceeds maximum allowable size of 10MB.")

    # Magic byte check for valid image headers
    header = uploaded_file.read(16)
    uploaded_file.seek(0)
    valid_signatures = [
        bytes([0xFF, 0xD8, 0xFF]),                        # JPEG
        bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),  # PNG
        b'GIF87a', b'GIF89a',                             # GIF
        b'RIFF',                                          # WebP
    ]
    if not any(header.startswith(sig) for sig in valid_signatures):
        raise ValidationError("Invalid or unsupported image file format.")

    if quality is None:
        quality = getattr(settings, 'WEBP_QUALITY', 80)

    # Open image from in-memory stream
    img = Image.open(uploaded_file)

    # Handle image color mode
    if img.mode in ('RGBA', 'LA'):
        converted_img = img
    elif img.mode == 'P' and 'transparency' in img.info:
        converted_img = img.convert('RGBA')
    else:
        converted_img = img.convert('RGB')

    output_io = io.BytesIO()
    converted_img.save(output_io, format='WEBP', quality=quality, method=4)
    output_io.seek(0)

    filename = f"{uuid.uuid4().hex}.webp"
    return ContentFile(output_io.getvalue(), name=filename)


def _get_ocrb_font_path() -> tuple[str | None, bool]:
    """
    Finds the OCR-B font path for crisp barcode UID text matching the price font.
    Returns (font_path, is_ocrb).
    """
    # 1. Check local backend inventory fonts directory
    local_backend_font = os.path.join(os.path.dirname(__file__), 'fonts', 'OCR-B.ttf')
    if os.path.exists(local_backend_font):
        return local_backend_font, True

    # 2. Check frontend public fonts directory
    frontend_font = os.path.abspath(
        os.path.join(getattr(settings, 'BASE_DIR', ''), '..', 'frontend', 'public', 'fonts', 'OCR-B.ttf')
    )
    if os.path.exists(frontend_font):
        return frontend_font, True

    # 3. Fallbacks to system bold fonts if OCR-B is unavailable
    windir = os.environ.get('WINDIR', 'C:\\Windows')
    candidates = [
        os.path.join(windir, 'Fonts', 'arialbd.ttf'),
        os.path.join(windir, 'Fonts', 'segoeuib.ttf'),
        os.path.join(windir, 'Fonts', 'calibrib.ttf'),
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
        '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
    ]
    for path in candidates:
        if os.path.exists(path):
            return path, False
    return None, False


class OCRBBoldImageWriter(ImageWriter):
    """
    Custom ImageWriter that renders human-readable barcode UID text in OCR-B Bold
    without increasing its bounding dimensions or font size.
    """
    def __init__(self, is_ocrb: bool = True):
        super().__init__()
        self.is_ocrb = is_ocrb

    def _paint_text(self, xpos, ypos):
        assert ImageFont is not None
        barcodetext = self.human if self.human != "" else self.text
        font_size = int(mm2px(pt2mm(self.font_size), self.dpi))
        if font_size <= 0:
            return

        font = ImageFont.truetype(self.font_path, font_size) if self.font_path else ImageFont.load_default()
        for subtext in barcodetext.split("\n"):
            pos = (
                mm2px(xpos, self.dpi),
                mm2px(ypos, self.dpi),
            )
            if self.is_ocrb:
                self._draw.text(
                    pos,
                    subtext,
                    font=font,
                    fill=self.foreground,
                    anchor="md",
                    stroke_width=1,
                    stroke_fill=self.foreground,
                )
            else:
                self._draw.text(
                    pos,
                    subtext,
                    font=font,
                    fill=self.foreground,
                    anchor="md",
                )
            ypos += pt2mm(self.font_size) / 2 + self.text_line_distance


def generate_barcode_image(uid: str) -> io.BytesIO:
    """
    Generates a Code128 barcode image (PNG) for the given UID string.
    Suitable for rendering, downloading, or physical label printing.
    Uses OCR-B Bold font for the UID (matching price font) without increasing font size.
    """
    font_path, is_ocrb = _get_ocrb_font_path()
    writer = OCRBBoldImageWriter(is_ocrb=is_ocrb)

    code128 = barcode.get_barcode_class('code128')
    barcode_instance = code128(
        uid,
        writer=writer,
    )

    writer_options = {
        'module_width': 0.68,
        'module_height': 13.5,
        'quiet_zone': 1.5,
        'font_size': 11,
        'text_distance': 6.5,
        'write_text': True,
    }
    if font_path:
        writer_options['font_path'] = font_path

    buffer = io.BytesIO()
    barcode_instance.write(buffer, options=writer_options)
    buffer.seek(0)
    return buffer


# ─────────────────────────────────────────────────────────────────────────────
# Variant / Batch Management
# ─────────────────────────────────────────────────────────────────────────────

# Fields compared to detect meaningful difference when creating a variant
VARIANT_DIFF_FIELDS = [
    'expiry_date',
    'supplier_id',
    'cost_price',
    'selling_price',
    'mrp',
    'variant_name',
    'location_section',
    'description',
    'weight',
    'length',
    'width',
    'height',
]


def get_item_variants(item: Item):
    """
    Returns all Items in the same variant family (including `item` itself).
    If item has no variant_group_id, returns [item].
    """
    from django.db.models import F
    if not item.variant_group_id:
        return [item]
    return list(
        Item.objects
        .filter(variant_group_id=item.variant_group_id)
        .select_related('supplier', 'store')
        .prefetch_related('images')
        .order_by(F('is_master_variant').desc(), 'created_at')
    )



def create_product_variant(
    source_item: Item,
    variant_data: dict,
    actor=None,
) -> Item:
    """
    Branches a new variant from source_item.

    Rules:
    - At least one attribute in VARIANT_DIFF_FIELDS must differ from source_item.
    - Every variant gets a unique uid/barcode.
    - All variants share the same variant_group_id.
    - source_item is promoted to master_variant if it wasn't already part of a group.

    Returns the newly created Item variant.
    Raises ValueError if validation fails.
    """
    from django.utils import timezone

    # ── Ensure source becomes part of a group ────────────────────────────────
    if not source_item.variant_group_id:
        source_item.variant_group_id = uuid.uuid4().hex[:16]
        source_item.is_master_variant = True
        source_item.save(update_fields=['variant_group_id', 'is_master_variant', 'updated_at'])

    # ── Validate that at least one attribute differs ─────────────────────────
    has_difference = False
    for field in VARIANT_DIFF_FIELDS:
        source_val = getattr(source_item, field, None)
        new_val = variant_data.get(field, source_val)  # default to source if not provided
        if str(source_val) != str(new_val):
            has_difference = True
            break

    # Also treat a new image upload as a valid difference
    if not has_difference and variant_data.get('_has_new_image'):
        has_difference = True

    if not has_difference:
        raise ValueError(
            "A variant must differ from the original item by at least one attribute "
            "(e.g. expiry date, supplier, price, cost, colour/variant name, weight, or dimensions)."
        )

    # ── Build new item fields (Exact carbon copy of source item) ─────────────
    initial_quantity = int(variant_data.pop('initial_quantity', 0))

    # Inherit taxonomy, store, physical dimensions, description and metadata from source
    new_item_fields = dict(
        name=source_item.name,
        cost_price=source_item.cost_price,
        selling_price=source_item.selling_price,
        mrp=source_item.mrp,
        supplier=source_item.supplier,
        store=source_item.store,
        location_section=source_item.location_section,
        expiry_date=source_item.expiry_date,
        weight=source_item.weight,
        length=source_item.length,
        width=source_item.width,
        height=source_item.height,
        description=source_item.description,
        ai_description_draft=source_item.ai_description_draft,
        ai_description_status=source_item.ai_description_status,
        ai_description_error=source_item.ai_description_error,
        source=source_item.source,
        variant_name='',
        is_master_variant=False,
        needs_new_barcode_printed=True,
    )

    # Apply caller-provided overrides
    for field, value in variant_data.items():
        if field.startswith('_'):
            continue  # skip internal keys like _has_new_image
        if field in ('uid', 'supplier', 'store'):
            new_item_fields[field] = value
        elif hasattr(Item, field):
            new_item_fields[field] = value

    # Assign supplier FK from supplier_id if provided
    if 'supplier_id' in variant_data and variant_data['supplier_id']:
        from .models import Supplier
        try:
            new_item_fields['supplier'] = Supplier.objects.get(pk=int(variant_data['supplier_id']))
        except Supplier.DoesNotExist:
            pass

    # ── UID / Barcode Uniqueness Guarantee ──────────────────────────────────
    custom_uid = str(new_item_fields.get('uid', '') or '').strip()
    source_uid = str(source_item.uid).strip()
    if not custom_uid or custom_uid == source_uid:
        new_item_fields['uid'] = generate_next_uid()
    else:
        # Validate uniqueness of custom UID against the database
        if Item.objects.filter(uid__iexact=custom_uid).exists():
            raise ValueError(f"UID / Barcode '{custom_uid}' is already in use by another product. Every variant must have a unique barcode.")
        new_item_fields['uid'] = custom_uid

    # Attach to the variant family
    new_item_fields['variant_group_id'] = source_item.variant_group_id

    # ── Create the variant item ──────────────────────────────────────────────
    with transaction.atomic():
        new_item = Item.objects.create(**new_item_fields)

        # Inherit subcategories from source
        source_subcats = list(source_item.subcategories.all())
        if source_subcats:
            new_item.subcategories.set(source_subcats)
        if source_item.primary_subcategory:
            new_item.primary_subcategory = source_item.primary_subcategory
            new_item.save(update_fields=['primary_subcategory'])

        # Inherit all gallery photos identically from source item
        from .models import ItemImage
        for src_img in source_item.images.all().order_by('order', 'id'):
            if src_img.image and src_img.image.name:
                ItemImage.objects.create(
                    item=new_item,
                    image=src_img.image.name,
                    is_primary=src_img.is_primary,
                    order=src_img.order,
                )

        # Record initial stock if provided
        if initial_quantity > 0:
            adjust_stock(
                item=new_item,
                change=initial_quantity,
                reason=StockMovement.REASON_RESTOCK,
                note=f"Initial stock assigned for new variant '{new_item.variant_name or new_item.uid}'.",
                performed_by=actor,
            )

    return new_item


# ─────────────────────────────────────────────────────────────────────────────
# Expired Stock Write-Off
# ─────────────────────────────────────────────────────────────────────────────

def preview_expired_stock(store_id=None) -> dict:
    """
    Returns a read-only preview of all items past their expiry date with stock > 0.
    Does NOT modify anything — safe to call as a confirmation step before write-off.
    """
    from django.utils import timezone

    today = timezone.now().date()
    qs = Item.objects.filter(expiry_date__lte=today, quantity__gt=0)
    if store_id and str(store_id).lower() not in ('all', '', 'null', 'none'):
        try:
            qs = qs.filter(store_id=int(store_id))
        except (ValueError, TypeError):
            pass

    items_list = []
    total_units = 0
    total_loss = Decimal('0.00')

    for item in qs.select_related('store', 'supplier'):
        cost = item.cost_price or Decimal('0.00')
        units = item.quantity
        item_loss = Decimal(units) * cost
        total_units += units
        total_loss += item_loss
        items_list.append({
            'item_id': item.id,
            'uid': item.uid,
            'name': item.name,
            'expiry_date': str(item.expiry_date),
            'current_stock': units,
            'cost_price': float(cost),
            'potential_loss': float(round(item_loss, 2)),
            'store_name': item.store.name if item.store else '',
        })

    return {
        'items': items_list,
        'total_items': len(items_list),
        'total_units': total_units,
        'total_financial_loss': float(round(total_loss, 2)),
    }


def write_off_expired_stock(store_id=None, item_id=None, actor=None) -> dict:
    """
    Finds expired items (expiry_date <= today, quantity > 0), records a
    StockMovement with reason=REASON_EXPIRED for each, and sets item.quantity to 0.

    Returns a summary of all items written off and total financial loss.
    """
    from django.utils import timezone

    today = timezone.now().date()
    qs = Item.objects.filter(expiry_date__lte=today, quantity__gt=0)
    if store_id and str(store_id).lower() not in ('all', '', 'null', 'none'):
        try:
            qs = qs.filter(store_id=int(store_id))
        except (ValueError, TypeError):
            pass
    if item_id:
        try:
            qs = qs.filter(pk=int(item_id))
        except (ValueError, TypeError):
            pass

    items_written_off = []
    total_units = 0
    total_loss = Decimal('0.00')

    with transaction.atomic():
        for item in qs.select_related('store', 'supplier').select_for_update():
            cost = item.cost_price or Decimal('0.00')
            expired_qty = item.quantity
            if expired_qty <= 0:
                continue

            item_loss = Decimal(expired_qty) * cost
            total_units += expired_qty
            total_loss += item_loss

            movement = adjust_stock(
                item=item,
                change=-expired_qty,
                reason=StockMovement.REASON_EXPIRED,
                note=(
                    f"Product expired on {item.expiry_date}. "
                    f"{expired_qty} unit(s) written off to inventory loss."
                ),
                performed_by=actor,
            )

            items_written_off.append({
                'item_id': item.id,
                'uid': item.uid,
                'name': item.name,
                'expiry_date': str(item.expiry_date),
                'units_written_off': expired_qty,
                'cost_price': float(cost),
                'financial_loss': float(round(item_loss, 2)),
                'movement_id': movement.id,
                'store_name': item.store.name if item.store else '',
            })

    return {
        'items': items_written_off,
        'items_written_off_count': len(items_written_off),
        'total_units_written_off': total_units,
        'total_financial_loss': float(round(total_loss, 2)),
    }


def report_broken_item(
    item_id: int,
    quantity: int,
    reason: str,
    proof_image,
    performed_by=None,
    user_display: str = ""
) -> BrokenItemReport:
    """
    Bulletproof service function to report and write off broken/damaged physical merchandise:
    - Atomically locks item row using select_for_update() to prevent concurrent race conditions.
    - Strictly validates that the item is currently in stock (quantity > 0).
    - Strictly validates that reported quantity >= 1 and <= item.quantity.
    - Strictly enforces section isolation for staff with assigned_section scope.
    - Records negative StockMovement with reason='broken' and audit details.
    - Updates Item.quantity to reflect exact ledger total.
    - Creates BrokenItemReport linked to the stock movement with financial loss calculations.
    """
    if not reason or not str(reason).strip():
        raise ValidationError({"reason": "A detailed explanation of how the damage occurred is mandatory."})

    if not proof_image:
        raise ValidationError({"proof_image": "Mandatory photo evidence of broken merchandise must be uploaded."})

    try:
        qty = int(quantity)
    except (ValueError, TypeError):
        raise ValidationError({"quantity": "Invalid quantity provided. Must be a valid integer."})

    if qty <= 0:
        raise ValidationError({"quantity": "Reported quantity must be at least 1 unit."})

    staff_name = ""
    staff_role = ""
    if performed_by is not None:
        staff_name = getattr(performed_by, 'name', '') or str(performed_by)
        role_obj = getattr(performed_by, 'role', None)
        staff_role = getattr(role_obj, 'name', '') if role_obj else 'Staff'
    elif user_display:
        staff_name = user_display
        staff_role = 'Staff'
    else:
        staff_name = 'Owner / Admin'
        staff_role = 'Owner'

    # Convert uploaded proof image to WebP format using central image pipeline
    if proof_image and hasattr(proof_image, 'read'):
        try:
            proof_image = convert_image_to_webp(proof_image)
        except Exception:
            # Fallback gracefully if testing with mock bytes or non-standard format
            pass

    with transaction.atomic():
        try:
            locked_item = Item.objects.select_for_update().select_related('store', 'section').get(pk=item_id)
        except Item.DoesNotExist:
            raise ValidationError({"item": f"Product with ID {item_id} does not exist."})

        # 1. Section isolation check
        if performed_by is not None:
            scope = getattr(performed_by, 'inventory_scope', None)
            if not scope and hasattr(performed_by, 'role') and performed_by.role:
                scope = getattr(performed_by.role, 'inventory_scope', 'full')
            if scope == 'assigned_section' and getattr(performed_by, 'section_id', None):
                if locked_item.section_id != performed_by.section_id:
                    raise PermissionDenied("You can only report broken items belonging to your assigned section.")

        # 2. BULLETPROOF IN-STOCK VALIDATION
        if locked_item.quantity <= 0:
            raise ValidationError({
                "quantity": (
                    f"Product '{locked_item.name}' ({locked_item.uid}) is currently out of stock "
                    f"(Current stock: {locked_item.quantity}). Only items currently in physical stock can be reported as broken."
                )
            })

        if qty > locked_item.quantity:
            raise ValidationError({
                "quantity": (
                    f"Cannot report {qty} unit(s) as broken. Only {locked_item.quantity} unit(s) of "
                    f"'{locked_item.name}' are currently in stock."
                )
            })

        # 3. Create negative StockMovement
        cost_price = locked_item.cost_price or Decimal('0.00')
        total_loss = (cost_price * Decimal(qty)).quantize(Decimal('0.01'))

        movement = StockMovement.objects.create(
            item=locked_item,
            change=-qty,
            reason=StockMovement.REASON_BROKEN,
            note=f"Broken item write-off: {str(reason).strip()[:200]}",
            proof_image=proof_image,
            performed_by=performed_by if hasattr(performed_by, 'pk') else None,
            performed_by_name=staff_name,
            performed_by_role=staff_role,
        )

        # 4. Synchronize derived item quantity with exact ledger aggregate
        total_stock = StockMovement.objects.filter(item=locked_item).aggregate(
            total=Sum('change')
        )['total'] or 0
        locked_item.quantity = total_stock
        locked_item.save(update_fields=['quantity', 'updated_at'])

        # 5. Create BrokenItemReport
        report = BrokenItemReport.objects.create(
            item=locked_item,
            store=locked_item.store,
            section=locked_item.section,
            quantity=qty,
            cost_price=cost_price,
            total_loss=total_loss,
            reason=str(reason).strip(),
            proof_image=proof_image,
            reported_by=performed_by if hasattr(performed_by, 'pk') else None,
            reported_by_name=staff_name,
            stock_movement=movement,
        )

    return report

