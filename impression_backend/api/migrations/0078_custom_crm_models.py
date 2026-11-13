# Generated for Custom CRM inside Lead Generation module

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0077_alter_segment_name'),
    ]

    operations = [
        # CRMUserProfile (Zero modifications to existing User model)
        migrations.CreateModel(
            name='CRMUserProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('mobile', models.CharField(blank=True, default='', max_length=50)),
                ('approval_required', models.BooleanField(default=False)),
                ('is_crm_approved', models.BooleanField(default=True)),
                ('account_status', models.CharField(default='Active', max_length=20)),
                ('first_login_change_required', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('reporting_manager', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='crm_subordinate_staff', to=settings.AUTH_USER_MODEL)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='crm_profile', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'crm_user_profiles',
                'ordering': ['user__username'],
            },
        ),

        # Lead extensions
        migrations.AddField(
            model_name='lead',
            name='designation',
            field=models.CharField(blank=True, default='', max_length=150),
        ),
        migrations.AddField(
            model_name='lead',
            name='lead_source',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddField(
            model_name='lead',
            name='custom_fields',
            field=models.JSONField(blank=True, default=dict),
        ),

        # CRMRolePermission
        migrations.CreateModel(
            name='CRMRolePermission',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('role', models.CharField(db_index=True, max_length=100)),
                ('module', models.CharField(choices=[('dashboard', 'CRM Dashboard'), ('users', 'User & Role Management'), ('access_logs', 'Login Approval & Access Logs'), ('segments', 'Segment Management'), ('leads', 'Lead Management'), ('assignments', 'Lead Assignment'), ('tasks', 'Task Management'), ('my_work', 'My Work Dashboard'), ('reports', 'Performance Reports'), ('quick_search', 'Quick Lead Search')], db_index=True, max_length=50)),
                ('action', models.CharField(choices=[('view', 'View'), ('create', 'Create'), ('edit', 'Edit'), ('delete', 'Delete'), ('import', 'Import'), ('export', 'Export'), ('assign', 'Assign'), ('approve', 'Approve'), ('reports', 'Reports')], db_index=True, max_length=50)),
                ('allow', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'crm_role_permissions',
                'unique_together': {('role', 'module', 'action')},
            },
        ),

        # CRMUserPermissionOverride
        migrations.CreateModel(
            name='CRMUserPermissionOverride',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('module', models.CharField(choices=[('dashboard', 'CRM Dashboard'), ('users', 'User & Role Management'), ('access_logs', 'Login Approval & Access Logs'), ('segments', 'Segment Management'), ('leads', 'Lead Management'), ('assignments', 'Lead Assignment'), ('tasks', 'Task Management'), ('my_work', 'My Work Dashboard'), ('reports', 'Performance Reports'), ('quick_search', 'Quick Lead Search')], db_index=True, max_length=50)),
                ('action', models.CharField(choices=[('view', 'View'), ('create', 'Create'), ('edit', 'Edit'), ('delete', 'Delete'), ('import', 'Import'), ('export', 'Export'), ('assign', 'Assign'), ('approve', 'Approve'), ('reports', 'Reports')], db_index=True, max_length=50)),
                ('allow', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='crm_permission_overrides', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'crm_user_permission_overrides',
                'unique_together': {('user', 'module', 'action')},
            },
        ),

        # CRMAccessRequest
        migrations.CreateModel(
            name='CRMAccessRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('request_datetime', models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ('ip_address', models.CharField(blank=True, default='', max_length=100)),
                ('device_info', models.TextField(blank=True, default='')),
                ('status', models.CharField(choices=[('Pending', 'Pending Requests'), ('Approved', 'Approved Requests'), ('Rejected', 'Rejected Requests'), ('Expired', 'Expired Requests')], db_index=True, default='Pending', max_length=30)),
                ('decision_datetime', models.DateTimeField(blank=True, null=True)),
                ('notes', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('decided_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='decided_crm_requests', to=settings.AUTH_USER_MODEL)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='crm_access_requests', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'crm_access_requests',
                'ordering': ['-request_datetime', '-id'],
            },
        ),

        # CRMAccessLog
        migrations.CreateModel(
            name='CRMAccessLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event_type', models.CharField(db_index=True, max_length=50)),
                ('ip_address', models.CharField(blank=True, default='', max_length=100)),
                ('device_info', models.TextField(blank=True, default='')),
                ('timestamp', models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ('details', models.JSONField(blank=True, default=dict)),
                ('actor', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='performed_crm_logs', to=settings.AUTH_USER_MODEL)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='crm_access_logs', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'crm_access_logs',
                'ordering': ['-timestamp', '-id'],
            },
        ),

        # LeadSegmentMap
        migrations.CreateModel(
            name='LeadSegmentMap',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('lead', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='segment_mappings', to='api.lead')),
                ('segment', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='lead_mappings', to='api.segment')),
            ],
            options={
                'db_table': 'crm_lead_segment_map',
                'unique_together': {('lead', 'segment')},
            },
        ),

        # SegmentMigrationLog
        migrations.CreateModel(
            name='SegmentMigrationLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('old_segment_name', models.CharField(db_index=True, max_length=255)),
                ('action', models.CharField(choices=[('MOVED', 'Move all leads to another existing segment'), ('UNASSIGNED', 'Keep all leads without any segment (Unassigned)')], default='UNASSIGNED', max_length=30)),
                ('leads_affected', models.IntegerField(default=0)),
                ('migrated_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('notes', models.TextField(blank=True, default='')),
                ('migrated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='segment_migrations_performed', to=settings.AUTH_USER_MODEL)),
                ('target_segment', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='migration_destination_logs', to='api.segment')),
            ],
            options={
                'db_table': 'crm_segment_migration_logs',
                'ordering': ['-migrated_at', '-id'],
            },
        ),

        # CRMTaskGroup
        migrations.CreateModel(
            name='CRMTaskGroup',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True, default='')),
                ('attachment', models.CharField(blank=True, default='', max_length=500)),
                ('start_date', models.DateField(db_index=True, default=django.utils.timezone.now)),
                ('start_time', models.TimeField(blank=True, null=True)),
                ('end_date', models.DateField(db_index=True, default=django.utils.timezone.now)),
                ('end_time', models.TimeField(blank=True, null=True)),
                ('priority', models.CharField(choices=[('Low', 'Low'), ('Normal', 'Normal'), ('High', 'High'), ('Urgent', 'Urgent')], db_index=True, default='Normal', max_length=20)),
                ('status', models.CharField(choices=[('Draft', 'Draft'), ('Scheduled', 'Scheduled'), ('Active', 'Active'), ('Completed', 'Completed'), ('Cancelled', 'Cancelled'), ('Archived', 'Archived')], db_index=True, default='Active', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_crm_task_groups', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'crm_task_groups',
                'ordering': ['-id'],
            },
        ),

        # CRMTaskAssignee
        migrations.CreateModel(
            name='CRMTaskAssignee',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('assigned_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('task_group', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='assignees', to='api.crmtaskgroup')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='assigned_crm_task_groups', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'crm_task_assignees',
                'unique_together': {('task_group', 'user')},
            },
        ),

        # CRMTaskLead
        migrations.CreateModel(
            name='CRMTaskLead',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('added_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('lead', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='crm_task_group_links', to='api.lead')),
                ('task_group', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='associated_leads', to='api.crmtaskgroup')),
            ],
            options={
                'db_table': 'crm_task_leads',
                'unique_together': {('task_group', 'lead')},
            },
        ),

        # LeadTaskActivity
        migrations.CreateModel(
            name='LeadTaskActivity',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('Pending', 'Pending'), ('Completed', 'Completed'), ('Rejected', 'Rejected'), ('No Answer', 'No Answer'), ('Callback Required', 'Callback Required'), ('Not Interested', 'Not Interested'), ('Follow-up Required', 'Follow-up Required')], db_index=True, default='Pending', max_length=30)),
                ('notes', models.TextField(blank=True, default='')),
                ('action_taken', models.TextField(blank=True, default='')),
                ('next_followup_date', models.DateField(blank=True, db_index=True, null=True)),
                ('next_followup_time', models.TimeField(blank=True, null=True)),
                ('attachment', models.CharField(blank=True, default='', max_length=500)),
                ('last_updated_at', models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('lead', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='crm_activities', to='api.lead')),
                ('task_group', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='lead_activities', to='api.crmtaskgroup')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='crm_staff_activities', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'crm_lead_task_activities',
                'ordering': ['-last_updated_at', '-id'],
                'unique_together': {('task_group', 'lead', 'user')},
            },
        ),

        # CRMCommunicationLog
        migrations.CreateModel(
            name='CRMCommunicationLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('channel', models.CharField(choices=[('Call', 'Call Notes'), ('Meeting', 'Meeting Notes'), ('Email', 'Email Notes'), ('WhatsApp', 'WhatsApp/Manual Notes'), ('Note', 'General Note'), ('Status Update', 'Status Update')], db_index=True, default='Call', max_length=30)),
                ('notes', models.TextField(blank=True, default='')),
                ('next_followup_date', models.DateField(blank=True, null=True)),
                ('next_followup_time', models.TimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ('lead', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='crm_communication_timeline', to='api.lead')),
                ('task_group', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='recorded_communications', to='api.crmtaskgroup')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='crm_communications_recorded', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'crm_communication_logs',
                'ordering': ['-created_at', '-id'],
            },
        ),

        # LeadImportJob
        migrations.CreateModel(
            name='LeadImportJob',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('file_name', models.CharField(max_length=255)),
                ('import_token', models.CharField(blank=True, db_index=True, default='', max_length=64)),
                ('uploaded_at', models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ('total_records', models.IntegerField(default=0)),
                ('new_records', models.IntegerField(default=0)),
                ('exact_duplicates', models.IntegerField(default=0)),
                ('partial_duplicates', models.IntegerField(default=0)),
                ('updated_records', models.IntegerField(default=0)),
                ('skipped_records', models.IntegerField(default=0)),
                ('failed_records', models.IntegerField(default=0)),
                ('status', models.CharField(choices=[('Completed', 'Completed'), ('Partial', 'Partial'), ('Failed', 'Failed')], default='Completed', max_length=20)),
                ('summary_json', models.JSONField(blank=True, default=dict)),
                ('uploaded_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='crm_imports_run', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'crm_lead_import_jobs',
                'ordering': ['-uploaded_at', '-id'],
            },
        ),

        # LeadImportRow
        migrations.CreateModel(
            name='LeadImportRow',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('row_index', models.IntegerField()),
                ('company_name', models.CharField(blank=True, default='', max_length=255)),
                ('contact_person', models.CharField(blank=True, default='', max_length=255)),
                ('phone', models.CharField(blank=True, default='', max_length=50)),
                ('email', models.CharField(blank=True, default='', max_length=255)),
                ('match_type', models.CharField(default='NONE', max_length=20)),
                ('resolution', models.CharField(default='NEW', max_length=20)),
                ('matched_lead_id', models.IntegerField(blank=True, null=True)),
                ('details', models.JSONField(blank=True, default=dict)),
                ('job', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='rows', to='api.leadimportjob')),
            ],
            options={
                'db_table': 'crm_lead_import_rows',
                'ordering': ['job', 'row_index'],
            },
        ),

        # CRMAuditLog
        migrations.CreateModel(
            name='CRMAuditLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(db_index=True, max_length=100)),
                ('target_model', models.CharField(blank=True, default='', max_length=100)),
                ('target_id', models.CharField(blank=True, default='', max_length=100)),
                ('details', models.JSONField(blank=True, default=dict)),
                ('ip_address', models.CharField(blank=True, default='', max_length=100)),
                ('timestamp', models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='crm_audit_actions', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'crm_audit_logs',
                'ordering': ['-timestamp', '-id'],
            },
        ),
    ]

