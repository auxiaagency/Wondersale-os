import logging
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from inventory.models import Item
from website.meilisearch_service import index_single_item, remove_single_item

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Item)
def handle_item_post_save(sender, instance, created, **kwargs):
    """
    Keep Meilisearch index in real-time sync when an item is saved, stock changes,
    or listed/unlisted from website.
    """
    try:
        if instance.is_listed_on_website:
            index_single_item(instance)
        else:
            # If item was unlisted, remove it from Meilisearch
            remove_single_item(instance.id)
    except Exception as e:
        logger.warning(f"Error in Meilisearch signal post_save for item {instance.id}: {e}")


@receiver(post_delete, sender=Item)
def handle_item_post_delete(sender, instance, **kwargs):
    """Remove item from Meilisearch when deleted from database."""
    try:
        remove_single_item(instance.id)
    except Exception as e:
        logger.warning(f"Error in Meilisearch signal post_delete for item {instance.id}: {e}")
