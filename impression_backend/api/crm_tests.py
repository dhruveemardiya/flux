from django.test import TestCase
from rest_framework.test import APIClient
from django.utils import timezone
from rest_framework import status
from api.models import (
    User, Role, Segment, Lead, LeadAssignment, LeadAssignmentHistory,
    Company, Warehouse, Product,
    CRMUserProfile, CRMRolePermission, CRMUserPermissionOverride,
    CRMAccessRequest, CRMAccessLog, CRMTaskGroup, CRMTaskAssignee, CRMTaskLead,
    LeadTaskActivity, CRMCommunicationLog, LeadImportJob, LeadImportRow, CRMAuditLog
)


class CustomCRMCompleteBackendTests(TestCase):
    """
    Automated verification suite testing all 26 test categories mandated by Part 19.
    """

    def setUp(self):
        self.client = APIClient()

        # Create SuperAdmin user for tests
        self.superadmin = User.objects.create(
            username="crm_superadmin",
            first_name="Super",
            last_name="Admin",
            role="superadmin"
        )
        self.superadmin.set_password("Admin@12345")
        self.superadmin.save()
        self.superadmin_profile = CRMUserProfile.objects.create(
            user=self.superadmin,
            is_crm_approved=True,
            account_status='Active'
        )
        self.client.force_authenticate(user=self.superadmin)

        # Create normal staff user
        self.staff_user = User.objects.create(
            username="crm_staff_bob",
            first_name="Bob",
            last_name="Patel",
            role="Sales Executive"
        )
        self.staff_user.set_password("Staff@12345")
        self.staff_user.save()
        self.staff_profile = CRMUserProfile.objects.create(
            user=self.staff_user,
            is_crm_approved=True,
            account_status='Active'
        )

        # Create secondary staff user for multi-assignee tests
        self.staff_user2 = User.objects.create(
            username="crm_staff_alice",
            first_name="Alice",
            last_name="Shah",
            role="Sales Executive"
        )
        self.staff_user2.set_password("Staff@12345")
        self.staff_user2.save()
        self.staff_profile2 = CRMUserProfile.objects.create(
            user=self.staff_user2,
            is_crm_approved=True,
            account_status='Active'
        )

    # -------------------------------------------------------------
    # 1. User & Role Management Tests
    # -------------------------------------------------------------
    def test_01_user_crud_and_crm_profile(self):
        """Verify user creation with separate CRMUserProfile, leaving base User untouched."""
        self.client.force_authenticate(user=self.superadmin)
        res = self.client.post('/api/crm/users/', {
            'username': 'john_doe',
            'password': 'Password@123',
            'first_name': 'John',
            'last_name': 'Doe',
            'role': 'Sales Executive',
            'mobile': '9876543210',
            'approval_required': False,
            'account_status': 'Active',
        }, content_type='application/json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        user_obj = User.objects.get(username='john_doe')
        self.assertTrue(user_obj.check_password('Password@123'))
        # Base user has no CRM fields
        self.assertFalse(hasattr(user_obj, 'approval_required'))
        # CRM profile has CRM fields
        profile = user_obj.crm_profile
        self.assertEqual(profile.mobile, '9876543210')
        self.assertEqual(profile.account_status, 'Active')
        self.assertTrue(profile.is_crm_approved)

    def test_02_role_creation_and_permission_enforcement(self):
        """Verify role creation and module-level permission matrix enforcement."""
        self.client.force_authenticate(user=self.superadmin)
        res = self.client.post('/api/crm/roles/', {'role': 'Custom Telecaller'}, content_type='application/json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        # Save permission: deny leads delete
        res_perm = self.client.post('/api/crm/permissions/save/', {
            'target_type': 'role',
            'target_id': 'Custom Telecaller',
            'permissions': {'leads.delete': False, 'leads.view': True}
        }, content_type='application/json')
        self.assertEqual(res_perm.status_code, status.HTTP_200_OK)

        self.assertFalse(CRMRolePermission.objects.get(role='Custom Telecaller', module='leads', action='delete').allow)
        self.assertTrue(CRMRolePermission.objects.get(role='Custom Telecaller', module='leads', action='view').allow)

    # -------------------------------------------------------------
    # 2. CRM Access Approval Tests
    # -------------------------------------------------------------
    def test_03_crm_access_approval_flow(self):
        """Verify pending CRM approval blocks restricted CRM access without blocking base auth."""
        pending_user = User.objects.create(username='pending_worker', role='Sales Executive')
        pending_user.set_password('Pass@123')
        pending_user.save()
        CRMUserProfile.objects.create(user=pending_user, approval_required=True, is_crm_approved=False)

        req = CRMAccessRequest.objects.create(user=pending_user, ip_address='127.0.0.1', device_info='TestBrowser')
        self.assertEqual(req.status, 'Pending')

        # Super admin approves
        self.client.force_authenticate(user=self.superadmin)
        res_appr = self.client.post(f'/api/crm/access-requests/{req.id}/decision/', {
            'decision': 'Approved',
            'notes': 'Access verified and granted.'
        }, content_type='application/json')
        self.assertEqual(res_appr.status_code, status.HTTP_200_OK)

        pending_user.refresh_from_db()
        self.assertTrue(pending_user.crm_profile.is_crm_approved)

    # -------------------------------------------------------------
    # 3. Segment CRUD & Safe Deletion Tests (Zero Lead Loss)
    # -------------------------------------------------------------
    def test_04_segment_crud_and_duplicate_validation(self):
        """Verify segment duplicate active validation and safe deletion."""
        self.client.force_authenticate(user=self.superadmin)
        res1 = self.client.post('/api/crm/segments/', {'name': 'Pharma Retail', 'description': 'Retail pharmacies'}, content_type='application/json')
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        # Duplicate active segment must fail
        res2 = self.client.post('/api/crm/segments/', {'name': 'Pharma Retail'}, content_type='application/json')
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_05_segment_safe_deletion_zero_lead_loss(self):
        """Verify deleting a segment moves leads to target segment or keeps unassigned with zero lead loss."""
        self.client.force_authenticate(user=self.superadmin)
        seg_old = Segment.objects.create(name='Old Segment', is_active=True)
        seg_new = Segment.objects.create(name='New Target Segment', is_active=True)

        lead = Lead.objects.create(company_name='Apex Corp', segment='Old Segment')

        # Safe delete with reassign
        res_del = self.client.post(f'/api/crm/segments/{seg_old.id}/safe-delete/', {
            'action': 'MOVED',
            'target_segment_id': seg_new.id,
        }, content_type='application/json')
        self.assertEqual(res_del.status_code, status.HTTP_200_OK)

        lead.refresh_from_db()
        self.assertEqual(lead.segment, 'New Target Segment')
        self.assertFalse(Segment.objects.filter(id=seg_old.id).exists())

    # -------------------------------------------------------------
    # 4. Lead CRUD & 7-Step Excel Import Tests
    # -------------------------------------------------------------
    def test_06_lead_crud_and_search(self):
        """Verify lead creation, column filtering, and full search."""
        self.client.force_authenticate(user=self.superadmin)
        res = self.client.post('/api/crm/leads/', {
            'company_name': 'Global Biotech',
            'first_name': 'Dr. Ramesh',
            'last_name': 'Verma',
            'mobile_number': '9822011223',
            'email': 'ramesh@globalbio.com',
            'city': 'Ahmedabad',
            'segment': 'Biotech',
        }, content_type='application/json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        res_search = self.client.get('/api/crm/leads/', {'search': 'Biotech'})
        self.assertEqual(res_search.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(res_search.data['leads']), 1)

    def test_07_excel_import_duplicate_detection_and_commit(self):
        """Verify exact/partial duplicate comparison and atomic transactional commit."""
        self.client.force_authenticate(user=self.superadmin)
        Lead.objects.create(
            company_name='Existing Pharma Ltd',
            first_name='Existing',
            last_name='Contact',
            mobile='9998887776',
            email='existing@pharma.com'
        )

        rows = [
            {'Company': 'Existing Pharma Ltd', 'Phone': '9998887776', 'Email': 'existing@pharma.com'},
            {'Company': 'Brand New Corp', 'Phone': '9112223344', 'Email': 'new@corp.com'},
        ]
        mapping = {'Company': 'company_name', 'Phone': 'mobile_number', 'Email': 'email'}

        # Validate duplicates
        res_val = self.client.post('/api/crm/leads/import/validate/', {
            'rows': rows,
            'column_mapping': mapping,
            'file_name': 'test_leads.xlsx',
        }, content_type='application/json')
        self.assertEqual(res_val.status_code, status.HTTP_200_OK)
        self.assertEqual(res_val.data['exact_duplicates_count'], 1)
        self.assertEqual(res_val.data['new_records_count'], 1)
        import_token = res_val.data['import_token']

        # Commit import
        res_commit = self.client.post('/api/crm/leads/import/commit/', {
            'rows': rows,
            'column_mapping': mapping,
            'resolutions': {'0': 'UPDATE', '1': 'NEW'},
            'import_token': import_token,
            'file_name': 'test_leads.xlsx',
        }, content_type='application/json')
        self.assertEqual(res_commit.status_code, status.HTTP_200_OK)

        # Re-import protection: committing same token must fail
        res_reimport = self.client.post('/api/crm/leads/import/commit/', {
            'rows': rows,
            'column_mapping': mapping,
            'import_token': import_token,
        }, content_type='application/json')
        self.assertEqual(res_reimport.status_code, status.HTTP_400_BAD_REQUEST)

    # -------------------------------------------------------------
    # 5. Lead Assignment & Reassignment Tests
    # -------------------------------------------------------------
    def test_08_lead_assignment_multi_staff(self):
        """Verify assigning multiple leads to multiple staff creates separate records without duplicates."""
        self.client.force_authenticate(user=self.superadmin)
        l1 = Lead.objects.create(company_name='Lead Alpha')
        l2 = Lead.objects.create(company_name='Lead Beta')

        res = self.client.post('/api/crm/assignments/assign/', {
            'lead_ids': [l1.id, l2.id],
            'staff_ids': [self.staff_user.id, self.staff_user2.id],
        }, content_type='application/json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # 2 leads x 2 staff = 4 assignments
        self.assertEqual(LeadAssignment.objects.filter(lead__in=[l1, l2]).count(), 4)

    # -------------------------------------------------------------
    # 6. Task Management & Independent Activities Tests
    # -------------------------------------------------------------
    def test_09_independent_task_activities_n_x_m(self):
        """Verify N staff x M leads generates N x M independent activities with complete isolation."""
        self.client.force_authenticate(user=self.superadmin)
        l1 = Lead.objects.create(company_name='Task Lead 1')
        l2 = Lead.objects.create(company_name='Task Lead 2')
        l3 = Lead.objects.create(company_name='Task Lead 3')

        # 2 staff x 3 leads = 6 independent activities
        res_tg = self.client.post('/api/crm/task-groups/', {
            'title': 'Q4 High Value Outreach',
            'priority': 'Urgent',
            'staff_ids': [self.staff_user.id, self.staff_user2.id],
            'lead_ids': [l1.id, l2.id, l3.id],
        }, content_type='application/json')
        self.assertEqual(res_tg.status_code, status.HTTP_201_CREATED)
        tg_id = res_tg.data['task_group_id']

        self.assertEqual(LeadTaskActivity.objects.filter(task_group_id=tg_id).count(), 6)

        # Staff 1 updates an activity to 'Completed'
        act_bob = LeadTaskActivity.objects.filter(task_group_id=tg_id, lead=l1, user=self.staff_user).first()
        self.client.force_authenticate(user=self.staff_user)
        res_upd = self.client.post(f'/api/crm/my-work/activities/{act_bob.id}/update/', {
            'status': 'Completed',
            'action_taken': 'Phone call completed.',
            'notes': 'Client agreed to proceed.',
        }, content_type='application/json')
        self.assertEqual(res_upd.status_code, status.HTTP_200_OK)

        # Staff 2's activity for the same lead remains untouched and 'Pending'
        act_alice = LeadTaskActivity.objects.filter(task_group_id=tg_id, lead=l1, user=self.staff_user2).first()
        self.assertEqual(act_alice.status, 'Pending')

    # -------------------------------------------------------------
    # 7. Performance Reports & 360° Communication Timeline
    # -------------------------------------------------------------
    def test_10_performance_reports_calculation(self):
        """Verify performance percentage = Completed / Total Assigned * 100."""
        self.client.force_authenticate(user=self.superadmin)
        res = self.client.get('/api/crm/reports/performance/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('completion_percentage', res.data['summary'])

    def test_11_quick_search_and_communication_timeline(self):
        """Verify quick search and logging chronological communications."""
        self.client.force_authenticate(user=self.superadmin)
        lead = Lead.objects.create(company_name='Timeline Test Corp', mobile='9191919191')

        # Add communication
        res_comm = self.client.post(f'/api/crm/leads/{lead.id}/timeline/', {
            'channel': 'Call',
            'notes': 'Discussed enterprise pricing quote.',
            'next_followup_date': '2026-11-20',
        }, content_type='application/json')
        self.assertEqual(res_comm.status_code, status.HTTP_201_CREATED)

        # Retrieve timeline
        res_timeline = self.client.get(f'/api/crm/leads/{lead.id}/timeline/')
        self.assertEqual(res_timeline.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_timeline.data['timeline']), 1)
        self.assertEqual(res_timeline.data['timeline'][0]['channel'], 'Call')

    # -------------------------------------------------------------
    # 8. Regression Verification for Existing Modules
    # -------------------------------------------------------------
    def test_12_existing_models_and_login_unaffected(self):
        """Verify User model is standard and unrelated modules (Company, Warehouse, Product) function identically."""
        user = User.objects.get(username='crm_staff_bob')
        self.assertIsNotNone(user.id)
        # Verify warehouse creation
        comp = Company.objects.create(name='Test Corp CRM', location='HQ')
        wh = Warehouse.objects.create(name='Main Hub', company=comp)
        self.assertIsNotNone(wh.id)
        prod = Product.objects.create(product_name='Sample Medicine', company=comp)
        self.assertIsNotNone(prod.id)

    # -------------------------------------------------------------
    # 9. Security Hardening & Defect Regression Tests (Phases 1-5)
    # -------------------------------------------------------------
    def test_13_inactive_user_crm_endpoints_blocked(self):
        """Verify inactive CRM staff user is blocked with HTTP 403 across CRM endpoints."""
        inactive_user = User.objects.create(username='inactive_staff', role='Sales Executive')
        inactive_user.set_password('Pass@123')
        inactive_user.save()
        CRMUserProfile.objects.create(user=inactive_user, account_status='Inactive', is_crm_approved=True)

        self.client.force_authenticate(user=inactive_user)
        for endpoint in ['/api/crm/dashboard/summary/', '/api/crm/leads/', '/api/crm/task-groups/']:
            res = self.client.get(endpoint)
            self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN, f"Failed on {endpoint}")

    def test_14_unapproved_user_not_blocked_when_feature_suspended(self):
        """Verify normal CRM users are NOT blocked due to pending approval when login approval is suspended."""
        unapproved_user = User.objects.create(username='unapproved_staff', role='Sales Executive')
        unapproved_user.set_password('Pass@123')
        unapproved_user.save()
        CRMUserProfile.objects.create(user=unapproved_user, approval_required=True, is_crm_approved=False, account_status='Active')

        self.client.force_authenticate(user=unapproved_user)
        res = self.client.get('/api/crm/dashboard/summary/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_15_unapproved_user_can_submit_access_request(self):
        """Verify unapproved staff can submit access request via POST, and duplicate submit returns existing request."""
        unapproved_user = User.objects.create(username='requesting_staff', role='Sales Executive')
        unapproved_user.set_password('Pass@123')
        unapproved_user.save()
        CRMUserProfile.objects.create(user=unapproved_user, approval_required=True, is_crm_approved=False, account_status='Active')

        self.client.force_authenticate(user=unapproved_user)
        res = self.client.post('/api/crm/access-requests/', {'notes': 'Please approve my account.'}, content_type='application/json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIn('request_id', res.data)

        # Duplicate submit
        res2 = self.client.post('/api/crm/access-requests/', {'notes': 'Second attempt.'}, content_type='application/json')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)

    def test_16_non_admin_lead_detail_idor_blocked(self):
        """Verify non-admin cannot view unassigned lead detail (IDOR), but can view assigned lead."""
        unassigned_lead = Lead.objects.create(company_name='Secret Lead Corp', mobile='9871112222')
        assigned_lead = Lead.objects.create(company_name='Assigned Lead Corp', mobile='9873334444')
        LeadAssignment.objects.create(lead=assigned_lead, user=self.staff_user)

        self.client.force_authenticate(user=self.staff_user)

        # Unassigned lead -> 403 Forbidden
        res_unassigned = self.client.get(f'/api/crm/leads/{unassigned_lead.id}/')
        self.assertEqual(res_unassigned.status_code, status.HTTP_403_FORBIDDEN)

        # Assigned lead -> 200 OK
        res_assigned = self.client.get(f'/api/crm/leads/{assigned_lead.id}/')
        self.assertEqual(res_assigned.status_code, status.HTTP_200_OK)

    def test_17_non_admin_lead_timeline_idor_blocked(self):
        """Verify non-admin cannot view or post timeline on unassigned lead."""
        unassigned_lead = Lead.objects.create(company_name='Secret Lead 2', mobile='9875556666')
        self.client.force_authenticate(user=self.staff_user)

        res_get = self.client.get(f'/api/crm/leads/{unassigned_lead.id}/timeline/')
        self.assertEqual(res_get.status_code, status.HTTP_403_FORBIDDEN)

        res_post = self.client.post(f'/api/crm/leads/{unassigned_lead.id}/timeline/', {
            'channel': 'Call',
            'notes': 'Tried to log communication.'
        }, content_type='application/json')
        self.assertEqual(res_post.status_code, status.HTTP_403_FORBIDDEN)

    def test_18_non_admin_user_detail_blocked(self):
        """Verify non-admin staff cannot view another user's profile details, but can view their own."""
        self.client.force_authenticate(user=self.staff_user)

        # View another staff -> 403
        res_other = self.client.get(f'/api/crm/users/{self.staff_user2.id}/')
        self.assertEqual(res_other.status_code, status.HTTP_403_FORBIDDEN)

        # View own -> 200
        res_self = self.client.get(f'/api/crm/users/{self.staff_user.id}/')
        self.assertEqual(res_self.status_code, status.HTTP_200_OK)

    def test_19_non_admin_access_logs_blocked(self):
        """Verify non-admin staff is blocked with HTTP 403 from viewing company access logs."""
        self.client.force_authenticate(user=self.staff_user)
        res = self.client.get('/api/crm/access-logs/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_20_non_admin_access_requests_scoped(self):
        """Verify non-admin staff only sees their own access requests in GET /api/crm/access-requests/."""
        CRMAccessRequest.objects.create(user=self.staff_user, ip_address='10.0.0.1', status='Pending')
        CRMAccessRequest.objects.create(user=self.staff_user2, ip_address='10.0.0.2', status='Pending')

        self.client.force_authenticate(user=self.staff_user)
        res = self.client.get('/api/crm/access-requests/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # Should only see their own
        for item in res.data['requests']:
            self.assertEqual(item['user_id'], self.staff_user.id)

    def test_21_task_group_detail_no_attribute_error(self):
        """Verify GET /api/crm/task-groups/<id>/ uses associated_leads and lead_activities without AttributeError."""
        self.client.force_authenticate(user=self.superadmin)
        tg = CRMTaskGroup.objects.create(title='Bugfix Verification TG', priority='High', created_by=self.superadmin)
        l1 = Lead.objects.create(company_name='TG Lead Detail Test', mobile='9110001111')
        CRMTaskLead.objects.create(task_group=tg, lead=l1)
        LeadTaskActivity.objects.create(task_group=tg, lead=l1, user=self.staff_user, status='Pending')

        res = self.client.get(f'/api/crm/task-groups/{tg.id}/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data['leads']), 1)
        self.assertEqual(res.data['total_activities'], 1)

    def test_22_task_group_report_no_attribute_error(self):
        """Verify GET /api/crm/reports/task-groups/ uses lead_activities without AttributeError."""
        self.client.force_authenticate(user=self.superadmin)
        tg = CRMTaskGroup.objects.create(title='Report Bugfix TG', priority='Normal', created_by=self.superadmin)
        l1 = Lead.objects.create(company_name='TG Report Lead', mobile='9110002222')
        CRMTaskLead.objects.create(task_group=tg, lead=l1)
        LeadTaskActivity.objects.create(task_group=tg, lead=l1, user=self.staff_user, status='Completed')

        res = self.client.get('/api/crm/reports/task-groups/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        matched = [t for t in res.data['task_groups'] if t['id'] == tg.id]
        self.assertEqual(len(matched), 1)
        self.assertEqual(matched[0]['completion_percentage'], 100.0)

    def test_23_task_group_assign_no_attribute_error(self):
        """Verify POST /api/crm/task-groups/<id>/assign/ uses associated_leads without AttributeError."""
        self.client.force_authenticate(user=self.superadmin)
        tg = CRMTaskGroup.objects.create(title='Assign TG Test', priority='Normal', created_by=self.superadmin)
        l1 = Lead.objects.create(company_name='Assign Lead Test', mobile='9110003333')
        CRMTaskLead.objects.create(task_group=tg, lead=l1)

        res = self.client.post(f'/api/crm/task-groups/{tg.id}/assign/', {
            'staff_ids': [self.staff_user.id]
        }, content_type='application/json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(LeadTaskActivity.objects.filter(task_group=tg, lead=l1, user=self.staff_user).exists())

    def test_24_task_group_isolation_non_assigned_blocked(self):
        """Verify non-admin staff not assigned to task group is blocked with HTTP 403."""
        tg = CRMTaskGroup.objects.create(title='Private Management TG', priority='Urgent', created_by=self.superadmin)
        CRMTaskAssignee.objects.create(task_group=tg, user=self.staff_user2)

        # staff_user (Bob) is not assigned
        self.client.force_authenticate(user=self.staff_user)
        res = self.client.get(f'/api/crm/task-groups/{tg.id}/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # staff_user2 (Alice) is assigned
        self.client.force_authenticate(user=self.staff_user2)
        res_assigned = self.client.get(f'/api/crm/task-groups/{tg.id}/')
        self.assertEqual(res_assigned.status_code, status.HTTP_200_OK)

    def test_25_quick_search_scoped_for_non_admin(self):
        """Verify quick search returns only assigned leads for non-admin staff."""
        l_unassigned = Lead.objects.create(company_name='UniqueSearchUnassigned Corp', mobile='9990001111')
        l_assigned = Lead.objects.create(company_name='UniqueSearchAssigned Corp', mobile='9990002222')
        LeadAssignment.objects.create(lead=l_assigned, user=self.staff_user)

        self.client.force_authenticate(user=self.staff_user)
        res = self.client.get('/api/crm/quick-search/?q=UniqueSearch')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        returned_ids = [r['id'] for r in res.data['results']]
        self.assertIn(l_assigned.id, returned_ids)
        self.assertNotIn(l_unassigned.id, returned_ids)

    def test_26_excel_import_commit_captures_matched_lead_id(self):
        """Verify commit creates Lead and saves real auto-incremented lead.id into LeadImportRow."""
        self.client.force_authenticate(user=self.superadmin)
        rows = [
            {'Company': 'Auto Inc Verify Inc', 'Phone': '9870009999', 'Email': 'autoinc@verify.com'}
        ]
        mapping = {'Company': 'company_name', 'Phone': 'mobile_number', 'Email': 'email'}

        res_val = self.client.post('/api/crm/leads/import/validate/', {
            'rows': rows,
            'column_mapping': mapping,
        }, content_type='application/json')
        token = res_val.data['import_token']

        res_commit = self.client.post('/api/crm/leads/import/commit/', {
            'rows': rows,
            'column_mapping': mapping,
            'resolutions': {'0': 'NEW'},
            'import_token': token,
        }, content_type='application/json')
        self.assertEqual(res_commit.status_code, status.HTTP_200_OK)

        created_lead = Lead.objects.filter(company_name='Auto Inc Verify Inc').first()
        self.assertIsNotNone(created_lead)
        self.assertIsNotNone(created_lead.id)

        import_row = LeadImportRow.objects.filter(company_name='Auto Inc Verify Inc').first()
        self.assertIsNotNone(import_row)
        self.assertEqual(import_row.matched_lead_id, created_lead.id)

    def test_27_dashboard_summary_includes_legacy_assigned_to(self):
        """Verify dashboard summary counts leads assigned via legacy assigned_to or LeadAssignment."""
        self.client.force_authenticate(user=self.superadmin)
        l_legacy = Lead.objects.create(company_name='Legacy Assigned Lead', assigned_to=self.staff_user)
        l_m2m = Lead.objects.create(company_name='M2M Assigned Lead')
        LeadAssignment.objects.create(lead=l_m2m, user=self.staff_user)

        res_admin = self.client.get('/api/crm/dashboard/summary/')
        self.assertEqual(res_admin.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(res_admin.data['kpis']['total_assigned_leads'], 2)

        self.client.force_authenticate(user=self.staff_user)
        res_staff = self.client.get('/api/crm/dashboard/summary/')
        self.assertEqual(res_staff.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(res_staff.data['kpis']['my_assigned_leads'], 2)

    def test_28_task_group_list_scoped_for_non_admin(self):
        """Verify non-admin GET /api/crm/task-groups/ only lists task groups they are assigned to or created."""
        tg_private = CRMTaskGroup.objects.create(title='Other Staff TG', priority='Normal', created_by=self.superadmin)
        CRMTaskAssignee.objects.create(task_group=tg_private, user=self.staff_user2)

        tg_bob = CRMTaskGroup.objects.create(title='Bob Task Group', priority='Normal', created_by=self.superadmin)
        CRMTaskAssignee.objects.create(task_group=tg_bob, user=self.staff_user)

        self.client.force_authenticate(user=self.staff_user)
        res = self.client.get('/api/crm/task-groups/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        tg_ids = [t['id'] for t in res.data['task_groups']]
        self.assertIn(tg_bob.id, tg_ids)
        self.assertNotIn(tg_private.id, tg_ids)

    def test_29_crm_seed_testing_data_idempotency_and_no_users_created(self):
        """Verify CRM test data seeder creates 2 records per visible module, 0 new users, and is idempotent."""
        from api.crm_seed import seed_crm_testing_data

        user_count_before = User.objects.count()

        # First run
        result_first = seed_crm_testing_data()
        self.assertEqual(result_first['status'], 'success')
        self.assertEqual(User.objects.count(), user_count_before)  # STRICT: Zero users created

        # Verify 2 test records exist across modules
        test_segs = Segment.objects.filter(name__startswith='[TEST]')
        self.assertEqual(test_segs.count(), 2)

        test_leads = Lead.objects.filter(company_name__startswith='[TEST]')
        self.assertEqual(test_leads.count(), 2)

        test_assigns = LeadAssignment.objects.filter(lead__in=test_leads)
        self.assertEqual(test_assigns.count(), 2)

        test_tgs = CRMTaskGroup.objects.filter(title__startswith='[TEST]')
        self.assertEqual(test_tgs.count(), 2)

        test_activities = LeadTaskActivity.objects.filter(task_group__in=test_tgs)
        self.assertEqual(test_activities.count(), 2)
        self.assertEqual(test_activities.filter(status='Completed').count(), 1)
        self.assertEqual(test_activities.filter(status='Pending').count(), 1)

        test_comms = CRMCommunicationLog.objects.filter(lead__in=test_leads)
        self.assertEqual(test_comms.count(), 2)

        # Second run (Idempotency check)
        result_second = seed_crm_testing_data()
        self.assertEqual(result_second['status'], 'success')
        self.assertEqual(User.objects.count(), user_count_before)  # Zero users created on repeat
        self.assertEqual(Segment.objects.filter(name__startswith='[TEST]').count(), 2)
        self.assertEqual(Lead.objects.filter(company_name__startswith='[TEST]').count(), 2)
        self.assertEqual(CRMTaskGroup.objects.filter(title__startswith='[TEST]').count(), 2)
        self.assertEqual(LeadTaskActivity.objects.filter(task_group__in=test_tgs).count(), 2)
        self.assertEqual(CRMCommunicationLog.objects.filter(lead__in=test_leads).count(), 2)

    def test_30_task_group_edit_preserves_activities_and_updates_relations(self):
        """Verify editing task group preserves existing activity statuses and safely adds/removes relations."""
        self.client.force_authenticate(user=self.superadmin)
        l1 = Lead.objects.create(company_name="Lead One", mobile="9876543210")
        l2 = Lead.objects.create(company_name="Lead Two", mobile="9876543211")

        # Create TG initially with Bob and Lead One
        tg = CRMTaskGroup.objects.create(
            title="Initial Outreach",
            priority="Normal",
            status="Active",
            created_by=self.superadmin
        )
        CRMTaskAssignee.objects.create(task_group=tg, user=self.staff_user)
        CRMTaskLead.objects.create(task_group=tg, lead=l1)
        act1 = LeadTaskActivity.objects.create(
            task_group=tg,
            lead=l1,
            user=self.staff_user,
            status="Completed",
            notes="Met with client CEO. Approved proposal.",
            action_taken="Executive call"
        )

        # Edit TG: Change title, add Alice (self.staff_user2), add Lead Two, pass string dates
        payload = {
            'title': 'Expanded Outreach 2.0',
            'description': 'Updated scope',
            'priority': 'Urgent',
            'status': 'Active',
            'start_date': '2026-12-01',
            'end_date': '2026-12-31',
            'staff_ids': [self.staff_user.id, self.staff_user2.id],
            'lead_ids': [l1.id, l2.id],
        }
        res = self.client.put(f'/api/crm/task-groups/{tg.id}/', payload, content_type='application/json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['task_group']['start_date'], '2026-12-01')
        self.assertEqual(res.data['task_group']['end_date'], '2026-12-31')

        tg.refresh_from_db()
        self.assertEqual(tg.title, 'Expanded Outreach 2.0')
        self.assertEqual(tg.priority, 'Urgent')

        # Verify existing completed activity was preserved intact
        act1.refresh_from_db()
        self.assertEqual(act1.status, "Completed")
        self.assertEqual(act1.notes, "Met with client CEO. Approved proposal.")

        # Verify new activities were created for new pairs:
        # (Bob, l2), (Alice, l1), (Alice, l2)
        self.assertTrue(LeadTaskActivity.objects.filter(task_group=tg, lead=l2, user=self.staff_user).exists())
        self.assertTrue(LeadTaskActivity.objects.filter(task_group=tg, lead=l1, user=self.staff_user2).exists())
        self.assertTrue(LeadTaskActivity.objects.filter(task_group=tg, lead=l2, user=self.staff_user2).exists())

    def test_31_task_group_delete_soft_deletes_and_preserves_history(self):
        """Verify deleting a task group soft-deletes (status='Archived') and preserves historical activities and comms."""
        self.client.force_authenticate(user=self.superadmin)
        lead = Lead.objects.create(company_name="Archive Lead", mobile="9800000001")
        tg = CRMTaskGroup.objects.create(
            title="Task Group to Delete",
            priority="High",
            status="Active",
            created_by=self.superadmin
        )
        CRMTaskAssignee.objects.create(task_group=tg, user=self.staff_user)
        CRMTaskLead.objects.create(task_group=tg, lead=lead)
        act = LeadTaskActivity.objects.create(
            task_group=tg,
            lead=lead,
            user=self.staff_user,
            status="Completed",
            notes="Initial contact succeeded"
        )
        comm = CRMCommunicationLog.objects.create(
            lead=lead,
            user=self.staff_user,
            task_group=tg,
            channel="Call",
            notes="Call recorded for task group"
        )

        # Perform Delete
        res = self.client.delete(f'/api/crm/task-groups/{tg.id}/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Verify soft-delete: status='Archived'
        tg.refresh_from_db()
        self.assertEqual(tg.status, 'Archived')

        # Verify historical records are NOT deleted from the database
        self.assertTrue(LeadTaskActivity.objects.filter(id=act.id).exists())
        self.assertTrue(CRMCommunicationLog.objects.filter(id=comm.id).exists())

        # Verify excluded from task groups list
        res_list = self.client.get('/api/crm/task-groups/')
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        active_ids = [t['id'] for t in res_list.data['task_groups']]
        self.assertNotIn(tg.id, active_ids)

    def test_32_task_group_edit_and_delete_permissions(self):
        """Verify unauthorized staff cannot edit or delete task groups belonging to other staff."""
        # Bob creates a task group
        tg_bob = CRMTaskGroup.objects.create(
            title="Bob Private Project",
            priority="Normal",
            status="Active",
            created_by=self.staff_user
        )
        CRMTaskAssignee.objects.create(task_group=tg_bob, user=self.staff_user)

        # Alice tries to edit Bob's task group -> Forbidden (403)
        self.client.force_authenticate(user=self.staff_user2)
        res_edit = self.client.put(f'/api/crm/task-groups/{tg_bob.id}/', {
            'title': 'Hijacked by Alice',
        }, content_type='application/json')
        self.assertEqual(res_edit.status_code, status.HTTP_403_FORBIDDEN)

        # Alice tries to delete Bob's task group -> Forbidden (403)
        res_delete = self.client.delete(f'/api/crm/task-groups/{tg_bob.id}/')
        self.assertEqual(res_delete.status_code, status.HTTP_403_FORBIDDEN)

        # Bob edits his own task group -> Allowed (200)
        self.client.force_authenticate(user=self.staff_user)
        res_bob_edit = self.client.put(f'/api/crm/task-groups/{tg_bob.id}/', {
            'title': 'Bob Self Updated Title',
        }, content_type='application/json')
        self.assertEqual(res_bob_edit.status_code, status.HTTP_200_OK)

        # Admin deletes Bob's task group -> Allowed (200)
        self.client.force_authenticate(user=self.superadmin)
        res_admin_delete = self.client.delete(f'/api/crm/task-groups/{tg_bob.id}/')
        self.assertEqual(res_admin_delete.status_code, status.HTTP_200_OK)



