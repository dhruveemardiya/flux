from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0054_customer_excel_metadata'),
    ]

    operations = [
        migrations.AddField(
            model_name='campaignlead',
            name='courier_description',
            field=models.TextField(blank=True, default=''),
        ),
    ]
