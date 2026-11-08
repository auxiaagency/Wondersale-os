"""
Wondersale Meilisearch Search & Indexing Engine.
Handles schema initialization, typo tolerance, synonyms, and product indexing.
"""

import os
import logging
from decimal import Decimal
from typing import List, Dict, Any, Optional
import meilisearch

logger = logging.getLogger(__name__)

MEILI_HOST = os.environ.get("MEILISEARCH_HOST", "http://127.0.0.1:7700")
MEILI_MASTER_KEY = os.environ.get("MEILISEARCH_MASTER_KEY", "wondersale_meili_secret_key_2026")
INDEX_NAME = "products"

# Comprehensive e-commerce synonym dictionary for retail & household goods
SYNONYMS_DICTIONARY = {
    # Kitchen & Cookware
    "cooker": ["pressure cooker", "rice cooker"],
    "pressure cooker": ["cooker"],
    "tawa": ["pan", "frying pan", "roti tawa", "dosa tawa"],
    "pan": ["tawa", "frying pan", "kadai"],
    "kadai": ["wok", "deep fry pan", "karahi"],
    "kettle": ["electric kettle", "water kettle"],
    "electric kettle": ["kettle", "water boiler"],
    "flask": ["thermos", "water bottle", "bottle", "insulated flask"],
    "thermos": ["flask", "bottle", "vacuum flask"],
    "bottle": ["water bottle", "flask", "sipper"],
    "mixer": ["grinder", "mixie", "blender", "food processor"],
    "grinder": ["mixer", "mixie", "wet grinder"],
    "blender": ["mixer", "smoothie maker", "hand blender"],
    "toaster": ["pop up toaster", "sandwich toaster", "grill"],
    "chimney": ["kitchen hood", "exhaust"],
    "gas stove": ["stove", "cooktop", "gas burner", "chulha"],
    "induction": ["induction cooktop", "induction stove"],

    # Home & Cleaning Appliances
    "iron": ["steam iron", "dry iron", "press"],
    "press": ["iron", "steam iron", "dry iron"],
    "vacuum": ["vacuum cleaner", "cleaner", "dust buster"],
    "vacuum cleaner": ["vacuum", "floor cleaner"],
    "heater": ["room heater", "blower", "fan heater", "geyser"],
    "geyser": ["water heater", "boiler"],
    "water heater": ["geyser"],
    "fan": ["ceiling fan", "table fan", "pedestal fan", "exhaust fan"],

    # Electronics & Gadgets
    "headphones": ["earphones", "earbuds", "headset", "tws"],
    "earphones": ["headphones", "earbuds", "neckband"],
    "earbuds": ["tws", "earphones", "airpods"],
    "speaker": ["bluetooth speaker", "soundbar", "audio"],
    "clock": ["wall clock", "alarm clock", "table clock"],
    "watch": ["smartwatch", "digital watch"],

    # Food & Grocery
    "oil": ["cooking oil", "edible oil", "refined oil", "mustard oil"],
    "ghee": ["desi ghee", "clarified butter"],
    "atta": ["flour", "wheat flour", "chakki atta"],
    "rice": ["basmati rice", "chawal"],
    "dal": ["pulses", "lentils", "toor dal", "moong dal"],
    "masala": ["spices", "spice powder"],
    "tea": ["chai", "tea leaves"],
    "coffee": ["instant coffee", "filter coffee"],
    "biscuit": ["cookies", "rusk"],
}


def get_meili_client() -> meilisearch.Client:
    """Return authenticated Meilisearch client."""
    return meilisearch.Client(MEILI_HOST, MEILI_MASTER_KEY)


def initialize_meilisearch_schema():
    """
    Configure the 'products' index with:
    - Searchable fields (ranked)
    - Filterable fields (facets)
    - Sortable fields
    - Synonyms dictionary
    - Typo tolerance rules
    """
    client = get_meili_client()
    index = client.index(INDEX_NAME)

    # 1. Primary search ranking order (Weighted from highest to lowest)
    index.update_searchable_attributes([
        "name",
        "category_names",
        "subcategory_names",
        "description",
        "uid",
    ])

    # 2. Filterable facets for price range, stock, category & website listing
    index.update_filterable_attributes([
        "in_stock",
        "price",
        "category_names",
        "subcategory_names",
        "category_slugs",
        "is_listed_on_website",
    ])

    # 3. Sortable attributes
    index.update_sortable_attributes([
        "price",
        "id",
        "created_at",
    ])

    # 4. Synonyms dictionary
    index.update_synonyms(SYNONYMS_DICTIONARY)

    # 5. Typo tolerance configuration (Active out-of-the-box)
    index.update_typo_tolerance({
        "enabled": True,
        "minWordSizeForTypos": {
            "oneTypo": 4,
            "twoTypos": 8,
        },
        "disableOnWords": [],
        "disableOnAttributes": ["uid"],  # Strict matching on exact item code/barcode
    })

    logger.info("Meilisearch 'products' index schema configured successfully.")
    return True


def format_item_for_meilisearch(item) -> Dict[str, Any]:
    """
    Convert a Django Item model instance into a clean Meilisearch document.
    """
    subcats = list(item.subcategories.select_related('category').all())
    cat_names = list({sc.category.name for sc in subcats if sc.category})
    cat_slugs = list({sc.category.slug for sc in subcats if sc.category and hasattr(sc.category, 'slug')})
    subcat_names = [sc.name for sc in subcats]

    selling_price_float = float(item.selling_price) if item.selling_price else 0.0
    mrp_float = float(item.mrp) if item.mrp else selling_price_float

    primary_image_url = ""
    try:
        first_img = item.images.first()
        if first_img and first_img.image:
            primary_image_url = first_img.image.url
    except Exception:
        pass

    return {
        "id": item.id,
        "uid": item.uid,
        "name": item.name,
        "description": getattr(item, 'description', '') or '',
        "price": selling_price_float,
        "mrp": mrp_float,
        "in_stock": bool(item.quantity and item.quantity > 0),
        "quantity": int(item.quantity or 0),
        "category_names": cat_names,
        "category_slugs": cat_slugs,
        "subcategory_names": subcat_names,
        "primary_image_url": primary_image_url,
        "is_listed_on_website": bool(item.is_listed_on_website),
        "created_at": item.listed_on_website_at.isoformat() if getattr(item, 'listed_on_website_at', None) else None,
    }


def index_single_item(item):
    """Index or update a single product document in Meilisearch."""
    try:
        client = get_meili_client()
        doc = format_item_for_meilisearch(item)
        client.index(INDEX_NAME).add_documents([doc], primary_key="id")
    except Exception as e:
        logger.warning(f"Failed to index item {item.id} to Meilisearch: {e}")


def remove_single_item(item_id: int):
    """Remove a document from Meilisearch when deleted or unlisted."""
    try:
        client = get_meili_client()
        client.index(INDEX_NAME).delete_document(item_id)
    except Exception as e:
        logger.warning(f"Failed to remove item {item_id} from Meilisearch: {e}")
