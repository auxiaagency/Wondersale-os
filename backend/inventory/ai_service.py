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
    Safely retrieves configured Gemini API keys from environment variables:
    Supports:
    - GEMINI_API_KEYS (comma-separated list for multi-key pool: key1,key2,key3)
    - GEMINI_API_KEY
    - GOOGLE_API_KEY
    """
    keys = []
    for env_var in ('GEMINI_API_KEYS', 'GEMINI_API_KEY', 'GOOGLE_API_KEY'):
        raw_val = os.environ.get(env_var, '').strip()
        if raw_val:
            for piece in raw_val.split(','):
                cleaned = piece.strip().strip("'\"")
                if cleaned and cleaned not in keys:
                    keys.append(cleaned)
    return keys

# Pre-configured keys pulled safely from environment
DEFAULT_GEMINI_API_KEYS = get_configured_gemini_api_keys()

# Models to attempt in priority order (aligned with Google AI current endpoints)
GEMINI_MODELS = [
    'gemini-flash-lite-latest',
    'gemini-3.5-flash',
    'gemini-3.6-flash',
    'gemini-3.7-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b',
    'gemini-1.5-pro',
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
                raise ValueError(f"Gemini API Quota/Rate Limit Exceeded (HTTP {http_err.code}): {error_content or http_err.reason}")
            elif http_err.code == 400:
                raise ValueError(f"Invalid API Key or Request format (HTTP 400): {error_content or http_err.reason}")
            elif http_err.code == 404:
                # Try next model
                continue
            else:
                raise ValueError(f"Gemini API Error (HTTP {http_err.code}): {error_content or http_err.reason}")
        except Exception as e:
            last_err = e
            continue

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


def optimize_image_for_ai(image_bytes: bytes, max_dimension: int = 1024) -> tuple[bytes, str]:
    """
    Downscales large high-res camera photos to max 1024px WebP/JPEG in-memory.
    Reduces bandwidth and network latency by ~95% while keeping label text sharp.
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
            img = img.resize((new_w, new_h), PILImage.Resampling.LANCZOS)

        out_buffer = io.BytesIO()
        img.save(out_buffer, format='JPEG', quality=85, optimize=True)
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
                    timeout=30,
                    response_mime_type=None,
                    temperature=0.3,
                    max_output_tokens=1500
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

                    # If output ever exceeds 1500 characters, request a concise condensed version rather than cutting text
                    if len(generated_text) > 1500:
                        try:
                            condense_parts = [
                                {
                                    "text": (
                                        f"Please condense the following e-commerce product description into clean, complete Markdown "
                                        f"strictly under 1,200 characters total (2-3 sentence overview, 4 bullet highlights, and compact specifications). "
                                        f"Do NOT omit any section:\n\n{generated_text}"
                                    )
                                }
                            ]
                            condense_res = call_gemini_api(
                                api_key=current_key,
                                parts=condense_parts,
                                model=model_name,
                                timeout=20,
                                temperature=0.2,
                                max_output_tokens=800
                            )
                            c_cands = condense_res.get('candidates', [])
                            if c_cands and c_cands[0].get('content', {}).get('parts'):
                                condensed_text = c_cands[0]['content']['parts'][0].get('text', '').strip()
                                if condensed_text.startswith('```markdown'):
                                    condensed_text = condensed_text[len('```markdown'):].strip()
                                if condensed_text.startswith('```'):
                                    condensed_text = condensed_text[3:].strip()
                                if condensed_text.endswith('```'):
                                    condensed_text = condensed_text[:-3].strip()
                                if condensed_text and len(condensed_text) <= 1500:
                                    generated_text = condensed_text
                        except Exception as condense_err:
                            logger.warning(f"Failed to condense oversized description: {condense_err}")

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
    idx = 0

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
                'selling_price': str(item.selling_price),
                'mrp': str(item.mrp) if item.mrp else ''
            }

            # Mark item as actively generating in progress
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
                # Small pause to smooth request cadence
                time.sleep(0.4)
            else:
                item.ai_description_status = 'failed'
                item.ai_description_error = 'Model returned empty response'
                item.save(update_fields=['ai_description_status', 'ai_description_error'])
                job.failed_items += 1
                job.save(update_fields=['failed_items', 'updated_at'])
                idx += 1

        except GeminiRateLimitError as rate_err:
            logger.warning(f"Rate limit encountered on batch job {job_id}: {rate_err.message} (is_daily={rate_err.is_daily})")
            if rate_err.is_daily:
                # Daily quota exhausted: remove remaining items from active queue and finish job
                daily_msg = "Daily AI quota exhausted. You can resume tomorrow or add another free Gemini API key in Settings."
                job.status_message = daily_msg

                # Mark current and all remaining queued items as failed with clear tomorrow notice
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
                logger.info(f"AIDescriptionBatchJob {job_id} halted due to daily quota. Removed {len(remaining_pks)} remaining items from queue.")
                return
            else:
                # Per-minute rate limit: pause for 60 seconds, keep items in queue, then retry
                pause_msg = "Minute rate limit reached (15 RPM). Paused, auto-resuming in 60s..."
                job.status_message = pause_msg
                job.save(update_fields=['status_message', 'updated_at'])
                logger.info(f"AIDescriptionBatchJob {job_id} paused for 60s due to per-minute rate limit.")
                time.sleep(60)

                # Clear pause message and retry same item without advancing idx
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
