"""
Modular prompt builder and output parser for Wondersale OS catalog Vision AI
(Qwen2.5-VL 7B via local pull worker).

Kept strictly separate from claim/complete transport logic and from Gemini OCR
pipelines so catalog prompting rules (description-only, name-only, multi-photo /
multi-design variants, quantity/size token preservation) can evolve independently.
"""

import json
import re
from typing import Any, Dict, List, Optional


DEFAULT_VISION_MODEL = "qwen2.5vl:7b"

CATALOG_DESCRIPTION_STYLE_EXAMPLE = """### Overview
Unleash your creative potential with this premium 60-piece Acrylic Marker Drum, designed for artists, students, and hobbyists alike. Featuring a sleek, portable bucket design adorned with vibrant cat-themed artwork, this set combines professional-grade pigment quality with convenient storage, making it the perfect companion for all your artistic endeavors.

### Key Highlights & Features
- **Extensive Color Palette**: Includes 60 rich, high-pigment acrylic markers that provide smooth, opaque coverage on various surfaces including paper, canvas, wood, and stone.
- **Durable Drum Storage**: The sturdy, handle-equipped bucket ensures your markers remain organized, protected, and easily transportable for on-the-go creativity.
- **Versatile Application**: Ideal for detailed illustrations, bold lettering, DIY craft projects, and school assignments, offering consistent ink flow for every stroke.
- **User-Friendly Design**: Each marker is crafted for comfort, allowing for long-duration drawing sessions without hand fatigue.

### Product Specifications
- **Category & Subcategory**: Toys & Kids / Stationary
- **Material & Build**: High-density plastic storage drum; premium acrylic ink markers
- **Style & Fit**: Modern, vibrant aesthetic with a space-saving cylindrical design
- **Best Suited For**: Artistic projects, school assignments, DIY crafts, and gifting"""


_BASE_SYSTEM_RULES = (
    "You are an expert e-commerce catalog merchandiser for an Indian retail & online store (Wondersale). "
    "Analyze the provided product photograph(s) and metadata carefully. "
    "Describe only physical attributes, materials, colors, counts, and features clearly supported by the image or metadata. "
    "Do NOT invent unsupported claims or promotional hype (no 'HOT DEAL', 'CHEAP', 'BEST PRICE', or '100% ORIGINAL'). "
    "Respond ONLY with a valid JSON object matching the requested schema, with no extra commentary."
)


def _format_item_context(item_data: Dict[str, Any]) -> str:
    """Formats product metadata into a concise context block for the prompt."""
    lines: List[str] = []
    name = str(item_data.get("name") or "").strip()
    category_name = str(item_data.get("category_name") or "").strip()
    subcategory_name = str(item_data.get("subcategory_name") or "").strip()
    existing_desc = str(item_data.get("description") or "").strip()
    selling_price = str(item_data.get("selling_price") or "").strip()
    mrp = str(item_data.get("mrp") or "").strip()
    weight = str(item_data.get("weight") or "").strip()
    variant_names = item_data.get("variant_names") or []

    if name:
        lines.append(f"Original Name: {name}")
    if category_name or subcategory_name:
        cat_display = " / ".join([p for p in (category_name, subcategory_name) if p])
        lines.append(f"Category & Subcategory: {cat_display}")
    if selling_price:
        lines.append(f"Selling Price: INR {selling_price}")
    if mrp:
        lines.append(f"MRP: INR {mrp}")
    if weight:
        lines.append(f"Weight (g): {weight}")
    if variant_names:
        lines.append(f"Design Variants: {', '.join(str(v) for v in variant_names if v)}")

    selling_unit = str(item_data.get("selling_unit") or "").strip()
    is_multi_design = bool(item_data.get("is_multi_design", False))
    image_count = int(item_data.get("image_count", 1) or 1)

    if selling_unit:
        lines.append(f"Selling Unit: {selling_unit}")
    elif is_multi_design or image_count > 1:
        lines.append("Selling Unit: 1 piece (photo shows design variations)")
    else:
        lines.append("Selling Unit: 1 piece")

    if is_multi_design:
        lines.append("Multi-Design Product: Yes (multiple variations exist — use a general product-type name)")
    if image_count > 1:
        lines.append(f"Product Photos: {image_count} photo(s) provided — if multiple designs shown, they are assorted variants of the SAME product.")

    return "\n".join(lines) if lines else "No additional metadata provided."


