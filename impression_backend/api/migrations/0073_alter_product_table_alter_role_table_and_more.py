from django.db import migrations

class Migration(migrations.Migration):
    dependencies = [
        ('api', '0072_mobile_device_tokens'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AlterModelTable(name='product', table='product'),
                migrations.AlterModelTable(name='role', table='role'),
                migrations.AlterModelTable(name='user', table='users'),
            ],
        ),
    ]
