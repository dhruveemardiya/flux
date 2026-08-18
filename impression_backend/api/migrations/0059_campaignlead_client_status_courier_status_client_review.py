from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0058_alter_customer_phone_and_campaignlead_phone'),
    ]

    operations = [
        migrations.AddField(
            model_name='campaignlead',
            name='client_review',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='campaignlead',
            name='client_status',
            field=models.CharField(blank=True, default='', max_length=20),
        ),
        migrations.AddField(
            model_name='campaignlead',
            name='courier_status',
            field=models.CharField(blank=True, default='', max_length=20),
        ),
    ]
