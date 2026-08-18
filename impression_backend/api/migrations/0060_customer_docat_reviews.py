from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0059_campaignlead_client_status_courier_status_client_review'),
    ]

    operations = [
        migrations.AddField(
            model_name='customer',
            name='docat',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='customer',
            name='reviews',
            field=models.TextField(blank=True, default=''),
        ),
    ]