def _name_rules_block() -> str:
    return (
        'For "name":\n'
        "- Write a simple, clear, descriptive e-commerce product title (4 to 12 words, under 120 characters, clean Title Case).\n"
        "- Expand shorthand codes/abbreviations using visual evidence from the photo (material, color, style, product type).\n"
        "- CRITICAL — Spec Preservation: Preserve any original quantity, piece count, pack size, volume, weight, and dimension. "
        "Keep all exact quantities, sizes, weights, and capacities from Original Name (e.g., 60pcs, 500ml, 12-inch, Size L, Pack of 3) in the new name. Never drop them.\n"
        "- CRITICAL — DO NOT INVENT QUANTITIES / PACKS / SETS: If Original Name does NOT state a pack size, count, or set (e.g. it does NOT say 'Set of 4', 'Pack of 6', '4pcs'), "
        "you MUST NEVER invent or add 'Set of N', 'Pack of N', 'N Pcs', or 'N Pieces' to the product name. "
        "Even if the photo shows multiple items or pieces, they are solely design/variant references for a single unit. Never count items in the photo to create a set title unless Original Name explicitly specifies it.\n"
        "- CRITICAL — Multi-Design Rule: If multiple photos or design variations are shown, write a GENERAL product-type title "
        "that fits ALL designs (e.g. 'Traditional Chinese Figurine' or 'Cartoon Doll Keychain' not 'Set of 4 Figurines' or 'Pink Dress Doll Keychain'). Do NOT name a specific color/design.\n"
        "- Plain text only (no quotes, no markdown, no emojis)."
    )


def _description_rules_block() -> str:
    return (
        'For "description":\n'
        "- Output rich, high-converting Markdown strictly under 1,500 characters (target ~900–1,250 characters) without outer ```markdown code fences.\n"
        "- MUST follow this EXACT 3-section Markdown structure with all 3 section headings present:\n\n"
        f"{CATALOG_DESCRIPTION_STYLE_EXAMPLE}\n\n"
        "- DO NOT output a single plain paragraph. The description MUST include all 3 sections: '### Overview', '### Key Highlights & Features' (with 4-5 bullet points), and '### Product Specifications'.\n"
        "- CRITICAL — Selling Unit Rule: Write the title and description strictly for the specified Selling Unit in the metadata. "
        "If Selling Unit is '1 piece' or Original Name has no set/pack count, treat extra items in the photo as design reference only and do NOT call it a set or pack.\n"
        "- CRITICAL — Multi-Design Rule: If is_multi_design is true or multiple design variants exist, write description for the product TYPE. "
        "Mention 'available in assorted designs/colors' in the Overview section."
    )


