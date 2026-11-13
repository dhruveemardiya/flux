from django.db import models
from django.conf import settings
from django.utils import timezone


class CRMUserProfile(models.Model):
    """
    Separate CRM Staff Profile relationship linked to the existing Django User model.
    Preserves existing User model completely untouched, ensuring existing authentication,
    sessions, tokens, and unrelated modules (Inventory, Account, Campaign) never break.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='crm_profile'
    )
    mobile = models.CharField(max_length=50, blank=True, default='')
    reporting_manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='crm_subordinate_staff'
    )
    approval_required = models.BooleanField(default=False)
    is_crm_approved = models.BooleanField(default=True)
    account_status = models.CharField(max_length=20, default='Active')  # 'Active' or 'Inactive'
    first_login_change_required = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'crm_user_profiles'
        ordering = ['user__username']

    def __str__(self):
        return f"CRMProfile for {self.user.username} ({self.account_status})"


class CRMRolePermission(models.Model):
    MODULE_CHOICES = (
        ('dashboard', 'CRM Dashboard'),
        ('users', 'User & Role Management'),
        ('access_logs', 'Login Approval & Access Logs'),
        ('segments', 'Segment Management'),
        ('leads', 'Lead Management'),
        ('assignments', 'Lead Assignment'),
        ('tasks', 'Task Management'),
        ('my_work', 'My Work Dashboard'),
        ('reports', 'Performance Reports'),
        ('quick_search', 'Quick Lead Search'),
    )

    ACTION_CHOICES = (
        ('view', 'View'),
        ('create', 'Create'),
        ('edit', 'Edit'),
        ('delete', 'Delete'),
        ('import', 'Import'),
        ('export', 'Export'),
        ('assign', 'Assign'),
        ('approve', 'Approve'),
        ('reports', 'Reports'),
    )

    role = models.CharField(max_length=100, db_index=True)
    module = models.CharField(max_length=50, choices=MODULE_CHOICES, db_index=True)
    action = models.CharField(max_length=50, choices=ACTION_CHOICES, db_index=True)
    allow = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'crm_role_permissions'
        unique_together = ('role', 'module', 'action')
        indexes = [
            models.Index(fields=['role', 'module']),
        ]

    def __str__(self):
        state = 'ALLOWED' if self.allow else 'DENIED'
        return f"Role {self.role}: {self.module}.{self.action} -> {state}"


class CRMUserPermissionOverride(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='crm_permission_overrides')
    module = models.CharField(max_length=50, choices=CRMRolePermission.MODULE_CHOICES, db_index=True)
    action = models.CharField(max_length=50, choices=CRMRolePermission.ACTION_CHOICES, db_index=True)
    allow = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'crm_user_permission_overrides'
        unique_together = ('user', 'module', 'action')
        indexes = [
            models.Index(fields=['user', 'module']),
        ]

    def __str__(self):
        state = 'ALLOWED' if self.allow else 'DENIED'
        return f"User {self.user.username}: {self.module}.{self.action} -> {state}"


class CRMAccessRequest(models.Model):
    STATUS_PENDING = 'Pending'
    STATUS_APPROVED = 'Approved'
    STATUS_REJECTED = 'Rejected'
    STATUS_EXPIRED = 'Expired'

    STATUS_CHOICES = (
        (STATUS_PENDING, 'Pending Requests'),
        (STATUS_APPROVED, 'Approved Requests'),
        (STATUS_REJECTED, 'Rejected Requests'),
        (STATUS_EXPIRED, 'Expired Requests'),
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='crm_access_requests')
    request_datetime = models.DateTimeField(default=timezone.now, db_index=True)
    ip_address = models.CharField(max_length=100, blank=True, default='')
    device_info = models.TextField(blank=True, default='')
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    decided_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='decided_crm_requests')
    decision_datetime = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'crm_access_requests'
        ordering = ['-request_datetime', '-id']

    def __str__(self):
        return f"Access Request: {self.user.username} ({self.status}) on {self.request_datetime}"


class CRMAccessLog(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='crm_access_logs')
    event_type = models.CharField(max_length=50, db_index=True)
    ip_address = models.CharField(max_length=100, blank=True, default='')
    device_info = models.TextField(blank=True, default='')
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='performed_crm_logs')
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    details = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'crm_access_logs'
        ordering = ['-timestamp', '-id']

    def __str__(self):
        return f"Access Log: {self.user.username} - {self.event_type} at {self.timestamp}"


class LeadSegmentMap(models.Model):
    lead = models.ForeignKey('api.Lead', on_delete=models.CASCADE, related_name='segment_mappings')
    segment = models.ForeignKey('api.Segment', on_delete=models.CASCADE, related_name='lead_mappings')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'crm_lead_segment_map'
        unique_together = ('lead', 'segment')

    def __str__(self):
        return f"Lead #{self.lead_id} <-> Segment {self.segment.name}"


class SegmentMigrationLog(models.Model):
    ACTION_MOVED = 'MOVED'
    ACTION_UNASSIGNED = 'UNASSIGNED'

    ACTION_CHOICES = (
        (ACTION_MOVED, 'Move all leads to another existing segment'),
        (ACTION_UNASSIGNED, 'Keep all leads without any segment (Unassigned)'),
    )

    old_segment_name = models.CharField(max_length=255, db_index=True)
    target_segment = models.ForeignKey('api.Segment', on_delete=models.SET_NULL, null=True, blank=True, related_name='migration_destination_logs')
    action = models.CharField(max_length=30, choices=ACTION_CHOICES, default=ACTION_UNASSIGNED)
    leads_affected = models.IntegerField(default=0)
    migrated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='segment_migrations_performed')
    migrated_at = models.DateTimeField(default=timezone.now)
    notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'crm_segment_migration_logs'
        ordering = ['-migrated_at', '-id']

    def __str__(self):
        return f"Migration of '{self.old_segment_name}' ({self.action}, {self.leads_affected} leads)"


class CRMTaskGroup(models.Model):
    PRIORITY_LOW = 'Low'
    PRIORITY_NORMAL = 'Normal'
    PRIORITY_HIGH = 'High'
    PRIORITY_URGENT = 'Urgent'

    PRIORITY_CHOICES = (
        (PRIORITY_LOW, 'Low'),
        (PRIORITY_NORMAL, 'Normal'),
        (PRIORITY_HIGH, 'High'),
        (PRIORITY_URGENT, 'Urgent'),
    )

    STATUS_DRAFT = 'Draft'
    STATUS_SCHEDULED = 'Scheduled'
    STATUS_ACTIVE = 'Active'
    STATUS_COMPLETED = 'Completed'
    STATUS_CANCELLED = 'Cancelled'
    STATUS_ARCHIVED = 'Archived'

    STATUS_CHOICES = (
        (STATUS_DRAFT, 'Draft'),
        (STATUS_SCHEDULED, 'Scheduled'),
        (STATUS_ACTIVE, 'Active'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_CANCELLED, 'Cancelled'),
        (STATUS_ARCHIVED, 'Archived'),
    )

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    attachment = models.CharField(max_length=500, blank=True, default='')
    start_date = models.DateField(default=timezone.now, db_index=True)
    start_time = models.TimeField(null=True, blank=True)
    end_date = models.DateField(default=timezone.now, db_index=True)
    end_time = models.TimeField(null=True, blank=True)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default=PRIORITY_NORMAL, db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE, db_index=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_crm_task_groups')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'crm_task_groups'
        ordering = ['-id']

    def __str__(self):
        return f"Task Group #{self.id}: {self.title} ({self.status})"


class CRMTaskAssignee(models.Model):
    task_group = models.ForeignKey(CRMTaskGroup, on_delete=models.CASCADE, related_name='assignees')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='assigned_crm_task_groups')
    assigned_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'crm_task_assignees'
        unique_together = ('task_group', 'user')

    def __str__(self):
        return f"Task Group #{self.task_group_id} -> Staff #{self.user_id}"


class CRMTaskLead(models.Model):
    task_group = models.ForeignKey(CRMTaskGroup, on_delete=models.CASCADE, related_name='associated_leads')
    lead = models.ForeignKey('api.Lead', on_delete=models.CASCADE, related_name='crm_task_group_links')
    added_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'crm_task_leads'
        unique_together = ('task_group', 'lead')

    def __str__(self):
        return f"Task Group #{self.task_group_id} -> Lead #{self.lead_id}"


class LeadTaskActivity(models.Model):
    STATUS_PENDING = 'Pending'
    STATUS_COMPLETED = 'Completed'
    STATUS_REJECTED = 'Rejected'
    STATUS_NO_ANSWER = 'No Answer'
    STATUS_CALLBACK_REQUIRED = 'Callback Required'
    STATUS_NOT_INTERESTED = 'Not Interested'
    STATUS_FOLLOWUP_REQUIRED = 'Follow-up Required'

    STATUS_CHOICES = (
        (STATUS_PENDING, 'Pending'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_REJECTED, 'Rejected'),
        (STATUS_NO_ANSWER, 'No Answer'),
        (STATUS_CALLBACK_REQUIRED, 'Callback Required'),
        (STATUS_NOT_INTERESTED, 'Not Interested'),
        (STATUS_FOLLOWUP_REQUIRED, 'Follow-up Required'),
    )

    task_group = models.ForeignKey(CRMTaskGroup, on_delete=models.CASCADE, related_name='lead_activities')
    lead = models.ForeignKey('api.Lead', on_delete=models.CASCADE, related_name='crm_activities')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='crm_staff_activities')
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    notes = models.TextField(blank=True, default='')
    action_taken = models.TextField(blank=True, default='')
    next_followup_date = models.DateField(null=True, blank=True, db_index=True)
    next_followup_time = models.TimeField(null=True, blank=True)
    attachment = models.CharField(max_length=500, blank=True, default='')
    last_updated_at = models.DateTimeField(default=timezone.now, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'crm_lead_task_activities'
        unique_together = ('task_group', 'lead', 'user')
        ordering = ['-last_updated_at', '-id']

    def __str__(self):
        return f"TaskGroup #{self.task_group_id} Lead #{self.lead_id} User #{self.user_id}: {self.status}"


class CRMCommunicationLog(models.Model):
    CHANNEL_CALL = 'Call'
    CHANNEL_MEETING = 'Meeting'
    CHANNEL_EMAIL = 'Email'
    CHANNEL_WHATSAPP = 'WhatsApp'
    CHANNEL_NOTE = 'Note'
    CHANNEL_STATUS = 'Status Update'

    CHANNEL_CHOICES = (
        (CHANNEL_CALL, 'Call Notes'),
        (CHANNEL_MEETING, 'Meeting Notes'),
        (CHANNEL_EMAIL, 'Email Notes'),
        (CHANNEL_WHATSAPP, 'WhatsApp/Manual Notes'),
        (CHANNEL_NOTE, 'General Note'),
        (CHANNEL_STATUS, 'Status Update'),
    )

    lead = models.ForeignKey('api.Lead', on_delete=models.CASCADE, related_name='crm_communication_timeline')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='crm_communications_recorded')
    task_group = models.ForeignKey(CRMTaskGroup, on_delete=models.SET_NULL, null=True, blank=True, related_name='recorded_communications')
    channel = models.CharField(max_length=30, choices=CHANNEL_CHOICES, default=CHANNEL_CALL, db_index=True)
    notes = models.TextField(blank=True, default='')
    next_followup_date = models.DateField(null=True, blank=True)
    next_followup_time = models.TimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        db_table = 'crm_communication_logs'
        ordering = ['-created_at', '-id']

    def __str__(self):
        return f"{self.channel} on Lead #{self.lead_id} by {self.user.username}"


class LeadImportJob(models.Model):
    STATUS_COMPLETED = 'Completed'
    STATUS_PARTIAL = 'Partial'
    STATUS_FAILED = 'Failed'

    STATUS_CHOICES = (
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_PARTIAL, 'Partial'),
        (STATUS_FAILED, 'Failed'),
    )

    file_name = models.CharField(max_length=255)
    import_token = models.CharField(max_length=64, blank=True, default='', db_index=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='crm_imports_run')
    uploaded_at = models.DateTimeField(default=timezone.now, db_index=True)
    total_records = models.IntegerField(default=0)
    new_records = models.IntegerField(default=0)
    exact_duplicates = models.IntegerField(default=0)
    partial_duplicates = models.IntegerField(default=0)
    updated_records = models.IntegerField(default=0)
    skipped_records = models.IntegerField(default=0)
    failed_records = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_COMPLETED)
    summary_json = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'crm_lead_import_jobs'
        ordering = ['-uploaded_at', '-id']

    def __str__(self):
        return f"Import Job #{self.id} '{self.file_name}' ({self.new_records} new, {self.updated_records} upd)"


class LeadImportRow(models.Model):
    MATCH_NONE = 'NONE'
    MATCH_EXACT = 'EXACT'
    MATCH_PARTIAL = 'PARTIAL'

    RESOLUTION_NEW = 'NEW'
    RESOLUTION_SKIP = 'SKIP'
    RESOLUTION_UPDATE = 'UPDATE'
    RESOLUTION_MERGE = 'MERGE'

    job = models.ForeignKey(LeadImportJob, on_delete=models.CASCADE, related_name='rows')
    row_index = models.IntegerField()
    company_name = models.CharField(max_length=255, blank=True, default='')
    contact_person = models.CharField(max_length=255, blank=True, default='')
    phone = models.CharField(max_length=50, blank=True, default='')
    email = models.CharField(max_length=255, blank=True, default='')
    match_type = models.CharField(max_length=20, default=MATCH_NONE)
    resolution = models.CharField(max_length=20, default=RESOLUTION_NEW)
    matched_lead_id = models.IntegerField(null=True, blank=True)
    details = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'crm_lead_import_rows'
        ordering = ['job', 'row_index']


class CRMAuditLog(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='crm_audit_actions')
    action = models.CharField(max_length=100, db_index=True)
    target_model = models.CharField(max_length=100, blank=True, default='')
    target_id = models.CharField(max_length=100, blank=True, default='')
    details = models.JSONField(default=dict, blank=True)
    ip_address = models.CharField(max_length=100, blank=True, default='')
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        db_table = 'crm_audit_logs'
        ordering = ['-timestamp', '-id']

    def __str__(self):
        username = self.user.username if self.user else 'System'
        return f"Audit: {username} -> {self.action} on {self.target_model}:{self.target_id} at {self.timestamp}"

