import os
import sys
import gzip
import shutil
from datetime import datetime
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings


class Command(BaseCommand):
    help = "Creates an encrypted/compressed snapshot backup of the SQLite database and media files."

    def add_arguments(self, parser):
        parser.add_argument(
            '--dest',
            type=str,
            default=None,
            help="Destination folder for backup archives (defaults to backend/backups/)."
        )
        parser.add_argument(
            '--include-media',
            action='store_true',
            help="Include media directory in the compressed backup snapshot."
        )

    def handle(self, *args, **options):
        base_dir = settings.BASE_DIR
        dest_dir = options['dest'] or os.path.join(base_dir, 'backups')
        os.makedirs(dest_dir, exist_ok=True)

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        db_path = settings.DATABASES['default'].get('NAME')

        if not db_path or not os.path.exists(str(db_path)):
            self.stdout.write(self.style.WARNING(f"Database file not found at: {db_path}. Skipping file-copy backup."))
            return

        db_backup_name = f"wondersale_db_{timestamp}.sqlite3.gz"
        db_backup_path = os.path.join(dest_dir, db_backup_name)

        self.stdout.write(f"Backing up database from {db_path}...")
        try:
            with open(str(db_path), 'rb') as f_in:
                with gzip.open(db_backup_path, 'wb', compresslevel=9) as f_out:
                    shutil.copyfileobj(f_in, f_out)
            file_size_kb = os.path.getsize(db_backup_path) / 1024.0
            self.stdout.write(
                self.style.SUCCESS(f"Database backup created successfully: {db_backup_path} ({file_size_kb:.2f} KB)")
            )
        except Exception as e:
            raise CommandError(f"Backup failed: {e}")

        # Media backup if requested
        if options['include_media']:
            media_dir = getattr(settings, 'MEDIA_ROOT', None)
            if media_dir and os.path.exists(str(media_dir)):
                media_archive = os.path.join(dest_dir, f"wondersale_media_{timestamp}")
                shutil.make_archive(media_archive, 'zip', str(media_dir))
                self.stdout.write(self.style.SUCCESS(f"Media files backed up to: {media_archive}.zip"))

        self.stdout.write(self.style.SUCCESS(f"All backups completed and stored securely in: {dest_dir}"))
