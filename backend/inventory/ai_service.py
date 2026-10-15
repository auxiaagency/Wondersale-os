import base64
import io
import json
import logging
import os
import re
import threading
import urllib.request
import urllib.error
from decimal import Decimal
from typing import List, Dict, Any, Optional

from PIL import Image as PILImage
from django.utils import timezone

logger = logging.getLogger(__name__)


class GeminiRateLimitError(Exception):
    """
    Raised when all Gemini API keys in the pool have hit quota or rate limits.
    is_daily indicates daily quota (RPD) exhaustion vs per-minute (RPM) rate limits.
    """
    def __init__(self, message: str, is_daily: bool = False, raw_error: str = ""):
        super().__init__(message)
        self.message = message
        self.is_daily = is_daily
        self.raw_error = raw_error


def get_configured_gemini_api_keys() -> List[str]:
    """
    Safely retrieves configured Gemini API keys from environment variables and backend/.env:
    Dynamically inspects backend/.env so runtime additions/updates take effect immediately.
    Supports comma-separated keys: key1, key2, key3 in GEMINI_API_KEYS, GEMINI_API_KEY, or GOOGLE_API_KEY.
    """
    # 1. Dynamically re-read backend/.env if present
    try:
        from django.conf import settings
        env_file = settings.BASE_DIR / '.env'
        if env_file.exists():
            with open(env_file, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith('#') or '=' not in line:
                        continue
                    k, v = line.split('=', 1)
                    k = k.strip()
                    v = v.strip().strip("'\"")
                    if k in ('GEMINI_API_KEYS', 'GEMINI_API_KEY', 'GOOGLE_API_KEY'):
                        os.environ[k] = v
    except Exception:
        pass

    keys = []
    for env_var in ('GEMINI_API_KEYS', 'GEMINI_API_KEY', 'GOOGLE_API_KEY'):
        raw_val = os.environ.get(env_var, '').strip()
        if raw_val:
            for piece in raw_val.split(','):
                cleaned = piece.strip().strip("'\"")
                if cleaned and cleaned not in keys:
                    keys.append(cleaned)
    return keys


# Models to attempt in priority order:
# Google has migrated newly issued API keys to the 3.x series, deprecating older 1.5/2.0 endpoints with HTTP 404.
# Models are attempted in order: flash-lite for speed and higher throughput, followed by standard flash models.
GEMINI_MODELS = [
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-3.5-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
]

EXTRACTION_SYSTEM_PROMPT = """
You are an expert OCR and retail inventory extraction AI specializing in reading messy, cursive, smudged, and shorthand handwritten bills, invoices, receipts, and distributor purchase slips (including Indian retail formats in English, Hindi/Hinglish, and regional terms).

TASK:
Analyze the provided image(s) or PDF bill and extract all distinct product items listed on this bill/invoice into structured inventory items with per-field confidence scores.

DITTO MARKS & REPETITION CONVENTION (CRITICAL):
In handwritten bills and ledgers, ditto marks ('"', '”', '“', ',,', '-do-', 'do', 'ditto') or leading ditto marks (e.g., '" 200g', '" Red', '” 1kg', ',, 500ml') indicate repeating information from the row directly above:
- If a product name is just '"' or ',,' or 'ditto' or '-do-', copy the FULL product name from the row directly above.
- If a product name starts with a ditto mark (e.g. '" 500g' or ',, 1L'), inherit the brand / item title prefix from the row directly above (e.g. if previous is 'Amul Milk 1L', then '" 500ml' becomes 'Amul Milk 500ml').
- If a price, category, quantity, or other field has a ditto mark ('"' or ',,' or '-do-'), copy the exact value from the row directly above.
- Always resolve and expand ditto marks into the actual final text/number in your JSON output.

FIELDS TO EXTRACT PER ITEM:
1. "name": The clear, full product name / description. Decipher abbreviations (e.g. "Amul T-Spcl 1L" -> "Amul Taaza Special 1L", "Dettol 100g 3in1", "Cadbury Dairy Milk 50g", "Surf Excel 1kg"). If unreadable or missing, output "".
2. "cost_price": The buying / cost price PER UNIT as a numeric string (e.g. "45.00"). If a line shows "10 pkts = 450", calculate unit cost = 45.00. If completely illegible or missing from the bill, output "".
3. "selling_price": The selling price PER UNIT as a numeric string (e.g. "50.00"). If the bill specifies a selling rate or MRP with discount, use it. If not explicitly on the bill, calculate standard selling price = cost_price * 1.15 (15% markup) or equal to MRP. If cost_price is missing, output "".
4. "quantity": The total number of units purchased / in stock as a whole integer string (e.g. "10", "25", "1"). If completely missing or illegible, output "".
5. "mrp": Maximum Retail Price if written or printed (e.g. "50.00"), otherwise null.
6. "category_or_subcategory": Inferred category or subcategory name (e.g. "Dairy", "Beverages", "Snacks", "Personal Care", "Apparel", "Electronics").
7. "location_section": Store section / shelf / rack if mentioned (e.g. "Rack 2"), otherwise "".
8. "expiry_date": Expiry or best-before date in "YYYY-MM-DD" format if visible, otherwise null.
9. "weight": Weight or net volume in grams as numeric float string if mentioned, otherwise null.

CONFIDENCE EVALUATION (CRITICAL):
For each item, evaluate your confidence on a scale of 0.00 to 1.00 for each field:
- "confidence": {
    "name": float (0.0 to 1.0),
    "cost_price": float (0.0 to 1.0),
    "selling_price": float (0.0 to 1.0),
    "quantity": float (0.0 to 1.0),
    "mrp": float (0.0 to 1.0),
    "overall": float (0.0 to 1.0)
  }
If any handwriting is smudged, blurry, ambiguous, or has multiple interpretations (e.g. a handwritten digit looks like 15 or 75), assign confidence < 0.70 to that field and explain in "warnings". If a field is empty or missing, assign confidence 0.0.

OUTPUT FORMAT:
You must output ONLY a valid JSON object matching this schema, with no Markdown code fences:
{
  "bill_metadata": {
    "vendor_name": "string or null",
    "invoice_number": "string or null",
    "invoice_date": "string or null",
    "total_amount": "string or null"
  },
  "items": [
    {
      "name": "Classic Oxford Shirt",
      "cost_price": "450.00",
      "selling_price": "899.00",
      "quantity": "25",
      "mrp": "999.00",
      "category_or_subcategory": "Apparel",
      "location_section": "Aisle 2",
      "expiry_date": "2027-12-31",
      "weight": "300",
      "confidence": {
        "name": 0.95,
        "cost_price": 0.90,
        "selling_price": 0.85,
        "quantity": 0.60,
        "mrp": 0.90,
        "overall": 0.84
      },
      "warnings": [
        "Quantity digit 25 is slightly smudged (could be 75); defaulted to 25"
      ]
    }
  ]
}
"""

DITTO_VALUES = {'"', '""', "''", ',,', '„', '“', '”', '〃', 'do', '-do-', 'ditto', '--do--', 'd/o', 'd.o.'}


def is_ditto_mark(val: Any) -> bool:
    """Checks if a string represents a ditto / repetition mark."""
    if val is None:
        return False
    s = str(val).strip().lower()
    return s in DITTO_VALUES


def resolve_ditto_marks(raw_items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Post-processes extracted items to resolve handwritten ditto marks (", ,, -do-, ditto).
    Inherits brand names, unit prices, quantities, and categories from previous line items.
    """
    if not raw_items or len(raw_items) <= 1:
        return raw_items

    resolved = []
    for i, item in enumerate(raw_items):
        item_copy = dict(item)
        if i == 0:
            resolved.append(item_copy)
            continue

        prev = resolved[i - 1]

        # 1. Product Name ditto resolution
        raw_name = str(item_copy.get('name', '')).strip()
        if is_ditto_mark(raw_name) or not raw_name:
            item_copy['name'] = prev.get('name', raw_name)
        elif raw_name.startswith(('"', '”', '“', '„', "''", ',,')):
            cleaned_suffix = re.sub(r'^[”"“„,\'\s]+', '', raw_name).strip()
            prev_name = prev.get('name', '').strip()
            prev_words = prev_name.split()
            # If suffix is a size/variant and previous item has multiple words with a size suffix, replace the size
            unit_pattern = r'^\d+(\.\d+)?\s*(g|kg|ml|l|ltr|gm|oz|pk|pack|pcs|pc|m|cm|s|m|l|xl|xxl)?$'
            if len(prev_words) > 1 and re.match(unit_pattern, cleaned_suffix, re.IGNORECASE):
                if re.match(unit_pattern, prev_words[-1], re.IGNORECASE):
                    item_copy['name'] = f"{' '.join(prev_words[:-1])} {cleaned_suffix}".strip()
                else:
                    item_copy['name'] = f"{prev_name} {cleaned_suffix}".strip()
            elif prev_name:
                item_copy['name'] = f"{prev_name} {cleaned_suffix}".strip()
            else:
                item_copy['name'] = cleaned_suffix

        # 2. Cost Price ditto resolution
        raw_cost = str(item_copy.get('cost_price', '')).strip()
        if is_ditto_mark(raw_cost) or (not raw_cost and prev.get('cost_price')):
            item_copy['cost_price'] = prev.get('cost_price', '')

        # 3. Selling Price ditto resolution
        raw_selling = str(item_copy.get('selling_price', '')).strip()
        if is_ditto_mark(raw_selling) or (not raw_selling and prev.get('selling_price')):
            item_copy['selling_price'] = prev.get('selling_price', '')

        # 4. Quantity ditto resolution
        raw_qty = str(item_copy.get('quantity', '')).strip()
        if is_ditto_mark(raw_qty) or (not raw_qty and prev.get('quantity')):
            item_copy['quantity'] = prev.get('quantity', '1')

        # 5. MRP ditto resolution
        raw_mrp = item_copy.get('mrp')
        if is_ditto_mark(raw_mrp):
            item_copy['mrp'] = prev.get('mrp')

        # 6. Category / Subcategory ditto resolution
        raw_cat = str(item_copy.get('category_or_subcategory', '')).strip()
        if is_ditto_mark(raw_cat) or (not raw_cat and prev.get('category_or_subcategory')):
            item_copy['category_or_subcategory'] = prev.get('category_or_subcategory', '')

        # 7. Location Section ditto resolution
        raw_sec = str(item_copy.get('location_section', '')).strip()
        if is_ditto_mark(raw_sec):
            item_copy['location_section'] = prev.get('location_section', '')

        # 8. Expiry Date ditto resolution
        raw_exp = item_copy.get('expiry_date')
        if is_ditto_mark(raw_exp):
            item_copy['expiry_date'] = prev.get('expiry_date')

        # 9. Weight ditto resolution
        raw_wt = item_copy.get('weight')
        if is_ditto_mark(raw_wt):
            item_copy['weight'] = prev.get('weight')

        resolved.append(item_copy)

    return resolved


def call_gemini_api(
    api_key: str,
    parts: List[Dict[str, Any]],
    model: str = 'gemini-1.5-flash',
    timeout: int = 60,
    response_mime_type: Optional[str] = 'application/json',
    temperature: float = 0.1,
    max_output_tokens: Optional[int] = None
) -> Dict[str, Any]:
    """
    Direct HTTP request to Google Gemini API via standard urllib.
    Supports system instructions, multimodal inline data, structured JSON or markdown output, and configurable timeout.
    """
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key.strip()}"

    gen_config: Dict[str, Any] = {
        "temperature": temperature
    }
    if response_mime_type:
        gen_config["responseMimeType"] = response_mime_type
    if max_output_tokens:
        gen_config["maxOutputTokens"] = max_output_tokens

    # Disable extended reasoning/thinking delay on 2.5/Flash models for instantaneous catalog copy generation
    if '2.5' in model or 'flash' in model.lower():
        gen_config["thinkingConfig"] = {
            "thinkingBudget": 0
        }

    payload = {
        "contents": [
            {
                "parts": parts
            }
        ],
        "generationConfig": gen_config
    }

    req_data = json.dumps(payload).encode('utf-8')
    # Security: Pin scheme to HTTPS exclusively to prevent SSRF
    parsed_url = urllib.parse.urlparse(url)
    if parsed_url.scheme.lower() != 'https':
        raise ValueError(f"Insecure URL scheme '{parsed_url.scheme}' rejected; HTTPS required.")

    req = urllib.request.Request(
        url,
        data=req_data,
        headers={'Content-Type': 'application/json'},
        method='POST'
    )

    with urllib.request.urlopen(req, timeout=timeout) as response:  # nosec B310 - verified https scheme above
        resp_body = response.read().decode('utf-8')
        return json.loads(resp_body)


def test_gemini_api_key(api_key: str) -> Dict[str, Any]:
    """
    Validates a Gemini API Key by performing a minimal text generation ping.
    Fast timeout (8s) and descriptive error reporting.
    """
    if not api_key or not api_key.strip():
        raise ValueError("API Key is empty.")

    cleaned_key = api_key.strip()
    parts = [{"text": "Respond with JSON: {\"status\": \"ok\"}"}]

    last_err = None
    quota_err_msg = None

    for model in GEMINI_MODELS:
        try:
            res = call_gemini_api(cleaned_key, parts, model=model, timeout=8)
            candidates = res.get('candidates', [])
            if candidates and candidates[0].get('content', {}).get('parts'):
                raw_text = candidates[0]['content']['parts'][0].get('text', '{}')
                parsed = json.loads(raw_text)
                return {
                    "valid": True,
                    "model": model,
                    "message": f"Connected successfully ({model}).",
                    "status": parsed.get('status', 'ok')
                }
        except urllib.error.HTTPError as http_err:
            last_err = http_err
            error_content = ""
            try:
                error_content = http_err.read().decode('utf-8')
            except Exception:
                pass

            if http_err.code in (429, 403):
                # Save the quota error and try the next model in the priority list (e.g. gemini-1.5-flash or gemini-2.0-flash)
                quota_err_msg = f"Gemini API Quota/Rate Limit Exceeded (HTTP {http_err.code}): {error_content or http_err.reason}"
                continue
            elif http_err.code == 400:
                raise ValueError(f"Invalid API Key or Request format (HTTP 400): {error_content or http_err.reason}")
            elif http_err.code == 404:
                # Model endpoint not found, try next model
                continue
            else:
                raise ValueError(f"Gemini API Error (HTTP {http_err.code}): {error_content or http_err.reason}")
        except Exception as e:
            last_err = e
            continue

    if quota_err_msg:
        raise ValueError(quota_err_msg)
    raise ValueError(f"Failed to connect to Gemini API: {str(last_err)}")


def extract_products_from_bill(
    files_data: List[Dict[str, Any]],
    custom_api_keys: Optional[List[str]] = None,
    available_subcategories: Optional[List[Dict[str, Any]]] = None,
    available_suppliers: Optional[List[Dict[str, Any]]] = None,
    custom_request: Optional[str] = None
) -> Dict[str, Any]:
    """
    Extracts structured product catalog data from uploaded bill images or PDF documents.
    Features automated multi-key rotation and fallback when rate limits or quotas are reached.
    Supports optional custom user instructions with highest priority precedence over base extraction rules.
    """
    if not files_data or len(files_data) == 0:
        raise ValueError("No bill images or documents provided for processing.")

    # Build key pool: Custom user keys first, then environment keys
    key_pool = []
    if custom_api_keys:
        for k in custom_api_keys:
            if isinstance(k, str) and k.strip() and k.strip() not in key_pool:
                key_pool.append(k.strip())

    for k in get_configured_gemini_api_keys():
        if k not in key_pool:
            key_pool.append(k)

    if not key_pool:
        raise ValueError("No Gemini API keys are configured. Please set GEMINI_API_KEYS in .env or add an API key in Settings.")

    # Prepare Multimodal Parts
    parts = []
    for file_info in files_data:
        raw_bytes = file_info.get('bytes')
        mime_type = file_info.get('mime_type', 'image/jpeg')

        if not raw_bytes:
            continue

        b64_encoded = base64.b64encode(raw_bytes).decode('utf-8')
        parts.append({
            "inline_data": {
                "mime_type": mime_type,
                "data": b64_encoded
            }
        })

    if not parts:
        raise ValueError("Could not read any valid image or PDF bytes from the uploaded files.")

    # Build extraction prompt with optional special user custom instructions / overrides
    prompt_text = EXTRACTION_SYSTEM_PROMPT
    if custom_request and str(custom_request).strip():
        user_req = str(custom_request).strip()
        prompt_text += f"""

======================================================================
SPECIAL USER CUSTOM INSTRUCTIONS & OVERRIDES (HIGHEST PRIORITY):
======================================================================
The user has provided the following specific custom instructions for extracting this bill/invoice:
"{user_req}"

PRECEDENCE & CONFLICT RESOLUTION RULES:
1. Base extraction rules MUST ALWAYS be executed as the default foundation.
2. If ANY clash, conflict, or difference occurs between any part of the base instructions above and the user's special custom instructions (for example: omitting certain fields like selling_price, calculating selling price with a specific custom percentage markup such as cost + 15%, setting specific field defaults, or custom naming/categorization preferences), you MUST strictly give HIGHEST PRIORITY to the user's special custom instructions above.
3. You must still adhere to the JSON schema output format (items array with name, cost_price, selling_price, quantity, mrp, category_or_subcategory, confidence scores, and bill_metadata).
======================================================================
"""

    # Include system prompt as a part
    parts.append({"text": prompt_text})

    # Execute Multi-Key Fallback Rotation (Hard limit: max 3 attempts total)
    MAX_ATTEMPTS = 3
    attempts = 0
    key_errors = []
    successful_response = None
    used_key_index = -1
    used_model = ""

    for idx, key in enumerate(key_pool):
        if attempts >= MAX_ATTEMPTS or successful_response is not None:
            break
        key_masked = f"{key[:6]}...{key[-4:]}" if len(key) > 10 else "***"
        for model in GEMINI_MODELS:
            if attempts >= MAX_ATTEMPTS or successful_response is not None:
                break
            try:
                logger.info(f"Attempting bill extraction with Gemini key [{idx + 1}/{len(key_pool)}] ({key_masked}) using model {model} (Attempt {attempts + 1}/{MAX_ATTEMPTS})")
                raw_gemini_resp = call_gemini_api(key, parts, model=model)
                candidates = raw_gemini_resp.get('candidates', [])
                if candidates and candidates[0].get('content', {}).get('parts'):
                    raw_text = candidates[0]['content']['parts'][0].get('text', '{}')
                    # Strip markdown blocks if Gemini added them despite responseMimeType
                    cleaned_text = raw_text.strip()
                    if cleaned_text.startswith('```json'):
                        cleaned_text = cleaned_text[7:]
                    if cleaned_text.startswith('```'):
                        cleaned_text = cleaned_text[3:]
                    if cleaned_text.endswith('```'):
                        cleaned_text = cleaned_text[:-3]

                    parsed_json = json.loads(cleaned_text.strip())
                    successful_response = parsed_json
                    used_key_index = idx
                    used_model = model
                    break
            except urllib.error.HTTPError as http_err:
                err_detail = ""
                try:
                    err_detail = http_err.read().decode('utf-8')
                except Exception:
                    pass

                logger.warning(f"Gemini API key [{key_masked}] failed with HTTP {http_err.code} on model {model}: {err_detail or http_err.reason}")

                if http_err.code in (429, 403):
                    attempts += 1
                    key_errors.append({
                        "key_masked": key_masked,
                        "code": http_err.code,
                        "reason": "Quota / Rate Limit Exceeded",
                        "detail": err_detail
                    })
                    # Break out of model loop for this key to try the next API key in the pool
                    break
                elif http_err.code in (404, 503, 502, 504):
                    # Model not found or temporary server load on this endpoint, try next model without consuming attempt
                    logger.warning(f"Model {model} unavailable (HTTP {http_err.code}). Trying next model in cascade...")
                    continue
                elif http_err.code == 400:
                    attempts += 1
                    key_errors.append({
                        "key_masked": key_masked,
                        "code": http_err.code,
                        "reason": str(http_err.reason),
                        "detail": err_detail
                    })
                    break
                else:
                    logger.warning(f"Gemini API error {http_err.code} on model {model}: {http_err.reason}. Trying next model...")
                    continue
            except Exception as ex:
                logger.warning(f"Gemini extraction error with key [{key_masked}] on model {model}: {str(ex)}. Trying next model...")
                continue
        else:
            # All models on this key were attempted without success
            attempts += 1
            key_errors.append({
                "key_masked": key_masked,
                "code": 500,
                "reason": "All model endpoints exhausted for this key",
                "detail": ""
            })

        if successful_response is not None:
            break

    # If all keys failed
    if successful_response is None:
        has_quota_error = any(e.get('code') in (429, 403) for e in key_errors)
        if has_quota_error:
            error_msg = (
                "All configured Gemini API keys have reached rate limits or quota limits. "
                "Please add another free Gemini API key in Settings -> Gemini AI / Bill OCR tab."
            )
        else:
            err_summaries = [f"Key {e.get('key_masked')}: {e.get('reason')}" for e in key_errors]
            error_msg = f"Failed to process bill image with AI. Errors: {'; '.join(err_summaries)}"

        raise RuntimeError(json.dumps({
            "error": error_msg,
            "quota_exhausted": has_quota_error,
            "key_errors": key_errors,
            "keys_tried": len(key_pool)
        }))

    # Post-process extracted items and resolve any ditto marks
    raw_items = resolve_ditto_marks(successful_response.get('items', []))
    processed_items = []

    for idx, item in enumerate(raw_items):
        name = str(item.get('name', '')).strip()
        cost_p = str(item.get('cost_price', '')).strip()
        sell_p = str(item.get('selling_price', '')).strip()
        qty = str(item.get('quantity', '')).strip()
        mrp = str(item.get('mrp', '')).strip() if item.get('mrp') else ''
        category_hint = str(item.get('category_or_subcategory', '')).strip()
        section = str(item.get('location_section', '')).strip()
        expiry = str(item.get('expiry_date', '')).strip() if item.get('expiry_date') else ''
        weight = str(item.get('weight', '')).strip() if item.get('weight') else ''
        confidence = item.get('confidence', {})
        warnings = item.get('warnings', [])

        # Subcategory match against available store subcategories
        matched_subcat_ids = []
        matched_subcat_objs = []
        if available_subcategories and category_hint:
            for sc in available_subcategories:
                sc_name = sc.get('name', '').lower()
                if sc_name and (sc_name in category_hint.lower() or category_hint.lower() in sc_name):
                    if sc.get('id') not in matched_subcat_ids:
                        matched_subcat_ids.append(sc.get('id'))
                        matched_subcat_objs.append(sc)

        processed_items.append({
            "id": f"ai_item_{idx + 1}",
            "name": name,
            "cost_price": cost_p,
            "selling_price": sell_p,
            "quantity": qty,
            "mrp": mrp or None,
            "category_or_subcategory": category_hint,
            "matched_subcategories": matched_subcat_ids,
            "matched_subcategory_objects": matched_subcat_objs,
            "location_section": section,
            "expiry_date": expiry or None,
            "weight": weight or None,
            "confidence": {
                "name": float(confidence.get('name', 0.9)),
                "cost_price": float(confidence.get('cost_price', 0.9)),
                "selling_price": float(confidence.get('selling_price', 0.85)),
                "quantity": float(confidence.get('quantity', 0.9)),
                "mrp": float(confidence.get('mrp', 0.9)) if mrp else 1.0,
                "overall": float(confidence.get('overall', 0.88))
            },
            "warnings": warnings if isinstance(warnings, list) else [str(warnings)] if warnings else []
        })

    bill_meta = successful_response.get('bill_metadata', {})
    vendor_name = str(bill_meta.get('vendor_name', '')).strip() if bill_meta.get('vendor_name') else ''

    matched_supplier_id = None
    matched_supplier_name = None
    if available_suppliers and vendor_name:
        v_clean = vendor_name.lower()
        for sup in available_suppliers:
            s_name = str(sup.get('name', '')).lower()
            if s_name and (s_name in v_clean or v_clean in s_name):
                matched_supplier_id = sup.get('id')
                matched_supplier_name = sup.get('name')
                break

    bill_meta['matched_supplier_id'] = matched_supplier_id
    bill_meta['matched_supplier_name'] = matched_supplier_name

    return {
        "success": True,
        "items_count": len(processed_items),
        "items": processed_items,
        "bill_metadata": bill_meta,
        "ai_stats": {
            "model_used": used_model,
            "key_index_used": used_key_index + 1,
            "total_keys_available": len(key_pool)
        }
    }


# ============================================================================
# AI PRODUCT DESCRIPTION GENERATION ENGINE (E-COMMERCE / WEBSITE READY)
# ============================================================================

PRODUCT_DESCRIPTION_SYSTEM_PROMPT = """
You are an expert e-commerce catalog copywriter and retail merchandising specialist for modern storefronts and marketplace listings.

TASK:
Analyze the provided product image and product metadata (name, category, price, MRP, etc.) and generate an informative, rich, high-converting, professional, and SEO-friendly e-commerce product description in clean Markdown.

TARGET LENGTH & STRUCTURE:
- Target length: approx. 1,100 to 1,250 characters (approx. 170–220 words) to provide thorough, actionable customer insights.
- STRICT LIMIT: The entire description MUST NOT exceed 1,500 characters total.

STRUCTURE OF OUTPUT (CLEAN MARKDOWN):
### Overview
2-3 engaging, descriptive sentences highlighting product craftsmanship, texture/material quality, design aesthetic, and daily utility based on visual cues in the photo.

### Key Highlights & Features
- 4-5 rich, detailed bullet points capturing key features, visible craftsmanship, materials/textures, ergonomic utility, styling versatility, or packaging details.

### Product Specifications
- **Category & Subcategory**: [Category / Subcategory]
- **Material & Build**: [Material / Finish / Texture / Build Quality]
- **Style & Fit**: [Fit / Aesthetic / Dimensions if applicable]
- **Best Suited For**: [Everyday use / Work / Gifting / Casual / Professional]
- **Care & Storage**: [Quick handling / wash / maintenance tip]

RULES:
- Do NOT output preamble, conversational remarks, or code fences (e.g. do not write ```markdown).
- Output ONLY the markdown description.
- Keep the entire output informative, complete, and strictly under 1,500 characters.
"""


def optimize_image_for_ai(image_bytes: bytes, max_dimension: int = 768) -> tuple[bytes, str]:
    """
    Downscales product photos to max 768px JPEG in-memory.
    Reduces upload payload to ~40-70KB and speeds up vision processing by ~3x
    while preserving product labels, barcodes, and texture details.
    """
    try:
        img = PILImage.open(io.BytesIO(image_bytes))
        if img.mode in ('RGBA', 'LA', 'P'):
            img = img.convert('RGB')

        w, h = img.size
        if max(w, h) > max_dimension:
            if w > h:
                new_w = max_dimension
                new_h = int(h * (max_dimension / w))
            else:
                new_h = max_dimension
                new_w = int(w * (max_dimension / h))
            img = img.resize((new_w, new_h), PILImage.Resampling.BILINEAR)

        out_buffer = io.BytesIO()
        img.save(out_buffer, format='JPEG', quality=80, optimize=False)
        return out_buffer.getvalue(), 'image/jpeg'
    except Exception as e:
        logger.warning(f"Image optimization fallback: {e}")
        return image_bytes, 'image/jpeg'


def generate_product_description(
    image_bytes: bytes,
    mime_type: str,
    item_data: Dict[str, Any],
    custom_api_keys: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Generates a structured, SEO-friendly e-commerce product description from an image and item metadata.
    Supports multi-API-key rotation across rate limits and model fallbacks.
    Strictly enforces maximum length under 1000 characters.
    """
    # 1. Build Key Pool (Custom keys + Environment GEMINI_API_KEYS / GOOGLE_API_KEY)
    key_pool = []
    if custom_api_keys:
        for k in custom_api_keys:
            if isinstance(k, str) and k.strip() and k.strip() not in key_pool:
                key_pool.append(k.strip())

    for k in get_configured_gemini_api_keys():
        if k not in key_pool:
            key_pool.append(k)

    if not key_pool:
        raise ValueError(
            "No Gemini API keys configured. Please add an active Gemini API key in Settings -> Gemini AI tab or configure GEMINI_API_KEYS in backend/.env."
        )

    # 2. Optimize image payload
    opt_bytes, opt_mime = optimize_image_for_ai(image_bytes)
    b64_image = base64.b64encode(opt_bytes).decode('utf-8')

    # 3. Construct prompt
    item_name = str(item_data.get('name', 'Product')).strip()
    category_name = str(item_data.get('category_name', '')).strip()
    subcategory_name = str(item_data.get('subcategory_name', '')).strip()
    price = item_data.get('selling_price', '')
    mrp = item_data.get('mrp', '')

    meta_text = f"Product Title: {item_name}\n"
    if category_name:
        meta_text += f"Category: {category_name}\n"
    if subcategory_name:
        meta_text += f"Subcategory: {subcategory_name}\n"
    if price:
        meta_text += f"Selling Price: ₹{price}\n"
    if mrp:
        meta_text += f"MRP: ₹{mrp}\n"

    parts = [
        {
            "inline_data": {
                "mime_type": opt_mime,
                "data": b64_image
            }
        },
        {
            "text": f"{PRODUCT_DESCRIPTION_SYSTEM_PROMPT}\n\nPRODUCT METADATA:\n{meta_text}\n\nGenerate the complete, informative, and high-converting product description in clean Markdown now (target ~1,200 characters, strictly under 1,500 characters total):"
        }
    ]

    # 4. Execute with Key Rotation (Strict limit: max 3 failed generation attempts total per run)
    MAX_ATTEMPTS = 3
    attempts = 0
    last_error = None
    has_daily_quota_error = False
    has_minute_rate_limit_error = False

    for key_idx, current_key in enumerate(key_pool):
        if attempts >= MAX_ATTEMPTS:
            break
        for model_name in GEMINI_MODELS:
            if attempts >= MAX_ATTEMPTS:
                break
            try:
                logger.info(f"Generating product description with key [{key_idx + 1}/{len(key_pool)}] model {model_name} (Attempt {attempts + 1}/{MAX_ATTEMPTS})")
                res_json = call_gemini_api(
                    api_key=current_key,
                    parts=parts,
                    model=model_name,
                    timeout=18,
                    response_mime_type=None,
                    temperature=0.3,
                    max_output_tokens=700
                )

                candidates = res_json.get('candidates', [])
                if candidates and candidates[0].get('content', {}).get('parts'):
                    generated_text = candidates[0]['content']['parts'][0].get('text', '').strip()
                    # Strip any accidental ```markdown wrapper if present
                    if generated_text.startswith('```markdown'):
                        generated_text = generated_text[len('```markdown'):].strip()
                    if generated_text.startswith('```'):
                        generated_text = generated_text[3:].strip()
                    if generated_text.endswith('```'):
                        generated_text = generated_text[:-3].strip()

                    if not generated_text:
                        # Model returned empty text (e.g. max tokens exhausted on thinking)
                        logger.warning(f"Model {model_name} returned empty text, trying next model...")
                        attempts += 1
                        continue

                    # If output ever exceeds 1500 characters, cleanly trim at sentence boundary without extra HTTP calls
                    if len(generated_text) > 1500:
                        trimmed = generated_text[:1490]
                        last_period = max(trimmed.rfind('.'), trimmed.rfind('\n'))
                        if last_period > 1000:
                            generated_text = trimmed[:last_period + 1]
                        else:
                            generated_text = trimmed + "..."

                    return {
                        "success": True,
                        "description": generated_text,
                        "model_used": model_name,
                        "key_index": key_idx + 1
                    }

            except urllib.error.HTTPError as http_err:
                last_error = http_err
                err_detail = ""
                try:
                    err_detail = http_err.read().decode('utf-8')
                except Exception:
                    pass

                if http_err.code in (429, 403):
                    attempts += 1
                    err_str_lower = (err_detail or http_err.reason or "").lower()
                    is_daily = any(phrase in err_str_lower for phrase in [
                        "per day", "requests per day", "per-day", "daily", "day limit",
                        "generate content api requests per day"
                    ])
                    if is_daily:
                        has_daily_quota_error = True
                    else:
                        has_minute_rate_limit_error = True

                    logger.warning(f"Key {key_idx + 1} quota limit (HTTP {http_err.code}, is_daily={is_daily}). Rotating to next key...")
                    break
                elif http_err.code in (404, 503, 502, 504):
                    # Model not available or temporary server load on this endpoint, try next model in cascade
                    logger.warning(f"Model {model_name} unavailable (HTTP {http_err.code}). Trying next model in cascade...")
                    continue
                elif http_err.code == 400:
                    attempts += 1
                    logger.warning(f"Gemini API error 400: {http_err.reason}. Trying next key...")
                    break
                else:
                    logger.warning(f"Gemini API error {http_err.code}: {http_err.reason}. Trying next model...")
                    continue
            except Exception as e:
                last_error = e
                logger.warning(f"Gemini connection error on model {model_name}: {e}. Trying next model...")
                continue
        else:
            # All models on this key were attempted without success
            attempts += 1

    if has_daily_quota_error:
        raise GeminiRateLimitError(
            "Daily AI quota exhausted across all configured API keys. You can resume tomorrow or add another free Gemini API key in Settings.",
            is_daily=True,
            raw_error=str(last_error)
        )
    elif has_minute_rate_limit_error:
        raise GeminiRateLimitError(
            "Minute rate limit reached across all API keys (15 RPM). Pausing generation for 60 seconds before resuming...",
            is_daily=False,
            raw_error=str(last_error)
        )

    err_msg = str(last_error) if last_error else ""
    if "429" in err_msg or "Quota" in err_msg or "RESOURCE_EXHAUSTED" in err_msg:
        raise GeminiRateLimitError(
            "Gemini API rate limit or quota exceeded on available keys.",
            is_daily=False,
            raw_error=err_msg
        )
    elif "400" in err_msg or "Invalid" in err_msg or "API_KEY_INVALID" in err_msg:
        reason = "Invalid API key or unreadable image format."
    elif err_msg:
        reason = err_msg
    else:
        reason = "Could not establish connection to Gemini API servers. Please verify network connectivity and API keys in Settings."

    raise ValueError(f"Generation stopped after {attempts} attempt(s): {reason}")


# ============================================================================
# AI PRODUCT NAME GENERATION ENGINE (E-COMMERCE / WEBSITE READY)
# ============================================================================

PRODUCT_NAME_SYSTEM_PROMPT = """
You are an expert e-commerce catalog specialist and brand merchandising editor.

TASK:
Analyze the provided product image and existing catalog details (such as current internal name, description notes, category, specifications) to generate an attractive, high-converting, professional, and SEO-optimized e-commerce Product Title for an online storefront.

NAMING CONVENTIONS & GUIDELINES:
1. Product Title Formula:
   [Brand / Brand Style if evident] + [Core Product Identity] + [Key Defining Features / Materials / Color / Variant] + [Pack / Size / Net Qty if applicable]
   - Example (messy name "BLU DEN JKT" or "jacket 42"): "Men's Classic Slim-Fit Denim Jacket with Washed Finish"
   - Example (messy name "BOTTLE-750"): "Stainless Steel Double-Wall Vacuum Insulated Water Bottle (750ml)"
   - Example (messy name "CUSH CV 2P"): "Boho Tufted Cotton Decorative Cushion Covers (Pack of 2)"
   - Example (messy name "KIDS TOY CAR"): "Die-Cast Pull-Back Racing Toy Car with Light & Sound Effects"

2. Upgrading Weak Names:
   - Expand shorthand abbreviations, vendor catalog codes, smudged OCR artifacts, or vague 1-word names.
   - Look at the actual photo: verify visible color, pattern, material (wood, ceramic, cotton, leather, steel), utility, and silhouette.
   - If existing description notes or category provide helpful context, utilize them.

3. Conciseness & Clarity:
   - Target length: 4 to 12 words (approx. 35 to 80 characters, strictly maximum 120 characters).
   - Natural, clean title case (e.g. "Wireless Bluetooth Over-Ear Headphones with Deep Bass").
   - Do NOT include promotional gimmicks (no "HOT DEAL", "CHEAP", "BEST PRICE", "100% ORIGINAL").
   - Output ONLY the single final product title as plain text. No quotes, no markdown headers, no preamble, no bullets.
"""


def generate_product_name(
    image_bytes: bytes,
    mime_type: str,
    item_data: Dict[str, Any],
    custom_api_keys: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Generates an SEO-optimized, attractive e-commerce product name from an image and item metadata.
    Supports multi-API-key rotation across rate limits and model fallbacks.
    Strictly enforces concise output under 150 characters.
    """
    key_pool = []
    if custom_api_keys:
        for k in custom_api_keys:
            if isinstance(k, str) and k.strip() and k.strip() not in key_pool:
                key_pool.append(k.strip())

    for k in get_configured_gemini_api_keys():
        if k not in key_pool:
            key_pool.append(k)

    if not key_pool:
        raise ValueError(
            "No Gemini API keys configured. Please add an active Gemini API key in Settings -> Gemini AI tab or configure GEMINI_API_KEYS in backend/.env."
        )

    opt_bytes, opt_mime = optimize_image_for_ai(image_bytes)
    b64_image = base64.b64encode(opt_bytes).decode('utf-8')

    current_name = str(item_data.get('name', '')).strip()
    category_name = str(item_data.get('category_name', '')).strip()
    subcategory_name = str(item_data.get('subcategory_name', '')).strip()
    existing_desc = str(item_data.get('description', '')).strip()
    price = item_data.get('selling_price', '')
    mrp = item_data.get('mrp', '')

    meta_text = ""
    if current_name:
        meta_text += f"Current / Internal Name: {current_name}\n"
    if category_name:
        meta_text += f"Category: {category_name}\n"
    if subcategory_name:
        meta_text += f"Subcategory: {subcategory_name}\n"
    if existing_desc:
        meta_text += f"Existing Description / Notes: {existing_desc[:300]}\n"
    if price:
        meta_text += f"Selling Price: ₹{price}\n"
    if mrp:
        meta_text += f"MRP: ₹{mrp}\n"

    parts = [
        {
            "inline_data": {
                "mime_type": opt_mime,
                "data": b64_image
            }
        },
        {
            "text": f"{PRODUCT_NAME_SYSTEM_PROMPT}\n\nPRODUCT DETAILS:\n{meta_text}\n\nGenerate the single polished e-commerce product title now (plain text only, strictly under 100 characters):"
        }
    ]

    MAX_ATTEMPTS = 3
    attempts = 0
    last_error = None
    has_daily_quota_error = False

    for key_idx, current_key in enumerate(key_pool):
        if attempts >= MAX_ATTEMPTS:
            break
        for model_name in GEMINI_MODELS:
            if attempts >= MAX_ATTEMPTS:
                break
            try:
                logger.info(f"Generating product name with key [{key_idx + 1}/{len(key_pool)}] model {model_name} (Attempt {attempts + 1}/{MAX_ATTEMPTS})")
                res_json = call_gemini_api(
                    api_key=current_key,
                    parts=parts,
                    model=model_name,
                    timeout=12,
                    response_mime_type=None,
                    temperature=0.2,
                    max_output_tokens=80
                )

                candidates = res_json.get('candidates', [])
                if candidates and candidates[0].get('content', {}).get('parts'):
                    generated_name = candidates[0]['content']['parts'][0].get('text', '').strip()
                    for wrapper in ['```markdown', '```', '"', "'", '**', '#']:
                        generated_name = generated_name.replace(wrapper, '').strip()
                    lines = [ln.strip() for ln in generated_name.split('\n') if ln.strip()]
                    if lines:
                        generated_name = lines[0]
                    generated_name = re.sub(r'^(Product Title|Title|Name|Product Name)\s*:\s*', '', generated_name, flags=re.IGNORECASE).strip()

                    if not generated_name:
                        attempts += 1
                        continue

                    if len(generated_name) > 150:
                        generated_name = generated_name[:147] + '...'

                    return {
                        "success": True,
                        "name": generated_name,
                        "model_used": model_name,
                        "key_index": key_idx + 1
                    }

            except urllib.error.HTTPError as http_err:
                last_error = http_err
                err_detail = ""
                try:
                    err_detail = http_err.read().decode('utf-8')
                except Exception:
                    pass

                if http_err.code in (429, 403):
                    attempts += 1
                    err_str_lower = (err_detail or http_err.reason or "").lower()
                    is_daily = any(phrase in err_str_lower for phrase in [
                        'day', 'daily', 'quota exceeded', 'free_tier_requests_per_day', 'rpd',
                        'per day', 'requests per day', 'per-day', 'generate content api requests per day'
                    ])
                    if is_daily:
                        has_daily_quota_error = True
                        break
                    else:
                        logger.warning(f"Key {key_idx + 1} minute rate limit on {model_name}. Rotating...")
                        break
                elif http_err.code in (404, 503, 502, 504):
                    # Model not available or temporary Google server overload (503), cascade to next model without consuming an attempt
                    logger.warning(f"Model {model_name} temporarily unavailable or overloaded (HTTP {http_err.code}). Trying next model in cascade...")
                    continue
                elif http_err.code == 400:
                    attempts += 1
                    logger.warning(f"Gemini API error 400 on model {model_name}: {http_err.reason}. Trying next key...")
                    break
                else:
                    logger.warning(f"Gemini API error {http_err.code} on model {model_name}: {http_err.reason}. Trying next model...")
                    continue

            except Exception as e:
                last_error = e
                logger.warning(f"Gemini connection error on model {model_name}: {e}. Trying next model...")
                continue
        else:
            # All models on this key were attempted without success
            attempts += 1

    if has_daily_quota_error:
        raise GeminiRateLimitError(
            "Daily AI generation quota exhausted across all configured Gemini API keys. Please try again tomorrow or add a new free API key in Settings.",
            is_daily=True,
            raw_error=str(last_error)
        )

    err_msg = str(last_error) if last_error else ""
    if "429" in err_msg or "Quota" in err_msg or "RESOURCE_EXHAUSTED" in err_msg:
        raise GeminiRateLimitError(
            "Gemini API rate limit or quota exceeded on available keys.",
            is_daily=False,
            raw_error=err_msg
        )
    raise ValueError(f"Name generation stopped after {attempts} attempt(s): {err_msg or 'Could not generate product name.'}")



def process_ai_description_batch_job(job_id: str, custom_api_keys: Optional[List[str]] = None) -> None:
    """
    Background worker that runs asynchronously on the server.
    Iterates through all item IDs in the job, inspects photos, generates descriptions,
    and updates both the Item draft fields and the AIDescriptionBatchJob status in real time.
    Handles per-minute rate limit pauses (60s cooldown) and daily quota terminations gracefully.
    """
    import time
    from .models import Item, AIDescriptionBatchJob

    try:
        job = AIDescriptionBatchJob.objects.get(id=job_id)
    except AIDescriptionBatchJob.DoesNotExist:
        logger.error(f"AIDescriptionBatchJob {job_id} not found.")
        return

    job.status = AIDescriptionBatchJob.STATUS_RUNNING
    job.status_message = ''
    job.save(update_fields=['status', 'status_message', 'updated_at'])

    item_pks = job.item_ids or []
    gen_name_pks = set(job.generate_name_ids or [])
    idx = 0
    consecutive_errors = 0
    consecutive_rate_limits = 0
    MAX_CONSECUTIVE_ERRORS = 5
    MAX_CONSECUTIVE_RATE_LIMITS = 3

    while idx < len(item_pks):
        pk = item_pks[idx]
        try:
            # Check if job was cancelled externally
            current_job_state = AIDescriptionBatchJob.objects.filter(id=job_id).only('status').first()
            if not current_job_state or current_job_state.status == AIDescriptionBatchJob.STATUS_CANCELLED:
                logger.info(f"Job {job_id} was cancelled, terminating worker.")
                return

            item = Item.objects.filter(pk=pk).first()
            if not item:
                job.failed_items += 1
                job.save(update_fields=['failed_items', 'updated_at'])
                idx += 1
                continue

            primary_img = item.primary_image
            if not primary_img or not primary_img.image:
                item.ai_description_status = 'skipped_no_image'
                item.ai_description_error = 'No product image uploaded'
                if pk in gen_name_pks or item.needs_better_name:
                    item.ai_name_status = 'skipped_no_image'
                    item.ai_name_error = 'No product image uploaded'
                    item.save(update_fields=['ai_description_status', 'ai_description_error', 'ai_name_status', 'ai_name_error'])
                else:
                    item.save(update_fields=['ai_description_status', 'ai_description_error'])
                job.skipped_items += 1
                job.save(update_fields=['skipped_items', 'updated_at'])
                idx += 1
                continue

            # Read image data
            try:
                img_file = primary_img.image.open('rb')
                img_bytes = img_file.read()
                img_file.close()
            except Exception as file_err:
                item.ai_description_status = 'failed'
                item.ai_description_error = f"Failed to read image file: {str(file_err)}"
                if pk in gen_name_pks or item.needs_better_name:
                    item.ai_name_status = 'failed'
                    item.ai_name_error = f"Failed to read image file: {str(file_err)}"
                    item.save(update_fields=['ai_description_status', 'ai_description_error', 'ai_name_status', 'ai_name_error'])
                else:
                    item.save(update_fields=['ai_description_status', 'ai_description_error'])
                job.failed_items += 1
                job.save(update_fields=['failed_items', 'updated_at'])
                idx += 1
                continue

            # Prepare metadata
            cat_name = item.effective_primary_category.name if item.effective_primary_category else ''
            subcat_name = item.effective_primary_subcategory.name if item.effective_primary_subcategory else ''

            item_data = {
                'name': item.name,
                'category_name': cat_name,
                'subcategory_name': subcat_name,
                'description': item.description,
                'selling_price': str(item.selling_price),
                'mrp': str(item.mrp) if item.mrp else ''
            }

            # If product is flagged for an upgraded name, generate name first!
            should_generate_name = (pk in gen_name_pks) or item.needs_better_name
            if should_generate_name:
                item.ai_name_status = 'generating'
                item.save(update_fields=['ai_name_status'])
                try:
                    name_res = generate_product_name(
                        image_bytes=img_bytes,
                        mime_type='image/jpeg',
                        item_data=item_data,
                        custom_api_keys=custom_api_keys
                    )
                    if name_res.get('success') and name_res.get('name'):
                        clean_name = name_res['name'].strip()
                        item.ai_name_draft = clean_name
                        item.ai_name_status = 'ready'
                        item.ai_name_error = ''
                        item.ai_name_updated_at = timezone.now()
                        item.save(update_fields=['ai_name_draft', 'ai_name_status', 'ai_name_error', 'ai_name_updated_at'])
                        # Use the new generated name for generating the description!
                        item_data['name'] = clean_name
                except Exception as name_err:
                    logger.warning(f"AI Name generation failed for item {pk}: {name_err}")
                    item.ai_name_status = 'failed'
                    item.ai_name_error = str(name_err)
                    item.save(update_fields=['ai_name_status', 'ai_name_error'])

            # Mark item as actively generating description in progress
            item.ai_description_status = 'generating'
            item.save(update_fields=['ai_description_status'])

            # Generate via Gemini
            gen_res = generate_product_description(
                image_bytes=img_bytes,
                mime_type='image/jpeg',
                item_data=item_data,
                custom_api_keys=custom_api_keys
            )

            if gen_res.get('success') and gen_res.get('description'):
                item.ai_description_draft = gen_res['description']
                item.ai_description_status = 'ready'
                item.ai_description_error = ''
                item.ai_description_updated_at = timezone.now()
                item.save(update_fields=[
                    'ai_description_draft',
                    'ai_description_status',
                    'ai_description_error',
                    'ai_description_updated_at'
                ])
                job.completed_items += 1
                job.status_message = ''
                job.save(update_fields=['completed_items', 'status_message', 'updated_at'])
                idx += 1
                consecutive_errors = 0
                consecutive_rate_limits = 0
                # Small pause to smooth request cadence
                time.sleep(0.4)
            else:
                item.ai_description_status = 'failed'
                item.ai_description_error = 'Model returned empty response'
                item.save(update_fields=['ai_description_status', 'ai_description_error'])
                job.failed_items += 1
                job.save(update_fields=['failed_items', 'updated_at'])
                idx += 1
                consecutive_errors += 1

        except GeminiRateLimitError as rate_err:
            logger.warning(f"Rate limit encountered on batch job {job_id}: {rate_err.message} (is_daily={rate_err.is_daily})")
            if rate_err.is_daily:
                # Daily quota exhausted: halt immediately to prevent credit waste
                daily_msg = "Daily AI quota exhausted. Generation halted to protect your credits. You can resume tomorrow or add another free Gemini API key in Settings."
                job.status_message = daily_msg

                # Mark remaining queued items as failed with clear notice
                remaining_pks = item_pks[idx:]
                for rem_pk in remaining_pks:
                    try:
                        Item.objects.filter(pk=rem_pk).exclude(ai_description_status__in=['ready', 'applied']).update(
                            ai_description_status='failed',
                            ai_description_error=daily_msg
                        )
                        job.failed_items += 1
                    except Exception:
                        pass

                job.status = AIDescriptionBatchJob.STATUS_COMPLETED
                job.save(update_fields=['status', 'status_message', 'failed_items', 'updated_at'])
                logger.info(f"AIDescriptionBatchJob {job_id} halted due to daily quota exhaustion.")
                return
            else:
                consecutive_rate_limits += 1
                if consecutive_rate_limits >= MAX_CONSECUTIVE_RATE_LIMITS:
                    # Repeated rate limit hits - stop loop properly rather than getting stuck indefinitely
                    rate_limit_halt_msg = f"Repeated rate limits reached across keys ({consecutive_rate_limits} pauses). Halted to preserve quota/credits. Please check keys or resume later."
                    job.status_message = rate_limit_halt_msg

                    remaining_pks = item_pks[idx:]
                    for rem_pk in remaining_pks:
                        try:
                            Item.objects.filter(pk=rem_pk).exclude(ai_description_status__in=['ready', 'applied']).update(
                                ai_description_status='failed',
                                ai_description_error=rate_limit_halt_msg
                            )
                            job.failed_items += 1
                        except Exception:
                            pass

                    job.status = AIDescriptionBatchJob.STATUS_COMPLETED
                    job.save(update_fields=['status', 'status_message', 'failed_items', 'updated_at'])
                    logger.info(f"AIDescriptionBatchJob {job_id} halted after reaching max rate limit pause retries.")
                    return

                # Per-minute rate limit: pause for 60 seconds
                pause_msg = f"Minute rate limit reached. Paused for 60s (Attempt {consecutive_rate_limits}/{MAX_CONSECUTIVE_RATE_LIMITS})..."
                job.status_message = pause_msg
                job.save(update_fields=['status_message', 'updated_at'])
                logger.info(f"AIDescriptionBatchJob {job_id} paused for 60s due to per-minute rate limit.")
                time.sleep(60)

                # Clear pause message and retry
                job.status_message = "Resuming AI generation..."
                job.save(update_fields=['status_message', 'updated_at'])
                continue

        except Exception as item_err:
            logger.error(f"Error generating description for item {pk}: {item_err}")
            try:
                Item.objects.filter(pk=pk).update(
                    ai_description_status='failed',
                    ai_description_error=str(item_err)
                )
            except Exception:
                pass
            job.failed_items += 1
            job.save(update_fields=['failed_items', 'updated_at'])
            idx += 1
            consecutive_errors += 1

            # Circuit breaker: if consecutive errors exceed threshold (e.g. invalid keys or broken images), halt cleanly
            if consecutive_errors >= MAX_CONSECUTIVE_ERRORS:
                halt_msg = f"AI Generation stopped automatically after {consecutive_errors} consecutive failures to preserve your API credits. Please check your Gemini API keys or network connection."
                job.status_message = halt_msg
                remaining_pks = item_pks[idx:]
                for rem_pk in remaining_pks:
                    try:
                        Item.objects.filter(pk=rem_pk).exclude(ai_description_status__in=['ready', 'applied']).update(
                            ai_description_status='failed',
                            ai_description_error=halt_msg
                        )
                        job.failed_items += 1
                    except Exception:
                        pass
                job.status = AIDescriptionBatchJob.STATUS_COMPLETED
                job.save(update_fields=['status', 'status_message', 'failed_items', 'updated_at'])
                logger.warning(f"AIDescriptionBatchJob {job_id} stopped cleanly due to circuit breaker ({consecutive_errors} consecutive failures).")
                return

    job.status = AIDescriptionBatchJob.STATUS_COMPLETED
    job.status_message = ''
    job.save(update_fields=['status', 'status_message', 'updated_at'])
    logger.info(f"AIDescriptionBatchJob {job_id} completed: {job.completed_items} ready, {job.skipped_items} skipped, {job.failed_items} failed.")


def start_background_batch_description_job(job_id: str, custom_api_keys: Optional[List[str]] = None) -> None:
    """Spawns an independent daemon thread to run the batch generation job."""
    t = threading.Thread(
        target=process_ai_description_batch_job,
        args=(job_id, custom_api_keys),
        daemon=True,
        name=f"AIDescriptionWorker-{job_id[:8]}"
    )
    t.start()


# =====================================================================
# HISTORICAL TALLY SHEET MULTI-BILL EXTRACTION & CATALOG VERIFICATION
# =====================================================================

HISTORICAL_SHEET_SYSTEM_PROMPT = """
You are an expert OCR and retail audit AI specializing in extracting daily handwritten sales register sheets, clipboard tally ledgers, and physical bill slips (including Indian retail formats in English, Hindi/Hinglish, and shorthand numbers).

SHEET LAYOUT & CONVENTIONS:
1. Multi-Bill Division: A single sheet contains MULTIPLE distinct customer sale transactions written sequentially, separated by horizontal dividing lines.
2. Columns:
   - "BARCODE" / "CODE": Product barcode number, numeric UID (e.g. "24439", "25461", "25092"), alphanumeric code (e.g. "BB24772", "BB24753"), or product name (e.g. "ORANGE BALL 23R", "MOON BALL 7CM", "Dart Mini").
   - "QNT": Quantity. Can be a single integer ("1", "2", "4") or a formula like "5 x 39", "2 x 99", "10 x 19" meaning {quantity} x {unit_price}.
   - "AMT": Total amount for that line item (e.g. "195", "198", "489").
   - "CASH", "UPI", "CARD": Columns with checkmarks (✓), ticks, or specific amount numbers indicating the payment method for that bill.
   - "MOBILE": Customer 10-digit mobile phone number (e.g. "9893042523", "9340456774", "9630316638", "7354825860").
3. Subtotals: Each customer bill group ends with an underlined total or written amount (e.g., "3106", "1124", "2850", "7131").

TASK:
Analyze the sheet image and extract EVERY distinct customer bill into a structured JSON array.
If an item quantity is written as "5 x 39", parse quantity = 5, unit_price = 39.00, total_price = 195.00.
If quantity is "1" and AMT is "289", parse quantity = 1, unit_price = 289.00, total_price = 289.00.
Extract the customer mobile phone number if written (clean 10 digits). If missing, set "".
Determine the payment method: "card", "cash", "upi", or "split".

OUTPUT FORMAT:
Return ONLY valid JSON matching this schema:
{
  "sheet_date": "YYYY-MM-DD or string or null",
  "sheet_section": "string or null",
  "bills": [
    {
      "bill_index": 1,
      "customer_phone": "10-digit string or ''",
      "payment_method": "cash | upi | card | split",
      "subtotal_written": "numeric string or null",
      "items": [
        {
          "barcode_or_code": "string",
          "raw_qnt_text": "string",
          "quantity": 1,
          "unit_price": "289.00",
          "total_price": "289.00"
        }
      ]
    }
  ]
}
"""


def extract_historical_sheet_bills(
    files_data: List[Dict[str, Any]],
    custom_prompt: Optional[str] = None,
    store_id: Optional[int] = None,
    custom_api_keys: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Multimodal OCR function for historical sales sheets:
    1. Extracts multi-bill groupings via Gemini Vision cascade.
    2. Cross-references every line item barcode against the store's Item inventory.
    3. Segregates bills into valid_bills (100% catalog match) and rejected_bills (missing items/anomalies).
    """
    from .models import Item
    from django.db.models import Q

    if not files_data or len(files_data) == 0:
        raise ValueError("No sheet images or documents provided for processing.")

    # 1. Build API key pool
    key_pool = []
    if custom_api_keys:
        for k in custom_api_keys:
            if isinstance(k, str) and k.strip() and k.strip() not in key_pool:
                key_pool.append(k.strip())
    for k in get_configured_gemini_api_keys():
        if k not in key_pool:
            key_pool.append(k)

    if not key_pool:
        raise GeminiRateLimitError("No Gemini API keys configured.", raw_error="Missing API keys.")

    # 2. Check for CSV files vs Image/PDF files
    csv_files = []
    media_files = []
    for f in files_data:
        fname = (f.get('name') or '').lower()
        fmime = (f.get('mime_type') or '').lower()
        if fname.endswith('.csv') or 'csv' in fmime:
            csv_files.append(f)
        else:
            media_files.append(f)

    successful_response = None
    used_model = ""

    # Helper: parse raw CSV text rows into structured bills format
    def parse_csv_to_raw_bills(raw_csv_bytes: bytes, user_prompt: Optional[str] = None) -> List[Dict[str, Any]]:
        import io
        import csv
        text_content = ""
        for encoding in ['utf-8-sig', 'utf-8', 'latin-1', 'cp1252']:
            try:
                text_content = raw_csv_bytes.decode(encoding)
                break
            except Exception:
                continue
        if not text_content:
            return []

        # Use csv reader
        reader = csv.reader(io.StringIO(text_content))
        rows = [r for r in reader if any(cell.strip() for cell in r)]
        if not rows:
            return []

        # Find header index row
        header_row_idx = 0
        best_match_count = 0
        known_kw = ['bill', 'invoice', 'barcode', 'code', 'item', 'name', 'qty', 'quantity', 'price', 'rate', 'amount', 'total', 'phone', 'mobile', 'payment']
        for r_idx, row in enumerate(rows[:5]):
            row_lower = [str(c).strip().lower() for c in row]
            match_count = sum(1 for kw in known_kw if any(kw in c for c in row_lower))
            if match_count > best_match_count:
                best_match_count = match_count
                header_row_idx = r_idx

        raw_headers = [str(c).strip().lower() for c in rows[header_row_idx]]
        data_rows = rows[header_row_idx + 1:]

        # Map header columns
        col_map = {}
        for idx, h in enumerate(raw_headers):
            clean_h = re.sub(r'[^a-z0-9]', '', h)
            if any(k in clean_h for k in ['billno', 'billid', 'billnum', 'bill', 'invoiceno', 'invoiceid', 'invoicenum', 'invoicenumber', 'receipt']):
                if 'bill_id' not in col_map: col_map['bill_id'] = idx
            elif any(k in clean_h for k in ['barcode', 'code', 'uid', 'sku', 'itemcode', 'productcode']):
                if 'code' not in col_map: col_map['code'] = idx
            elif any(k in clean_h for k in ['itemname', 'productname', 'item', 'product', 'title', 'description', 'name']):
                if 'name' not in col_map: col_map['name'] = idx
            elif any(k in clean_h for k in ['qty', 'quantity', 'qnt', 'count']):
                if 'qty' not in col_map: col_map['qty'] = idx
            elif any(k in clean_h for k in ['unitprice', 'sellingprice', 'rate', 'price', 'mrp']):
                if 'unit_price' not in col_map: col_map['unit_price'] = idx
            elif any(k in clean_h for k in ['totalprice', 'totalamount', 'total', 'amt', 'amount', 'linetotal', 'subtotal']):
                if 'total_price' not in col_map: col_map['total_price'] = idx
            elif any(k in clean_h for k in ['phone', 'mobile', 'customerphone', 'customermobile', 'contact']):
                if 'phone' not in col_map: col_map['phone'] = idx
            elif any(k in clean_h for k in ['paymentmethod', 'paymentmode', 'payment', 'mode', 'paymethod', 'type']):
                if 'payment' not in col_map: col_map['payment'] = idx

        # If code not mapped but name is mapped, use name as code fallback and vice versa
        if 'code' not in col_map and 'name' in col_map:
            col_map['code'] = col_map['name']
        elif 'code' in col_map and 'name' not in col_map:
            col_map['name'] = col_map['code']

        # Group data rows into bills
        # Grouping strategy: If 'bill_id' is present, group by bill_id.
        # Otherwise, treat each non-empty row as its own bill OR group consecutive rows until an empty separator.
        bills_map = {}
        current_implicit_bill = 1

        for r in data_rows:
            if not any(c.strip() for c in r):
                # Empty row acts as a bill boundary
                current_implicit_bill += 1
                continue

            bill_key = None
            if 'bill_id' in col_map and col_map['bill_id'] < len(r):
                val = r[col_map['bill_id']].strip()
                if val:
                    bill_key = val

            if not bill_key:
                bill_key = f"bill_{current_implicit_bill}"

            if bill_key not in bills_map:
                bills_map[bill_key] = {
                    'bill_index': len(bills_map) + 1,
                    'customer_phone': '',
                    'payment_method': 'cash',
                    'subtotal_written': None,
                    'items': []
                }

            # Extract phone
            if 'phone' in col_map and col_map['phone'] < len(r):
                raw_ph = r[col_map['phone']].strip()
                clean_ph = re.sub(r'\D', '', raw_ph)
                if len(clean_ph) == 10:
                    bills_map[bill_key]['customer_phone'] = clean_ph

            # Extract payment method
            if 'payment' in col_map and col_map['payment'] < len(r):
                raw_pm = r[col_map['payment']].strip().lower()
                if any(m in raw_pm for m in ['upi', 'gpay', 'phonepe', 'paytm']):
                    bills_map[bill_key]['payment_method'] = 'upi'
                elif any(m in raw_pm for m in ['card', 'debit', 'credit', 'pos']):
                    bills_map[bill_key]['payment_method'] = 'card'
                elif any(m in raw_pm for m in ['split', 'partial']):
                    bills_map[bill_key]['payment_method'] = 'split'
                elif 'cash' in raw_pm:
                    bills_map[bill_key]['payment_method'] = 'cash'

            # Extract item details
            raw_code = ''
            if 'code' in col_map and col_map['code'] < len(r):
                raw_code = r[col_map['code']].strip()
            elif 'name' in col_map and col_map['name'] < len(r):
                raw_code = r[col_map['name']].strip()

            if not raw_code:
                continue

            raw_qty = 1
            if 'qty' in col_map and col_map['qty'] < len(r):
                try:
                    q_val = re.sub(r'[^\d.]', '', r[col_map['qty']].strip())
                    if q_val:
                        raw_qty = max(1, int(float(q_val)))
                except Exception:
                    raw_qty = 1

            raw_unit_p = '0.00'
            if 'unit_price' in col_map and col_map['unit_price'] < len(r):
                try:
                    up_val = re.sub(r'[^\d.]', '', r[col_map['unit_price']].strip())
                    if up_val:
                        raw_unit_p = str(Decimal(up_val).quantize(Decimal('0.01')))
                except Exception:
                    pass

            raw_total_p = '0.00'
            if 'total_price' in col_map and col_map['total_price'] < len(r):
                try:
                    tp_val = re.sub(r'[^\d.]', '', r[col_map['total_price']].strip())
                    if tp_val:
                        raw_total_p = str(Decimal(tp_val).quantize(Decimal('0.01')))
                except Exception:
                    pass

            bills_map[bill_key]['items'].append({
                'barcode_or_code': raw_code,
                'raw_qnt_text': str(raw_qty),
                'quantity': raw_qty,
                'unit_price': raw_unit_p,
                'total_price': raw_total_p
            })

        # Filter out empty bills
        parsed_bills = [b for b in bills_map.values() if len(b['items']) > 0]
        # Re-index
        for idx, b in enumerate(parsed_bills):
            b['bill_index'] = idx + 1
        return parsed_bills

    # If CSV files are provided, try direct deterministic CSV parsing first
    csv_raw_bills = []
    if csv_files:
        for cf in csv_files:
            c_bytes = cf.get('bytes') or b''
            parsed = parse_csv_to_raw_bills(c_bytes, custom_prompt)
            csv_raw_bills.extend(parsed)

    # If media files are present OR direct CSV parsing produced nothing (e.g. unformatted text CSV), use Gemini
    if media_files or (csv_files and not csv_raw_bills):
        parts = []
        for f in media_files:
            raw_bytes = f.get('bytes')
            mime_type = f.get('mime_type', 'image/jpeg')
            if not raw_bytes:
                continue
            parts.append({
                "inline_data": {
                    "mime_type": mime_type,
                    "data": base64.b64encode(raw_bytes).decode('utf-8')
                }
            })

        # Also append CSV text content into prompt if Gemini is invoked
        csv_text_snippets = []
        if csv_files:
            for cf in csv_files:
                try:
                    txt = (cf.get('bytes') or b'').decode('utf-8-sig', errors='replace')
                    csv_text_snippets.append(f"--- CSV FILE: {cf.get('name', 'sheet.csv')} ---\n{txt}")
                except Exception:
                    pass

        # 3. Construct prompt with user's custom context
        prompt_text = HISTORICAL_SHEET_SYSTEM_PROMPT
        if csv_text_snippets:
            prompt_text += "\n\nCSV DATA SHEETS TO PARSE:\n" + "\n\n".join(csv_text_snippets)

        if custom_prompt and str(custom_prompt).strip():
            user_context = str(custom_prompt).strip()
            prompt_text += f"""

======================================================================
OPERATOR'S SPECIAL CONTEXT & GUIDANCE (HIGHEST PRIORITY):
======================================================================
"{user_context}"
======================================================================
"""

        parts.append({"text": prompt_text})

        # 4. Call Gemini with multi-key and multi-model rotation
        MAX_ATTEMPTS = 3
        attempts = 0

        for idx, key in enumerate(key_pool):
            if attempts >= MAX_ATTEMPTS or successful_response is not None:
                break
            for model in GEMINI_MODELS:
                if attempts >= MAX_ATTEMPTS or successful_response is not None:
                    break
                try:
                    raw_resp = call_gemini_api(key, parts, model=model)
                    candidates = raw_resp.get('candidates', [])
                    if candidates and candidates[0].get('content', {}).get('parts'):
                        raw_text = candidates[0]['content']['parts'][0].get('text', '{}').strip()
                        if raw_text.startswith('```json'):
                            raw_text = raw_text[7:]
                        if raw_text.startswith('```'):
                            raw_text = raw_text[3:]
                        if raw_text.endswith('```'):
                            raw_text = raw_text[:-3]

                        successful_response = json.loads(raw_text.strip())
                        used_model = model
                        break
                except Exception as e:
                    logger.warning(f"Gemini attempt failed on model {model}: {e}")
                    continue

    if csv_raw_bills and not successful_response:
        successful_response = {
            'bills': csv_raw_bills,
            'sheet_date': None,
            'sheet_section': 'CSV Import'
        }
        used_model = "CSV Direct Parser"
    elif csv_raw_bills and successful_response:
        # Merge CSV bills with OCR bills if both media and CSV were uploaded together
        existing_bills = successful_response.get('bills', [])
        offset = len(existing_bills)
        for b in csv_raw_bills:
            b['bill_index'] = offset + b['bill_index']
            existing_bills.append(b)
        successful_response['bills'] = existing_bills

    if not successful_response or not isinstance(successful_response, dict):
        raise ValueError("Failed to extract structured bills from uploaded file(s). Please verify file contents and clarity.")

    raw_bills = successful_response.get('bills', [])
    sheet_date = successful_response.get('sheet_date') or ''
    sheet_section = successful_response.get('sheet_section') or ''

    # 5. Catalog Verification Gate
    item_qs = Item.objects.all()
    if store_id:
        item_qs = item_qs.filter(Q(store_id=store_id) | Q(store__isnull=True))

    items_list = list(item_qs.only('id', 'uid', 'legacy_uid', 'name', 'selling_price', 'mrp', 'quantity'))
    uid_map: Dict[str, Any] = {}
    legacy_map: Dict[str, Any] = {}
    name_map: Dict[str, Any] = {}

    for it in items_list:
        if it.uid:
            uid_map[it.uid.strip().lower()] = it
        if it.legacy_uid:
            legacy_map[it.legacy_uid.strip().lower()] = it
        if it.name:
            name_map[it.name.strip().lower()] = it

    def find_catalog_item(raw_code: str):
        c = str(raw_code or '').strip().lower()
        if not c:
            return None
        if c in uid_map:
            return uid_map[c]
        if c in legacy_map:
            return legacy_map[c]
        if c in name_map:
            return name_map[c]
        # Clean special chars / spaces
        clean = re.sub(r'[^\w]', '', c)
        if clean and clean in uid_map:
            return uid_map[clean]
        # Fuzzy match on item title
        for n, it_obj in name_map.items():
            if len(c) >= 4 and (c in n or n in c):
                return it_obj
        return None

    valid_bills = []
    rejected_bills = []

    for idx, b in enumerate(raw_bills):
        b_idx = b.get('bill_index') or (idx + 1)
        raw_phone = re.sub(r'\D', '', str(b.get('customer_phone') or '').strip())
        cust_phone = raw_phone if len(raw_phone) == 10 else ''
        pay_method = str(b.get('payment_method') or 'cash').strip().lower()
        if pay_method not in ['cash', 'upi', 'card', 'split']:
            pay_method = 'cash'

        items_in_bill = b.get('items', [])
        verified_items = []
        anomalies = []
        anomalous_indices = []
        calc_total = Decimal('0.00')

        for item_idx, it_data in enumerate(items_in_bill):
            raw_code = str(it_data.get('barcode_or_code') or '').strip()
            qty = int(it_data.get('quantity') or 1)
            if qty <= 0:
                qty = 1

            try:
                unit_p = Decimal(str(it_data.get('unit_price') or '0.00')).quantize(Decimal('0.01'))
            except Exception:
                unit_p = Decimal('0.00')

            try:
                line_p = Decimal(str(it_data.get('total_price') or (unit_p * qty))).quantize(Decimal('0.01'))
            except Exception:
                line_p = (unit_p * qty).quantize(Decimal('0.01'))

            calc_total += line_p

            cat_item = find_catalog_item(raw_code)
            if cat_item:
                verified_items.append({
                    "item_id": cat_item.id,
                    "item_uid": cat_item.uid,
                    "item_name": cat_item.name,
                    "quantity": qty,
                    "unit_price": float(unit_p if unit_p > Decimal('0.00') else cat_item.selling_price),
                    "total_price": float(line_p if line_p > Decimal('0.00') else (cat_item.selling_price * qty)),
                    "catalog_selling_price": float(cat_item.selling_price),
                    "catalog_mrp": float(cat_item.effective_mrp),
                    "raw_code": raw_code,
                    "is_valid": True,
                    "error": None
                })
            else:
                anomalies.append(f"Barcode/Item '{raw_code}' not found in inventory catalog.")
                anomalous_indices.append(item_idx)
                verified_items.append({
                    "item_id": None,
                    "item_uid": raw_code,
                    "item_name": f"Unrecognized Item ({raw_code})",
                    "quantity": qty,
                    "unit_price": float(unit_p),
                    "total_price": float(line_p),
                    "catalog_selling_price": None,
                    "catalog_mrp": None,
                    "raw_code": raw_code,
                    "is_valid": False,
                    "error": f"Item code '{raw_code}' does not exist in inventory catalog"
                })

        # Written subtotal cross-check
        sub_written = None
        if b.get('subtotal_written'):
            try:
                sub_written = float(Decimal(str(b.get('subtotal_written'))).quantize(Decimal('0.01')))
            except Exception:
                pass

        bill_dict = {
            "bill_index": b_idx,
            "customer_phone": cust_phone,
            "payment_method": pay_method,
            "items": verified_items,
            "total_amount": float(calc_total),
            "subtotal_written": sub_written,
            "has_subtotal_variance": bool(sub_written and abs(Decimal(str(sub_written)) - calc_total) > Decimal('2.00')),
            "is_valid": (len(anomalies) == 0 and len(verified_items) > 0),
            "rejection_reasons": anomalies,
            "anomalous_indices": anomalous_indices,
            "status": "valid" if (len(anomalies) == 0 and len(verified_items) > 0) else "rejected"
        }

        if bill_dict["is_valid"]:
            valid_bills.append(bill_dict)
        else:
            rejected_bills.append(bill_dict)

    return {
        "sheet_date": sheet_date,
        "sheet_section": sheet_section,
        "total_bills_extracted": len(raw_bills),
        "valid_bills_count": len(valid_bills),
        "rejected_bills_count": len(rejected_bills),
        "valid_bills": valid_bills,
        "rejected_bills": rejected_bills,
        "used_model": used_model
    }

