from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0056_alter_customer_phone_and_campaignlead_phone'),
    ]

    operations = [
        migrations.AlterField(
            model_name='campaignlead',
            name='address_line1',
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name='customer',
            name='address_line1',
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name='customer',
            name='address_line2',
            field=models.TextField(blank=True),
        ),
    ]