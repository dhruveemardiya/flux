from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0055_add_courier_description'),
    ]

    operations = [
        migrations.AlterField(
            model_name='campaignlead',
            name='phone',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AlterField(
            model_name='customer',
            name='phone',
            field=models.CharField(max_length=255),
        ),
    ]