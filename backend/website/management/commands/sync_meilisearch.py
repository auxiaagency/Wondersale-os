import logging
from django.core.management.base import BaseCommand
from inventory.models import Item
from website.meilisearch_service import (
    initialize_meilisearch_schema,
    format_item_for_meilisearch,
    get_meili_client,
    INDEX_NAME,
)

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Initializes Meilisearch schema and synchronizes all listed website items."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset-schema",
            action="store_true",
            help="Re-configure searchable, filterable attributes, synonyms, and typo tolerance.",
        )
        parser.add_argument(
            "--all",
            action="store_true",
            help="Index all items, even if is_listed_on_website is False.",
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Connecting to Meilisearch..."))
        client = get_meili_client()

        # Check health
        try:
            health = client.health()
            self.stdout.write(self.style.SUCCESS(f"Meilisearch is ONLINE: {health}"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Could not connect to Meilisearch: {e}"))
            return

        # 1. Update/initialize schema
        self.stdout.write(self.style.NOTICE("Configuring index schema & synonyms..."))
        try:
            initialize_meilisearch_schema()
            self.stdout.write(self.style.SUCCESS("Index schema configured."))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Failed to configure schema: {e}"))

        # 2. Fetch items to index
        qs = Item.objects.prefetch_related(
            "subcategories__category",
            "images"
        )
        if not options.get("all"):
            qs = qs.filter(is_listed_on_website=True)

        total_items = qs.count()
        self.stdout.write(self.style.NOTICE(f"Found {total_items} items to index."))

        if total_items == 0:
            self.stdout.write(self.style.WARNING("No items found. Indexing complete."))
            return

        batch_size = 200
        docs = []
        indexed_count = 0

        for item in qs.iterator(chunk_size=batch_size):
            try:
                docs.append(format_item_for_meilisearch(item))
            except Exception as e:
                self.stdout.write(self.style.WARNING(f"Skipping item {item.id}: {e}"))

            if len(docs) >= batch_size:
                client.index(INDEX_NAME).add_documents(docs, primary_key="id")
                indexed_count += len(docs)
                self.stdout.write(f"Indexed {indexed_count}/{total_items} items...")
                docs = []

        if docs:
            client.index(INDEX_NAME).add_documents(docs, primary_key="id")
            indexed_count += len(docs)

        self.stdout.write(self.style.SUCCESS(f"Successfully synchronized {indexed_count} items to Meilisearch!"))
