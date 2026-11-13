from django.core.management.base import BaseCommand
from api.crm_seed import seed_crm_testing_data


class Command(BaseCommand):
    help = "Seed meaningful testing data for demonstration across Custom CRM pages"

    def handle(self, *args, **options):
        self.stdout.write("Starting CRM test data seeding...")
        result = seed_crm_testing_data()
        if result['status'] == 'success':
            self.stdout.write(self.style.SUCCESS(result['message']))
            for model_name, count in result.get('created_counts', {}).items():
                self.stdout.write(f"  - {model_name}: {count} new record(s)")
        else:
            self.stdout.write(self.style.WARNING(result['message']))

