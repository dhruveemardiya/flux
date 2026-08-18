from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0064_campaignleadattempt'),
    ]

    operations = [
        migrations.AddField(
            model_name='campaignlead',
            name='products',
            field=models.TextField(blank=True, default=''),
        ),
    ]
