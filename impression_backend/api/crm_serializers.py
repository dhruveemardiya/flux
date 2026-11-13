from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    Role, Segment, Lead, LeadAssignment, LeadAssignmentHistory,
    CRMUserProfile, CRMRolePermission, CRMUserPermissionOverride,
    CRMAccessRequest, CRMAccessLog, LeadSegmentMap, SegmentMigrationLog,
    CRMTaskGroup, CRMTaskAssignee, CRMTaskLead, LeadTaskActivity,
    CRMCommunicationLog, LeadImportJob, LeadImportRow, CRMAuditLog
)

User = get_user_model()


class CRMUserProfileSerializer(serializers.ModelSerializer):
    reporting_manager_name = serializers.SerializerMethodField()

    class Meta:
        model = CRMUserProfile
        fields = [
            'id', 'mobile', 'reporting_manager', 'reporting_manager_name',
            'approval_required', 'is_crm_approved', 'account_status',
            'first_login_change_required', 'created_at', 'updated_at'
        ]

    def get_reporting_manager_name(self, obj):
        if obj.reporting_manager:
            return f"{obj.reporting_manager.first_name} {obj.reporting_manager.last_name}".strip() or obj.reporting_manager.username
        return None


class CRMStaffUserSerializer(serializers.ModelSerializer):
    profile = CRMUserProfileSerializer(source='crm_profile', read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'full_name', 'role', 'profile', 'created_at']

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.username


class CRMRolePermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CRMRolePermission
        fields = ['id', 'role', 'module', 'action', 'allow', 'created_at', 'updated_at']


class CRMUserPermissionOverrideSerializer(serializers.ModelSerializer):
    class Meta:
        model = CRMUserPermissionOverride
        fields = ['id', 'user', 'module', 'action', 'allow', 'created_at', 'updated_at']


class CRMAccessRequestSerializer(serializers.ModelSerializer):
    staff_name = serializers.SerializerMethodField()
    username = serializers.CharField(source='user.username', read_only=True)
    decided_by_name = serializers.SerializerMethodField()

    class Meta:
        model = CRMAccessRequest
        fields = [
            'id', 'user', 'username', 'staff_name', 'request_datetime',
            'ip_address', 'device_info', 'status', 'decided_by',
            'decided_by_name', 'decision_datetime', 'notes'
        ]

    def get_staff_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}".strip() or obj.user.username

    def get_decided_by_name(self, obj):
        if obj.decided_by:
            return f"{obj.decided_by.first_name} {obj.decided_by.last_name}".strip() or obj.decided_by.username
        return None


class CRMAccessLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = CRMAccessLog
        fields = ['id', 'user', 'username', 'event_type', 'ip_address', 'device_info', 'actor', 'actor_name', 'timestamp', 'details']

    def get_actor_name(self, obj):
        if obj.actor:
            return f"{obj.actor.first_name} {obj.actor.last_name}".strip() or obj.actor.username
        return 'System'


class CRMSegmentSerializer(serializers.ModelSerializer):
    total_leads = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Segment
        fields = ['id', 'name', 'description', 'is_active', 'total_leads', 'created_at', 'updated_at']


class CRMLeadSerializer(serializers.ModelSerializer):
    assigned_staff = serializers.SerializerMethodField()
    contact_person = serializers.SerializerMethodField()

    class Meta:
        model = Lead
        fields = [
            'id', 'company_name', 'first_name', 'last_name', 'contact_person',
            'designation', 'email', 'secondary_email', 'phone', 'mobile', 'secondary_mobile',
            'address_line1', 'address_line2', 'city', 'state', 'country', 'pincode',
            'website', 'segment', 'lead_source', 'notes', 'custom_fields', 'status',
            'assigned_staff', 'created_at', 'updated_at'
        ]

    def get_contact_person(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.company_name or 'N/A'

    def get_assigned_staff(self, obj):
        return [
            {
                'id': a.user_id,
                'name': f"{a.user.first_name} {a.user.last_name}".strip() or a.user.username,
                'role': a.user.role
            }
            for a in getattr(obj, 'assignments', []).all()
        ] if hasattr(obj, 'assignments') else []


class CRMLeadAssignmentSerializer(serializers.ModelSerializer):
    staff_name = serializers.SerializerMethodField()
    lead_name = serializers.SerializerMethodField()

    class Meta:
        model = LeadAssignment
        fields = ['id', 'lead', 'lead_name', 'user', 'staff_name', 'assigned_by', 'assigned_at']

    def get_staff_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}".strip() or obj.user.username

    def get_lead_name(self, obj):
        return obj.lead.company_name or f"{obj.lead.first_name} {obj.lead.last_name}".strip()


class CRMTaskGroupSerializer(serializers.ModelSerializer):
    assignees = serializers.SerializerMethodField()
    lead_count = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()

    class Meta:
        model = CRMTaskGroup
        fields = [
            'id', 'title', 'description', 'attachment', 'priority', 'status',
            'start_date', 'start_time', 'end_date', 'end_time',
            'assignees', 'lead_count', 'progress', 'created_at'
        ]

    def get_assignees(self, obj):
        return [
            {'id': a.user_id, 'name': f"{a.user.first_name} {a.user.last_name}".strip() or a.user.username, 'role': a.user.role}
            for a in obj.assignees.all()
        ]

    def get_lead_count(self, obj):
        return obj.task_leads.count()

    def get_progress(self, obj):
        tot = obj.activities.count()
        comp = obj.activities.filter(status='Completed').count()
        return round(comp / tot * 100, 1) if tot > 0 else 0


class CRMLeadTaskActivitySerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source='lead.company_name', read_only=True)
    contact_person = serializers.SerializerMethodField()
    task_title = serializers.CharField(source='task_group.title', read_only=True)
    priority = serializers.CharField(source='task_group.priority', read_only=True)

    class Meta:
        model = LeadTaskActivity
        fields = [
            'id', 'task_group', 'task_title', 'priority', 'lead', 'company_name',
            'contact_person', 'user', 'status', 'notes', 'action_taken',
            'next_followup_date', 'next_followup_time', 'attachment', 'last_updated_at'
        ]

    def get_contact_person(self, obj):
        return f"{obj.lead.first_name} {obj.lead.last_name}".strip() or 'N/A'


class CRMCommunicationLogSerializer(serializers.ModelSerializer):
    staff_name = serializers.SerializerMethodField()

    class Meta:
        model = CRMCommunicationLog
        fields = ['id', 'lead', 'user', 'staff_name', 'channel', 'notes', 'next_followup_date', 'next_followup_time', 'created_at']

    def get_staff_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}".strip() or obj.user.username


class CRMLeadImportJobSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = LeadImportJob
        fields = [
            'id', 'file_name', 'import_token', 'uploaded_by', 'uploaded_by_name',
            'uploaded_at', 'total_records', 'new_records', 'exact_duplicates',
            'partial_duplicates', 'updated_records', 'skipped_records',
            'failed_records', 'status', 'summary_json'
        ]

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return f"{obj.uploaded_by.first_name} {obj.uploaded_by.last_name}".strip() or obj.uploaded_by.username
        return 'System'


class CRMAuditLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = CRMAuditLog
        fields = ['id', 'user', 'username', 'action', 'target_model', 'target_id', 'details', 'ip_address', 'timestamp']

