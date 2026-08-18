from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0061_customer_company_upload_name'),
    ]

    operations = [
        migrations.AlterField(
            model_name='campaignlead',
            name='courier_status',
            field=models.CharField(blank=True, choices=[('Pending', 'Pending'), ('Dispatched', 'Dispatched'), ('Delivered', 'Delivered'), ('Failed', 'Failed'), ('Returned', 'Returned')], default='', max_length=20),
        ),
        migrations.AlterField(
            model_name='campaignlead',
            name='status',
            field=models.CharField(choices=[('Pending', 'Pending'), ('Dispatched', 'Dispatched'), ('Delivered', 'Delivered'), ('Failed', 'Failed'), ('Returned', 'Returned')], default='Pending', max_length=20),
        ),
    ]