# Generated manually for Lead Assignment & Task Communication Improvements

import datetime
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


def _safe_date(val):
    if not val:
        return django.utils.timezone.now().date()
    if hasattr(val, 'date'):
        try:
            return val.date()
        except Exception:
            pass
    if isinstance(val, datetime.date):
        return val
    try:
        return datetime.datetime.strptime(str(val)[:10], '%Y-%m-%d').date()
    except Exception:
        return django.utils.timezone.now().date()


def migrate_existing_assignments(apps, schema_editor):
    Lead = apps.get_model('api', 'Lead')
    LeadAssignment = apps.get_model('api', 'LeadAssignment')
    LeadTask = apps.get_model('api', 'LeadTask')
    db_alias = schema_editor.connection.alias

    leads_with_assignee = Lead.objects.using(db_alias).filter(assigned_to__isnull=False)
    for lead in leads_with_assignee:
        if not LeadAssignment.objects.using(db_alias).filter(lead=lead, user=lead.assigned_to).exists():
            LeadAssignment.objects.using(db_alias).create(
                lead=lead,
                user=lead.assigned_to,
                assigned_by=lead.assigned_by,
                assigned_at=lead.assigned_at or lead.created_at or django.utils.timezone.now(),
            )
        # Ensure a task exists without MultipleObjectsReturned error
        if not LeadTask.objects.using(db_alias).filter(lead=lead, assigned_to=lead.assigned_to).exists():
            LeadTask.objects.using(db_alias).create(
                lead=lead,
                assigned_to=lead.assigned_to,
                description=lead.notes or f"Follow up with {lead.company_name or 'Lead #' + str(lead.id)}",
                status='Pending',
                assigned_date=_safe_date(lead.assigned_at),
            )


def reverse_migrate_existing_assignments(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0070_leadtask_taskcallhistory'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='LeadAssignment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('assigned_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('assigned_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_lead_assignments', to=settings.AUTH_USER_MODEL)),
                ('lead', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='assignments', to='api.lead')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='lead_assignments', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'lead_assignments',
                'ordering': ['-assigned_at'],
                'unique_together': {('lead', 'user')},
            },
        ),
        migrations.AddField(
            model_name='lead',
            name='assigned_users',
            field=models.ManyToManyField(blank=True, related_name='multi_assigned_leads', through='api.LeadAssignment', through_fields=('lead', 'user'), to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='taskcallhistory',
            name='interaction_type',
            field=models.CharField(choices=[('Call', 'Call'), ('WhatsApp', 'WhatsApp'), ('Email', 'Email')], default='Call', max_length=20),
        ),
        migrations.RunPython(migrate_existing_assignments, reverse_migrate_existing_assignments),
    ]

