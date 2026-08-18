from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0060_customer_docat_reviews'),
    ]

    operations = [
        migrations.AddField(
            model_name='customer',
            name='company_upload_name',
            field=models.TextField(blank=True, default=''),
        ),
    ]