def build_catalog_vision_messages(
    item_data: Dict[str, Any],
    job_type: str = "name_and_description",
    extra_images: Optional[List[str]] = None,
    extra_rules: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """
    Builds OpenAI-compatible chat `messages` for local Qwen2.5-VL catalog tasks.

    Args:
        item_data: Dictionary containing product metadata.
        job_type: One of 'name_and_description', 'description_only', or 'name_only'.
        extra_images: Optional list of additional base64 data URLs for future multi-photo support.
        extra_rules: Optional extra instruction lines appended to the user prompt.
    """
    normalized_type = (job_type or "name_and_description").strip().lower()
    if normalized_type not in ("name_and_description", "description_only", "name_only"):
        normalized_type = "name_and_description"

    context_block = _format_item_context(item_data)

    if normalized_type == "name_only":
        schema_hint = 'Return ONLY valid JSON: { "name": "..." }'
        task_instructions = _name_rules_block()
    elif normalized_type == "description_only":
        schema_hint = 'Return ONLY valid JSON: { "description": "..." }'
        task_instructions = _description_rules_block()
    else:
        schema_hint = 'Return ONLY valid JSON: { "name": "...", "description": "..." }'
        task_instructions = f"{_name_rules_block()}\n\n{_description_rules_block()}"

    user_text = (
        f"PRODUCT METADATA:\n{context_block}\n\n"
        f"INSTRUCTIONS:\n{task_instructions}\n\n"
    )
    if extra_rules:
        user_text += "ADDITIONAL RULES:\n" + "\n".join(f"- {r}" for r in extra_rules if r) + "\n\n"
    user_text += schema_hint

    if extra_images:
        user_content: Any = [{"type": "text", "text": user_text}]
        for img_data_uri in extra_images:
            user_content.append({"type": "image_url", "image_url": {"url": img_data_uri}})
    else:
        user_content = user_text

    return [
        {"role": "system", "content": _BASE_SYSTEM_RULES},
        {"role": "user", "content": user_content},
    ]


def _extract_json_dict(content: str, parsed_json: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Safely extracts a JSON dictionary from parsed_json or raw model text."""
    if isinstance(parsed_json, dict) and parsed_json:
        return parsed_json

    raw = (content or "").strip()
    if not raw:
        return {}

    # Strip optional markdown code fences
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
        raw = re.sub(r"\s*```$", "", raw).strip()

    try:
        loaded = json.loads(raw)
        if isinstance(loaded, dict):
            return loaded
    except Exception:
        pass

    # Fallback: find outermost JSON object in text
    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end > start:
        try:
            loaded = json.loads(raw[start : end + 1])
            if isinstance(loaded, dict):
                return loaded
        except Exception:
            pass

    return {}


def clean_generated_name(raw_name: str) -> str:
    """Normalizes generated product title to clean plain text <= 150 chars."""
    text = str(raw_name or "").strip()
    for wrapper in ("```markdown", "```", '"', "'", "**", "#"):
        text = text.replace(wrapper, "").strip()
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if lines:
        text = lines[0]
    text = re.sub(r"^(Product Title|Title|Name|Product Name)\s*:\s*", "", text, flags=re.IGNORECASE).strip()
    if len(text) > 150:
        text = text[:147].rstrip() + "..."
    return text


def clean_generated_description(raw_desc: str) -> str:
    """Normalizes generated Markdown description to <= 1500 chars."""
    text = str(raw_desc or "").strip()
    if text.startswith("```markdown"):
        text = text[len("```markdown") :].strip()
    if text.startswith("```"):
        text = text[3:].strip()
    if text.endswith("```"):
        text = text[:-3].strip()

    if len(text) > 1500:
        trimmed = text[:1490]
        last_boundary = max(trimmed.rfind("."), trimmed.rfind("\n"))
        if last_boundary > 1000:
            text = trimmed[: last_boundary + 1].strip()
        else:
            text = trimmed.rstrip() + "..."
    return text


def parse_vision_model_output(
    content: str,
    parsed_json: Optional[Dict[str, Any]],
    job_type: str = "name_and_description",
) -> Dict[str, str]:
    """
    Extracts and cleans `name` and/or `description` from worker output.
    Raises ValueError if required fields cannot be extracted.
    """
    normalized_type = (job_type or "name_and_description").strip().lower()
    data = _extract_json_dict(content=content, parsed_json=parsed_json)

    # Graceful fallback if a single-field job returned plain text instead of JSON
    if not data and content and normalized_type in ("name_only", "description_only"):
        if normalized_type == "name_only":
            data = {"name": content}
        else:
            data = {"description": content}

    result: Dict[str, str] = {}
    if normalized_type in ("name_only", "name_and_description"):
        cleaned_name = clean_generated_name(data.get("name", ""))
        if cleaned_name:
            result["name"] = cleaned_name

    if normalized_type in ("description_only", "name_and_description"):
        cleaned_desc = clean_generated_description(data.get("description", ""))
        if cleaned_desc:
            result["description"] = cleaned_desc

    if normalized_type == "name_only" and "name" not in result:
        raise ValueError("Vision model output missing valid 'name' field.")
    if normalized_type == "description_only" and "description" not in result:
        raise ValueError("Vision model output missing valid 'description' field.")
    if normalized_type == "name_and_description" and not result:
        raise ValueError("Vision model output missing valid 'name' and 'description' fields.")

    return result


import re as _re

_SPEC_TOKEN_PATTERN = _re.compile(
    r'\b(\d+(?:\.\d+)?)\s*'
    r'(pcs?|pieces?|pack|set|ml|l\b|litre?s?|kg|g\b|gm|gram|mg|cm|mm|m\b|inch(?:es)?|in\b|ft\b|feet|'
    r'x\d+|s\b|m\b|l\b|xl\b|xxl\b|xxxl|size\s+[smlx]+)',
    _re.IGNORECASE
)


def extract_spec_tokens(text: str) -> List[str]:
    """Extracts quantity/size/spec tokens from a product name string."""
    if not text:
        return []
    return [m.group(0).strip() for m in _SPEC_TOKEN_PATTERN.finditer(text)]


def verify_spec_tokens_preserved(original_name: str, generated_name: str) -> bool:
    """
    Returns True if all spec tokens (numbers, quantities, sizes) from original_name
    appear (case-insensitive, allowing for spacing variations like '60PCS' -> '60 Pcs')
    in generated_name. Used as a safety net before saving AI name drafts.
    """
    if not original_name or not generated_name:
        return True
    matches = list(_SPEC_TOKEN_PATTERN.finditer(original_name))
    if not matches:
        return True
    gen_lower = generated_name.lower()
    for m in matches:
        num = m.group(1)
        # Verify the primary numeric count / quantity appears in the generated title
        if num and num not in gen_lower:
            return False
    return True


_INVENTED_PACK_PATTERN = _re.compile(
    r'\b(set\s+of\s+\d+|pack\s+of\s+\d+|\d+\s*pcs?\b|\d+\s*pieces?\b|\d+\s*-?\s*pack\b)',
    _re.IGNORECASE
)


def strip_invented_pack_quantity(original_name: str, generated_name: str) -> str:
    """
    If the original product name did NOT contain a set/pack/piece count, but the vision
    model hallucinated one from seeing multiple items in the photo (e.g. 'Set of 4 Traditional Chinese Figurines'
    when original was 'Traditional Chinese Figurines'), strip the invented quantity.
    """
    if not generated_name:
        return generated_name
    orig_has_specs = bool(_SPEC_TOKEN_PATTERN.search(original_name or ""))
    if orig_has_specs:
        # Original had genuine specs/quantities — keep what model generated
        return generated_name

    # Check if model added an invented "Set of X", "Pack of X", or "X Pcs"
    match = _INVENTED_PACK_PATTERN.search(generated_name)
    if not match:
        return generated_name

    # Remove the invented prefix/phrase cleanly
    cleaned = _INVENTED_PACK_PATTERN.sub("", generated_name)
    # Clean up leading/trailing dashes, colons, or double spaces
    cleaned = _re.sub(r'^\s*[-–—:]\s*', '', cleaned)
    cleaned = _re.sub(r'\s*[-–—:]\s*$', '', cleaned)
    cleaned = _re.sub(r'\s{2,}', ' ', cleaned).strip()
    return cleaned if cleaned else generated_name

