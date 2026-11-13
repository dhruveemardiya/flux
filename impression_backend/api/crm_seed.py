import logging
from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from api.models import (
    User, Segment, Lead, LeadAssignment, LeadAssignmentHistory
)
from api.crm_models import (
    CRMTaskGroup, CRMTaskAssignee, CRMTaskLead, LeadTaskActivity,
    CRMCommunicationLog, LeadSegmentMap
)

logger = logging.getLogger(__name__)


def seed_crm_testing_data():
    """
    Idempotently seeds meaningful testing data for demonstration across all CRM modules.
    
    STRICT COMPLIANCE RULES:
    1. NEVER creates any new users. Binds strictly to existing users.
    2. Preserves all existing genuine business records.
    3. Idempotent: safe to run multiple times without creating duplicate records.
    4. Clearly marked with '[TEST]' prefix.
    5. Valid foreign key relationships interconnected across all tables.
    """
    # 1. Fetch existing users (STRICT: DO NOT CREATE ANY NEW USERS)
    existing_users = list(User.objects.all().order_by('id'))
    if not existing_users:
        logger.warning("[CRM Seed] No existing users found in database. Cannot seed test records without existing users.")
        return {
            'status': 'skipped',
            'message': 'No existing users found. User management strict rule prevents creating users.',
            'created_counts': {}
        }

    primary_user = existing_users[0]
    secondary_user = existing_users[1] if len(existing_users) > 1 else existing_users[0]

    today = timezone.now().date()
    now = timezone.now()

    created_counts = {
        'segments': 0,
        'leads': 0,
        'lead_segment_maps': 0,
        'lead_assignments': 0,
        'assignment_history': 0,
        'task_groups': 0,
        'task_assignees': 0,
        'task_leads': 0,
        'task_activities': 0,
        'communication_logs': 0,
    }

    with transaction.atomic():
        # -------------------------------------------------------------
        # 2. Segment Management: 2 Test Segments
        # -------------------------------------------------------------
        seg1_name = "[TEST] Enterprise Pharmaceuticals"
        seg1, seg1_created = Segment.objects.get_or_create(
            name=seg1_name,
            defaults={
                'description': 'Test Segment for hospital pharmacy chains, clinical institutions, and bulk distributors.',
                'is_active': True,
                'created_by': primary_user,
                'updated_by': primary_user,
            }
        )
        if seg1_created:
            created_counts['segments'] += 1

        seg2_name = "[TEST] Medical Diagnostic Labs"
        seg2, seg2_created = Segment.objects.get_or_create(
            name=seg2_name,
            defaults={
                'description': 'Test Segment for diagnostic centers, pathology laboratories, and screening facilities.',
                'is_active': True,
                'created_by': primary_user,
                'updated_by': primary_user,
            }
        )
        if seg2_created:
            created_counts['segments'] += 1

        # -------------------------------------------------------------
        # 3. Lead Management: 2 Test Leads
        # -------------------------------------------------------------
        lead1_name = "[TEST] MedLife Diagnostics Pvt Ltd"
        lead1, lead1_created = Lead.objects.get_or_create(
            company_name=lead1_name,
            defaults={
                'first_name': 'Vikram',
                'last_name': 'Mehta',
                'designation': 'Procurement Director',
                'mobile': '9820012345',
                'phone': '9820012345',
                'secondary_mobile': '9820054321',
                'secondary_phone': '9820054321',
                'email': 'vikram.mehta@test-medlife.com',
                'secondary_email': 'procurement@test-medlife.com',
                'city': 'Mumbai',
                'state': 'Maharashtra',
                'country': 'India',
                'pincode': '400001',
                'address_line1': 'Unit 402, Express Towers, Nariman Point',
                'website': 'https://www.test-medlifediag.com',
                'segment': seg2_name,
                'lead_source': 'Direct Outreach',
                'status': Lead.STATUS_LEAD,
                'notes': '[TEST RECORD] Evaluated product inventory catalog. Requested bulk pricing quotation.',
                'created_by': primary_user,
            }
        )
        if lead1_created:
            created_counts['leads'] += 1

        lead2_name = "[TEST] Apex Care Hospitals"
        lead2, lead2_created = Lead.objects.get_or_create(
            company_name=lead2_name,
            defaults={
                'first_name': 'Pooja',
                'last_name': 'Sharma',
                'designation': 'Head of Supply Chain',
                'mobile': '9819987654',
                'phone': '9819987654',
                'secondary_mobile': '9819943210',
                'secondary_phone': '9819943210',
                'email': 'pooja.sharma@test-apexcare.com',
                'secondary_email': 'supplychain@test-apexcare.com',
                'city': 'Ahmedabad',
                'state': 'Gujarat',
                'country': 'India',
                'pincode': '380015',
                'address_line1': 'Plot 18, SG Highway, Bodakdev',
                'website': 'https://www.test-apexcarehosp.com',
                'segment': seg1_name,
                'lead_source': 'Medical Expo',
                'status': Lead.STATUS_LEAD,
                'notes': '[TEST RECORD] High-value prospect requiring monthly scheduled pharmaceutical stock deliveries.',
                'created_by': primary_user,
            }
        )
        if lead2_created:
            created_counts['leads'] += 1

        # Lead-to-Segment Mappings
        _, m1_created = LeadSegmentMap.objects.get_or_create(lead=lead1, segment=seg2)
        if m1_created:
            created_counts['lead_segment_maps'] += 1

        _, m2_created = LeadSegmentMap.objects.get_or_create(lead=lead2, segment=seg1)
        if m2_created:
            created_counts['lead_segment_maps'] += 1

        # -------------------------------------------------------------
        # 4. Lead Assignment: 2 Test Assignments
        # -------------------------------------------------------------
        assign1, a1_created = LeadAssignment.objects.get_or_create(
            lead=lead1,
            user=primary_user,
            defaults={
                'assigned_by': primary_user,
                'assigned_at': now - timedelta(days=2),
            }
        )
        if a1_created:
            created_counts['lead_assignments'] += 1
            if not lead1.assigned_to:
                lead1.assigned_to = primary_user
                lead1.save(update_fields=['assigned_to'])

        assign2, a2_created = LeadAssignment.objects.get_or_create(
            lead=lead2,
            user=secondary_user,
            defaults={
                'assigned_by': primary_user,
                'assigned_at': now - timedelta(days=1),
            }
        )
        if a2_created:
            created_counts['lead_assignments'] += 1
            if not lead2.assigned_to:
                lead2.assigned_to = secondary_user
                lead2.save(update_fields=['assigned_to'])

        # Assignment History
        hist1, h1_created = LeadAssignmentHistory.objects.get_or_create(
            lead=lead1,
            assigned_to=primary_user,
            defaults={
                'assigned_by': primary_user,
                'assigned_at': now - timedelta(days=2),
                'notes': '[TEST] Assigned for initial enterprise product demonstration.',
            }
        )
        if h1_created:
            created_counts['assignment_history'] += 1

        hist2, h2_created = LeadAssignmentHistory.objects.get_or_create(
            lead=lead2,
            assigned_to=secondary_user,
            defaults={
                'assigned_by': primary_user,
                'assigned_at': now - timedelta(days=1),
                'notes': '[TEST] Assigned for high-priority contract negotiations.',
            }
        )
        if h2_created:
            created_counts['assignment_history'] += 1

        # -------------------------------------------------------------
        # 5. Task Management: 2 Test Task Groups
        # -------------------------------------------------------------
        tg1_title = "[TEST] Q4 High-Value Outreach Campaign"
        tg1, tg1_created = CRMTaskGroup.objects.get_or_create(
            title=tg1_title,
            defaults={
                'description': 'Structured client onboarding and initial supply chain discovery calls with key medical partners.',
                'priority': CRMTaskGroup.PRIORITY_HIGH,
                'status': CRMTaskGroup.STATUS_ACTIVE,
                'start_date': today - timedelta(days=3),
                'end_date': today + timedelta(days=4),
                'created_by': primary_user,
            }
        )
        if tg1_created:
            created_counts['task_groups'] += 1

        tg2_title = "[TEST] Enterprise Contract Finalization"
        tg2, tg2_created = CRMTaskGroup.objects.get_or_create(
            title=tg2_title,
            defaults={
                'description': 'Contractual review, pricing finalization, and scheduled reorder setup.',
                'priority': CRMTaskGroup.PRIORITY_URGENT,
                'status': CRMTaskGroup.STATUS_ACTIVE,
                'start_date': today,
                'end_date': today + timedelta(days=7),
                'created_by': primary_user,
            }
        )
        if tg2_created:
            created_counts['task_groups'] += 1

        # Task Assignees
        _, ta1_created = CRMTaskAssignee.objects.get_or_create(task_group=tg1, user=primary_user)
        if ta1_created:
            created_counts['task_assignees'] += 1

        _, ta2_created = CRMTaskAssignee.objects.get_or_create(task_group=tg2, user=secondary_user)
        if ta2_created:
            created_counts['task_assignees'] += 1

        # Task Leads
        _, tl1_created = CRMTaskLead.objects.get_or_create(task_group=tg1, lead=lead1)
        if tl1_created:
            created_counts['task_leads'] += 1

        _, tl2_created = CRMTaskLead.objects.get_or_create(task_group=tg2, lead=lead2)
        if tl2_created:
            created_counts['task_leads'] += 1

        # -------------------------------------------------------------
        # 6. My Work Dashboard & Performance Reports: 2 Activities
        # -------------------------------------------------------------
        # Activity 1: Completed by primary_user
        act1, act1_created = LeadTaskActivity.objects.get_or_create(
            task_group=tg1,
            lead=lead1,
            user=primary_user,
            defaults={
                'status': LeadTaskActivity.STATUS_COMPLETED,
                'notes': '[TEST] Conducted intro call. Sent enterprise product catalog and quotation.',
                'action_taken': 'Phone call with Procurement Director Vikram Mehta.',
                'last_updated_at': now - timedelta(days=1),
            }
        )
        if act1_created:
            created_counts['task_activities'] += 1

        # Activity 2: Pending for secondary_user (scheduled for Today)
        act2, act2_created = LeadTaskActivity.objects.get_or_create(
            task_group=tg2,
            lead=lead2,
            user=secondary_user,
            defaults={
                'status': LeadTaskActivity.STATUS_PENDING,
                'notes': '[TEST] Review pending legal agreement clauses for bulk medicine fulfillment.',
                'action_taken': 'Scheduled follow-up meeting with Pooja Sharma.',
                'next_followup_date': today,
                'last_updated_at': now,
            }
        )
        if act2_created:
            created_counts['task_activities'] += 1

        # -------------------------------------------------------------
        # 7. Communication Timeline: 2 Test Interaction Records
        # -------------------------------------------------------------
        comm1_notes = '[TEST] Initial discovery call with Vikram Mehta. Expressed strong interest in pediatric medicine supply chain.'
        comm1, comm1_created = CRMCommunicationLog.objects.get_or_create(
            lead=lead1,
            channel=CRMCommunicationLog.CHANNEL_CALL,
            notes=comm1_notes,
            defaults={
                'user': primary_user,
                'task_group': tg1,
                'next_followup_date': today + timedelta(days=2),
                'created_at': now - timedelta(days=1),
            }
        )
        if comm1_created:
            created_counts['communication_logs'] += 1

        comm2_notes = '[TEST] Executive demonstration meeting with Pooja Sharma regarding computerized warehouse dispatching.'
        comm2, comm2_created = CRMCommunicationLog.objects.get_or_create(
            lead=lead2,
            channel=CRMCommunicationLog.CHANNEL_MEETING,
            notes=comm2_notes,
            defaults={
                'user': secondary_user,
                'task_group': tg2,
                'next_followup_date': today + timedelta(days=3),
                'created_at': now - timedelta(hours=6),
            }
        )
        if comm2_created:
            created_counts['communication_logs'] += 1

    total_new = sum(created_counts.values())
    logger.info("[CRM Seed] Completed. %d new records created.", total_new)

    return {
        'status': 'success',
        'message': f"Testing data seeded successfully. {total_new} new records created.",
        'primary_user': primary_user.username,
        'secondary_user': secondary_user.username,
        'created_counts': created_counts,
    }

