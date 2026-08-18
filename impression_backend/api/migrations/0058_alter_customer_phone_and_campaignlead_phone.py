from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0057_alter_customer_address_fields_and_campaignlead_address_line1'),
    ]

    operations = [
        migrations.AlterField(
            model_name='campaignlead',
            name='phone',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AlterField(
            model_name='customer',
            name='phone',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
    ]