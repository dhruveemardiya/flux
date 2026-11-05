from django.test import TestCase, Client
from django.utils import timezone
from api.models import Customer, Company, User, Warehouse, Product, Role

class ModelAndMigrationTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.role = Role.objects.create(role="AdminRole")
        self.user = User.objects.create(
            username="testadmin",
            first_name="Test",
            last_name="Admin",
            role="admin"
        )
        self.user.set_password("pass123")
        self.user.save()

        self.company = Company.objects.create(
            name="Test Pharma Co",
            location="Mumbai"
        )
        self.user.companies.add(self.company)

    def test_customer_model_all_fields(self):
        """Verify Customer model contains all required fields and saves correctly."""
        customer = Customer.objects.create(
            first_name="Rajesh",
            last_name="Sharma",
            phone="9876543210",
            company_name="Sharma Medicals",
            company_upload_name="Batch_2026_01",
            docat="DOC-778899",
            reviews="High priority customer",
            excel_name="customers_january.xlsx",
            file_uploaded_at=timezone.now(),
            address_line1="12 MG Road",
            address_line2="Shop No. 4",
            country="India",
            city="Bengaluru",
            state="Karnataka",
            pincode="560001",
            company=self.company,
            created_by=self.user
        )

        self.assertIsNotNone(customer.id)
        self.assertEqual(customer.first_name, "Rajesh")
        self.assertEqual(customer.last_name, "Sharma")
        self.assertEqual(customer.phone, "9876543210")
        self.assertEqual(customer.company_name, "Sharma Medicals")
        self.assertEqual(customer.company_upload_name, "Batch_2026_01")
        self.assertEqual(customer.docat, "DOC-778899")
        self.assertEqual(customer.reviews, "High priority customer")
        self.assertEqual(customer.excel_name, "customers_january.xlsx")
        self.assertEqual(customer.city, "Bengaluru")
        self.assertEqual(customer.company, self.company)
        self.assertEqual(customer.created_by, self.user)
        self.assertEqual(str(customer), "Rajesh Sharma")

    def test_company_user_relationship(self):
        """Verify company and user many-to-many relationship."""
        self.assertIn(self.company, self.user.companies.all())
        self.assertIn(self.user, self.company.users.all())

    def test_warehouse_and_product(self):
        """Verify warehouse and product creation."""
        warehouse = Warehouse.objects.create(
            name="Central Warehouse",
            code="WH-01",
            description="Main dispatch center",
            company=self.company,
            created_by=self.user
        )
        product = Product.objects.create(
            product_name="Paracetamol 500mg",
            company=self.company,
            created_by=self.user,
            is_active=True
        )
        self.assertEqual(warehouse.company, self.company)
        self.assertEqual(product.company, self.company)
        self.assertTrue(product.is_active)

    def test_lead_model_and_table(self):
        """Verify Lead model saves to table 'lead' and supports the 3 statuses."""
        from api.models import Lead, LeadAssignmentHistory
        self.assertEqual(Lead._meta.db_table, 'lead')
        self.assertEqual(LeadAssignmentHistory._meta.db_table, 'lead_assignment_history')

        lead = Lead.objects.create(
            company_name="Acme Corp",
            first_name="John",
            last_name="Doe",
            phone="9876543210",
            email="john.doe@example.com",
            city="Mumbai",
            state="Maharashtra",
            country="India",
            pincode="400001",
            status=Lead.STATUS_LEAD,
            company=self.company,
            created_by=self.user
        )
        self.assertIsNotNone(lead.id)
        self.assertEqual(lead.status, "Lead")

        # Update status to HostLead
        lead.status = Lead.STATUS_HOSTLEAD
        lead.save()
        self.assertEqual(Lead.objects.get(id=lead.id).status, "HostLead")

        # Update status to Converted
        lead.status = Lead.STATUS_CONVERTED
        lead.save()
        self.assertEqual(Lead.objects.get(id=lead.id).status, "Converted")

    def test_lead_assignment_and_history(self):
        """Verify Lead assignment and assignment history recording."""
        from api.models import Lead, LeadAssignmentHistory
        staff_user = User.objects.create(
            username="staff_member",
            first_name="Staff",
            last_name="One",
            role="User"
        )
        lead = Lead.objects.create(
            company_name="Tech Solutions",
            first_name="Jane",
            last_name="Smith",
            phone="9123456780",
            email="jane@tech.com",
            city="Delhi",
            status=Lead.STATUS_LEAD,
            assigned_to=staff_user,
            assigned_by=self.user,
            assigned_at=timezone.now(),
            company=self.company,
            created_by=self.user
        )
        LeadAssignmentHistory.objects.create(
            lead=lead,
            assigned_to=staff_user,
            assigned_by=self.user,
            notes="Assigned for follow-up"
        )
        self.assertEqual(lead.assigned_to, staff_user)
        self.assertEqual(lead.assigned_by, self.user)
        self.assertEqual(lead.assignment_history.count(), 1)
        self.assertEqual(lead.assignment_history.first().assigned_to, staff_user)


from rest_framework.test import APIClient
from api.models import Lead, LeadAssignmentHistory


class LeadRolePermissionTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.company = Company.objects.create(name="Apex Medicals", location="Ahmedabad")

        # Create test users for all 4 roles
        self.admin_user = User.objects.create(
            username="test_admin",
            first_name="Admin",
            last_name="User",
            role="admin"
        )
        self.admin_user.set_password("pass123")
        self.admin_user.companies.add(self.company)
        self.admin_user.save()

        self.superadmin_user = User.objects.create(
            username="test_superadmin",
            first_name="Super",
            last_name="Admin",
            role="superadmin"
        )
        self.superadmin_user.set_password("pass123")
        self.superadmin_user.save()

        self.techadmin_user = User.objects.create(
            username="test_techadmin",
            first_name="Tech",
            last_name="Admin",
            role="techadmin"
        )
        self.techadmin_user.set_password("pass123")
        self.techadmin_user.save()

        self.regular_user = User.objects.create(
            username="test_regular_user",
            first_name="Regular",
            last_name="Staff",
            role="User"
        )
        self.regular_user.set_password("pass123")
        self.regular_user.companies.add(self.company)
        self.regular_user.save()

        # Create a sample lead
        self.sample_lead = Lead.objects.create(
            company_name="Sample Pharma",
            first_name="Ramesh",
            last_name="Patel",
            phone="9876543211",
            email="ramesh@sample.com",
            city="Ahmedabad",
            status=Lead.STATUS_LEAD,
            company=self.company,
            created_by=self.admin_user
        )

    def test_regular_user_cannot_access_lead_apis(self):
        """Regular 'User' role must be denied access (403 Forbidden) to all Lead APIs."""
        self.client.force_authenticate(user=self.regular_user)

        # 1. List leads
        res = self.client.get('/api/leads/')
        self.assertEqual(res.status_code, 403)

        # 2. Filter options
        res = self.client.get('/api/leads/filters/')
        self.assertEqual(res.status_code, 403)

        # 3. Create lead
        res = self.client.post('/api/leads/', {'company_name': 'Hacked Co', 'phone': '9999988888'})
        self.assertEqual(res.status_code, 403)

        # 4. Detail view
        res = self.client.get(f'/api/leads/{self.sample_lead.id}/')
        self.assertEqual(res.status_code, 403)

        # 5. Update lead
        res = self.client.put(f'/api/leads/{self.sample_lead.id}/', {'city': 'Surat'})
        self.assertEqual(res.status_code, 403)

        # 6. Delete lead
        res = self.client.delete(f'/api/leads/{self.sample_lead.id}/')
        self.assertEqual(res.status_code, 403)

        # 7. Status update
        res = self.client.post(f'/api/leads/{self.sample_lead.id}/status/', {'status': 'Converted'})
        self.assertEqual(res.status_code, 403)

        # 8. Bulk status
        res = self.client.post('/api/leads/bulk-status/', {'lead_ids': [self.sample_lead.id], 'status': 'HostLead'})
        self.assertEqual(res.status_code, 403)

        # 9. Bulk assign
        res = self.client.post('/api/leads/assign/', {'lead_ids': [self.sample_lead.id], 'assigned_to_id': self.regular_user.id})
        self.assertEqual(res.status_code, 403)

        # 10. Upload
        res = self.client.post('/api/leads/upload/', {'rows': []}, format='json')
        self.assertEqual(res.status_code, 403)

    def test_admin_role_can_manage_and_assign_leads(self):
        """Admin role can list, create, edit, delete, and assign leads to Users or unassign."""
        self.client.force_authenticate(user=self.admin_user)

        # 1. List leads
        res = self.client.get('/api/leads/')
        self.assertEqual(res.status_code, 200)
        self.assertIn('leads', res.data)

        # 2. Filter options includes assignable users
        res = self.client.get('/api/leads/filters/')
        self.assertEqual(res.status_code, 200)
        assignee_ids = [u['id'] for u in res.data['assignable_users']]
        self.assertIn(self.regular_user.id, assignee_ids)

        # 3. Create lead
        res = self.client.post('/api/leads/', {
            'company_name': 'Admin Created Co',
            'first_name': 'Amit',
            'phone': '9111223344',
            'city': 'Ahmedabad',
            'assigned_to': self.regular_user.id
        })
        self.assertEqual(res.status_code, 201)
        created_lead_id = res.data['lead']['id']

        # 4. Assign lead to regular User
        res = self.client.post('/api/leads/assign/', {
            'lead_ids': [self.sample_lead.id],
            'assigned_to_id': self.regular_user.id,
            'notes': 'Assigned by admin'
        })
        self.assertEqual(res.status_code, 200)
        self.sample_lead.refresh_from_db()
        self.assertEqual(self.sample_lead.assigned_to, self.regular_user)

        # 5. Unassign lead
        res = self.client.post('/api/leads/assign/', {
            'lead_ids': [self.sample_lead.id],
            'assigned_to_id': None,
            'notes': 'Unassigned by admin'
        })
        self.assertEqual(res.status_code, 200)
        self.sample_lead.refresh_from_db()
        self.assertIsNone(self.sample_lead.assigned_to)

        # 6. Delete created lead
        res = self.client.delete(f'/api/leads/{created_lead_id}/')
        self.assertEqual(res.status_code, 200)

    def test_superadmin_role_can_manage_leads(self):
        """Super Admin role can access, list, assign, and delete leads."""
        self.client.force_authenticate(user=self.superadmin_user)

        res = self.client.get('/api/leads/')
        self.assertEqual(res.status_code, 200)

        res = self.client.post('/api/leads/assign/', {
            'lead_ids': [self.sample_lead.id],
            'assigned_to_id': self.regular_user.id
        })
        self.assertEqual(res.status_code, 200)
        self.sample_lead.refresh_from_db()
        self.assertEqual(self.sample_lead.assigned_to, self.regular_user)

    def test_techadmin_role_can_manage_leads(self):
        """Tech Admin role can access, list, assign, and delete leads."""
        self.client.force_authenticate(user=self.techadmin_user)

        res = self.client.get('/api/leads/')
        self.assertEqual(res.status_code, 200)

        res = self.client.post('/api/leads/assign/', {
            'lead_ids': [self.sample_lead.id],
            'assigned_to_id': self.regular_user.id
        })
        self.assertEqual(res.status_code, 200)
        self.sample_lead.refresh_from_db()
        self.assertEqual(self.sample_lead.assigned_to, self.regular_user)


class TaskManagerFunctionalityTests(TestCase):
    def setUp(self):
        from rest_framework.test import APIClient
        from datetime import date
        from api.models import Lead, LeadTask, TaskCallHistory

        self.client = APIClient()

        # Admin user
        self.admin = User.objects.create(
            username="admin_user",
            first_name="Admin",
            last_name="System",
            role="admin"
        )
        self.admin.set_password("pass123")
        self.admin.save()

        # Dhruvi (Regular User)
        self.dhruvi = User.objects.create(
            username="dhruvi",
            first_name="Dhruvi",
            last_name="Patel",
            role="user"
        )
        self.dhruvi.set_password("Dhruvi@123")
        self.dhruvi.save()

        # Another Regular User
        self.other_user = User.objects.create(
            username="other_user",
            first_name="Other",
            last_name="User",
            role="user"
        )
        self.other_user.set_password("pass123")
        self.other_user.save()

        # Sample Leads
        self.lead1 = Lead.objects.create(
            company_name="Apex Healthcare Ltd",
            first_name="Raj",
            last_name="Shah",
            email="raj@apexhealth.com",
            phone="9876543210",
            mobile="9876543210",
            city="Ahmedabad",
            status=Lead.STATUS_LEAD,
            notes="Interested in bulk procurement"
        )

        self.lead2 = Lead.objects.create(
            company_name="Zenith Diagnostics",
            first_name="Kiran",
            last_name="Mehta",
            email="kiran@zenith.com",
            phone="9123456780",
            mobile="9123456780",
            city="Mumbai",
            status=Lead.STATUS_LEAD,
            notes="Follow up next quarter"
        )

    def test_complete_task_manager_workflow(self):
        """
        Verify complete task manager lifecycle:
        1. Admin assigns lead to Dhruvi
        2. Dhruvi logs in and sees assigned lead in Task Manager
        3. Dhruvi edits description and assigned date
        4. Dhruvi records first call discussion and schedules follow-up for 5 November
        5. Reminder appears automatically 1 day prior (4 November)
        6. Dhruvi records future discussion notes
        7. Multiple calls preserved without overwriting history
        8. Dhruvi toggles status between Pending and Completed
        9. Dhruvi deletes task with immediate update
        10. Permission isolation between regular users
        """
        from datetime import date, timedelta
        from api.models import LeadTask, TaskCallHistory

        # Step 1: Admin assigns lead1 to Dhruvi
        self.client.force_authenticate(user=self.admin)
        assign_res = self.client.post('/api/leads/assign/', {
            'lead_ids': [self.lead1.id],
            'assigned_to_id': self.dhruvi.id,
            'notes': 'Assigned to Dhruvi for medical client follow-up'
        }, format='json')
        self.assertEqual(assign_res.status_code, 200)

        # Step 2: Dhruvi logs in and accesses Task Manager (/api/tasks/)
        self.client.force_authenticate(user=self.dhruvi)
        res = self.client.get('/api/tasks/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data['tasks']), 1)

        task_data = res.data['tasks'][0]
        task_id = task_data['id']
        self.assertEqual(task_data['company_name'], "Apex Healthcare Ltd")
        self.assertEqual(task_data['contact_person'], "Raj Shah")
        self.assertEqual(task_data['email'], "raj@apexhealth.com")
        self.assertEqual(task_data['mobile'], "9876543210")
        self.assertEqual(task_data['status'], "Pending")

        # Step 3: Dhruvi edits description and assigned date
        new_assigned_date = "2026-10-31"
        edit_res = self.client.patch(f'/api/tasks/{task_id}/', {
            'description': 'Called client - discussed equipment demonstration requirements.',
            'assigned_date': new_assigned_date
        }, format='json')
        self.assertEqual(edit_res.status_code, 200)
        self.assertEqual(edit_res.data['task']['description'], 'Called client - discussed equipment demonstration requirements.')
        self.assertEqual(edit_res.data['task']['assigned_date'], new_assigned_date)

        # Step 4: Dhruvi records first call and schedules next follow-up for 5 November 2026
        # Example from prompt:
        # First call: 31 October 2026.
        # Customer says: "Call me again on 5 November 2026."
        # Next follow-up: 5 November 2026 -> Reminder: 4 November 2026
        call_res = self.client.post(f'/api/tasks/{task_id}/calls/', {
            'call_date': '2026-10-31',
            'discussion': 'First call: Customer requested callback on 5 November after committee review.',
            'next_followup_date': '2026-11-05',
            'future_discussion': 'Discuss quotation discounts and demo schedule.'
        }, format='json')
        self.assertEqual(call_res.status_code, 200)
        updated_task = call_res.data['task']
        self.assertEqual(updated_task['next_followup_date'], '2026-11-05')
        self.assertEqual(updated_task['reminder_date'], '2026-11-04')
        self.assertEqual(updated_task['future_discussion'], 'Discuss quotation discounts and demo schedule.')

        # Step 5: Dhruvi records second call (e.g. on 5 November) to verify history preservation
        second_call_res = self.client.post(f'/api/tasks/{task_id}/calls/', {
            'call_date': '2026-11-05',
            'discussion': 'Second call: Committee approved proposal, schedule contract signing.',
            'next_followup_date': '2026-11-12',
            'future_discussion': 'Sign contract and collect advance payment.'
        }, format='json')
        self.assertEqual(second_call_res.status_code, 200)

        # Verify call history has both records preserved without overwriting
        detail_res = self.client.get(f'/api/tasks/{task_id}/')
        self.assertEqual(detail_res.status_code, 200)
        call_history = detail_res.data['task']['call_history']
        self.assertEqual(len(call_history), 2)
        # Check that both discussions are intact
        discussions = [c['discussion'] for c in call_history]
        self.assertTrue(any("First call" in d for d in discussions))
        self.assertTrue(any("Second call" in d for d in discussions))

        # Step 6: Verify Notification Reminders
        # Create a task with reminder_date <= today to test notification bell
        today = timezone.now().date()
        due_tomorrow = today + timedelta(days=1)
        # Follow-up date is tomorrow -> Reminder is today (1 day before)
        task_obj = LeadTask.objects.get(id=task_id)
        task_obj.next_followup_date = due_tomorrow
        task_obj.save()
        self.assertEqual(task_obj.reminder_date, today)

        notif_res = self.client.get('/api/tasks/notifications/')
        self.assertEqual(notif_res.status_code, 200)
        self.assertGreaterEqual(notif_res.data['count'], 1)
        notif_ids = [n['task_id'] for n in notif_res.data['notifications']]
        self.assertIn(task_id, notif_ids)

        # Step 7: Mark task as Completed
        status_res = self.client.post(f'/api/tasks/{task_id}/status/', {'status': 'Completed'}, format='json')
        self.assertEqual(status_res.status_code, 200)
        self.assertEqual(status_res.data['task']['status'], 'Completed')

        # Completed tasks must NOT appear in notification reminders
        notif_after_completed = self.client.get('/api/tasks/notifications/')
        completed_notif_ids = [n['task_id'] for n in notif_after_completed.data['notifications']]
        self.assertNotIn(task_id, completed_notif_ids)

        # Step 8: Permissions: another regular user cannot view or modify Dhruvi's task
        self.client.force_authenticate(user=self.other_user)
        other_list_res = self.client.get('/api/tasks/')
        self.assertEqual(other_list_res.status_code, 200)
        self.assertEqual(len(other_list_res.data['tasks']), 0)

        other_access_res = self.client.get(f'/api/tasks/{task_id}/')
        self.assertEqual(other_access_res.status_code, 404)

        other_edit_res = self.client.patch(f'/api/tasks/{task_id}/', {'description': 'Hacked'})
        self.assertEqual(other_edit_res.status_code, 404)

        # Step 9: Dhruvi deletes the task
        self.client.force_authenticate(user=self.dhruvi)
        del_res = self.client.delete(f'/api/tasks/{task_id}/')
        self.assertEqual(del_res.status_code, 200)

        # Deleted task does not appear in active task list
        list_after_delete = self.client.get('/api/tasks/')
        self.assertEqual(len(list_after_delete.data['tasks']), 0)

    def test_multi_user_lead_assignment_and_followup(self):
        """
        Verify multi-user assignment, independent follow-ups, and unassignment:
        1. Create a lead assigned simultaneously to Dhruvi and OtherUser
        2. Both Dhruvi and OtherUser see the lead in their Task Manager
        3. Dhruvi logs WhatsApp interaction with follow-up notes
        4. OtherUser logs Email interaction with distinct follow-up notes without overwriting
        5. Removing OtherUser removes lead from OtherUser's Task Manager, Dhruvi still has it
        6. ProductStock str representation test
        """
        from datetime import date, timedelta
        from api.models import Lead, LeadTask, TaskCallHistory, ProductStock, Product, Warehouse

        # Step 1: Admin creates lead assigned to multiple users
        self.client.force_authenticate(user=self.admin)
        create_res = self.client.post('/api/leads/', {
            'company_name': 'Multi Assign Health Ltd',
            'first_name': 'Ankit',
            'last_name': 'Patel',
            'email': 'ankit@multiassign.com',
            'phone': '9900112233',
            'assigned_to': [self.dhruvi.id, self.other_user.id],
            'notes': 'Multi-assign test notes'
        }, format='json')
        self.assertEqual(create_res.status_code, 201)
        lead_id = create_res.data['lead']['id']

        # Step 2: Verify assigned_user_ids contains both
        lead = Lead.objects.get(id=lead_id)
        assigned_ids = set(lead.assignments.values_list('user_id', flat=True))
        self.assertIn(self.dhruvi.id, assigned_ids)
        self.assertIn(self.other_user.id, assigned_ids)

        # Step 3: Dhruvi sees the lead in Task Manager
        self.client.force_authenticate(user=self.dhruvi)
        dhruvi_tasks_res = self.client.get('/api/tasks/')
        self.assertEqual(dhruvi_tasks_res.status_code, 200)
        dhruvi_lead_ids = [t['lead_id'] for t in dhruvi_tasks_res.data['tasks']]
        self.assertIn(lead_id, dhruvi_lead_ids)
        dhruvi_task = next(t for t in dhruvi_tasks_res.data['tasks'] if t['lead_id'] == lead_id)

        # Step 4: OtherUser also sees the lead in Task Manager
        self.client.force_authenticate(user=self.other_user)
        other_tasks_res = self.client.get('/api/tasks/')
        self.assertEqual(other_tasks_res.status_code, 200)
        other_lead_ids = [t['lead_id'] for t in other_tasks_res.data['tasks']]
        self.assertIn(lead_id, other_lead_ids)
        other_task = next(t for t in other_tasks_res.data['tasks'] if t['lead_id'] == lead_id)

        # Both have different task IDs
        self.assertNotEqual(dhruvi_task['id'], other_task['id'])

        # Step 5: Dhruvi records WhatsApp communication
        self.client.force_authenticate(user=self.dhruvi)
        dhruvi_comm_res = self.client.post(f"/api/tasks/{dhruvi_task['id']}/calls/", {
            'interaction_type': 'WhatsApp',
            'interaction_date': '2026-11-05',
            'communication_notes': 'Sent catalogue and pricing over WhatsApp.',
            'next_followup_date': '2026-11-10',
            'next_followup_notes': 'Call on phone for confirmation.'
        }, format='json')
        self.assertEqual(dhruvi_comm_res.status_code, 200)
        self.assertEqual(dhruvi_comm_res.data['task']['next_followup_date'], '2026-11-10')

        # Step 6: OtherUser records Email communication independently
        self.client.force_authenticate(user=self.other_user)
        other_comm_res = self.client.post(f"/api/tasks/{other_task['id']}/calls/", {
            'interaction_type': 'Email',
            'interaction_date': '2026-11-05',
            'communication_notes': 'Sent formal introduction email with NDA.',
            'next_followup_date': '2026-11-15',
            'next_followup_notes': 'Wait for signed NDA reply.'
        }, format='json')
        self.assertEqual(other_comm_res.status_code, 200)
        self.assertEqual(other_comm_res.data['task']['next_followup_date'], '2026-11-15')

        # Verify Dhruvi's task was NOT overwritten by OtherUser's follow-up
        self.client.force_authenticate(user=self.dhruvi)
        dhruvi_detail = self.client.get(f"/api/tasks/{dhruvi_task['id']}/")
        self.assertEqual(dhruvi_detail.data['task']['next_followup_date'], '2026-11-10')
        self.assertEqual(len(dhruvi_detail.data['task']['call_history']), 1)
        self.assertEqual(dhruvi_detail.data['task']['call_history'][0]['interaction_type'], 'WhatsApp')

        # Step 7: Admin removes OtherUser from assignment (keeps Dhruvi)
        self.client.force_authenticate(user=self.admin)
        reassign_res = self.client.patch(f'/api/leads/{lead_id}/', {
            'assigned_to': [self.dhruvi.id]
        }, format='json')
        self.assertEqual(reassign_res.status_code, 200)

        # OtherUser's Task Manager should no longer show the lead
        self.client.force_authenticate(user=self.other_user)
        other_tasks_after = self.client.get('/api/tasks/')
        other_after_ids = [t['lead_id'] for t in other_tasks_after.data['tasks']]
        self.assertNotIn(lead_id, other_after_ids)

        # Dhruvi still has the lead in Task Manager
        self.client.force_authenticate(user=self.dhruvi)
        dhruvi_tasks_after = self.client.get('/api/tasks/')
        dhruvi_after_ids = [t['lead_id'] for t in dhruvi_tasks_after.data['tasks']]
        self.assertIn(lead_id, dhruvi_after_ids)

        # Step 8: Verify ProductStock __str__ safety
        prod = Product.objects.create(product_name="Digital Syringe", company=self.company)
        wh = Warehouse.objects.create(name="Central Depot", company=self.company)
        stock = ProductStock.objects.create(product=prod, warehouse=wh, date=date.today(), quantity=50, company=self.company)
        self.assertIn("Digital Syringe", str(stock))




class MobileAppAPIsTestSuite(TestCase):
    def setUp(self):
        from rest_framework.test import APIClient
        self.client = APIClient()

        self.techadmin = User.objects.create(
            username="techadmin_test",
            first_name="Tech",
            last_name="Admin",
            role="techadmin",
            email="techadmin@sky9.ai"
        )
        self.techadmin.set_password("AdminPass@123")
        self.techadmin.save()

        self.dhruvi = User.objects.create(
            username="dhruvi_mobile",
            first_name="Dhruvi",
            last_name="Patel",
            role="User",
            email="dhruvi@sky9.ai"
        )
        self.dhruvi.set_password("DhruviPass@123")
        self.dhruvi.save()

        self.juhi = User.objects.create(
            username="juhi_mobile",
            first_name="Juhi",
            last_name="Vanjara",
            role="User",
            email="juhi@sky9.ai"
        )
        self.juhi.set_password("JuhiPass@123")
        self.juhi.save()

        self.company = Company.objects.create(name="Mobile Test Pharma", location="Ahmedabad")
        self.techadmin.companies.add(self.company)
        self.dhruvi.companies.add(self.company)

    def test_jwt_auth_and_session_lifecycle(self):
        """
        Tests the complete JWT lifecycle:
        1. Login with credentials to obtain JWT access & refresh tokens
        2. Access /api/auth/me/ with Bearer access token
        3. Refresh token at /api/auth/token/refresh/
        4. Logout and verify revocation
        """
        # 1. Login with invalid password -> 401
        res = self.client.post('/api/auth/token/', {
            'username': 'dhruvi_mobile',
            'password': 'WrongPassword!'
        }, format='json')
        self.assertEqual(res.status_code, 401)

        # Login with valid password -> 200
        res = self.client.post('/api/auth/token/', {
            'username': 'dhruvi_mobile',
            'password': 'DhruviPass@123'
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertIn('access', res.data)
        self.assertIn('refresh', res.data)
        self.assertEqual(res.data['token_type'], 'Bearer')
        self.assertEqual(res.data['user']['username'], 'dhruvi_mobile')

        access_token = res.data['access']
        refresh_token = res.data['refresh']

        # 2. Access /api/auth/me/ using Bearer header
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        me_res = self.client.get('/api/auth/me/')
        self.assertEqual(me_res.status_code, 200)
        self.assertEqual(me_res.data['username'], 'dhruvi_mobile')
        self.assertEqual(me_res.data['full_name'], 'Dhruvi Patel')

        # 3. Refresh token -> new access token
        ref_res = self.client.post('/api/auth/token/refresh/', {
            'refresh': refresh_token
        }, format='json')
        self.assertEqual(ref_res.status_code, 200)
        self.assertIn('access', ref_res.data)
        new_access = ref_res.data['access']

        # 4. Use new access token
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {new_access}')
        me_res2 = self.client.get('/api/auth/me/')
        self.assertEqual(me_res2.status_code, 200)

        # 5. Logout & revoke
        logout_res = self.client.post('/api/auth/logout/', {
            'refresh': refresh_token
        }, format='json')
        self.assertEqual(logout_res.status_code, 200)

        # Refresh with revoked token -> 401
        revoked_res = self.client.post('/api/auth/token/refresh/', {
            'refresh': refresh_token
        }, format='json')
        self.assertEqual(revoked_res.status_code, 401)

    def test_lead_assignees_list_and_individual_removal(self):
        """
        Tests Section 3 APIs:
        - GET /api/leads/{id}/assignments/
        - DELETE /api/leads/{id}/assignments/{uid}/
        """
        from api.models import Lead, LeadAssignment, LeadTask

        # Create lead with two assignees: Dhruvi and Juhi
        lead = Lead.objects.create(
            company_name="Apex Healthcare Ltd",
            first_name="Raj",
            last_name="Shah",
            phone="9876543210",
            email="raj@apexhealth.com",
            city="Ahmedabad"
        )
        LeadAssignment.objects.create(lead=lead, user=self.dhruvi, assigned_by=self.techadmin)
        LeadAssignment.objects.create(lead=lead, user=self.juhi, assigned_by=self.techadmin)
        lead.assigned_to = self.dhruvi
        lead.save()

        # Create task for each
        LeadTask.objects.create(lead=lead, assigned_to=self.dhruvi, status='Pending')
        LeadTask.objects.create(lead=lead, assigned_to=self.juhi, status='Pending')

        # Techadmin checks assignments
        self.client.force_authenticate(user=self.techadmin)
        res = self.client.get(f'/api/leads/{lead.id}/assignments/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['total_assigned'], 2)
        assignee_uids = [a['user_id'] for a in res.data['assignments']]
        self.assertIn(self.dhruvi.id, assignee_uids)
        self.assertIn(self.juhi.id, assignee_uids)

        # Remove Juhi from lead
        del_res = self.client.delete(f'/api/leads/{lead.id}/assignments/{self.juhi.id}/')
        self.assertEqual(del_res.status_code, 200)
        self.assertEqual(del_res.data['remaining_assigned_count'], 1)

        # Juhi's task is soft-deleted
        juhi_task = LeadTask.objects.get(lead=lead, assigned_to=self.juhi)
        self.assertTrue(juhi_task.is_deleted)

        # Dhruvi's task is still active
        dhruvi_task = LeadTask.objects.get(lead=lead, assigned_to=self.dhruvi)
        self.assertFalse(dhruvi_task.is_deleted)

    def test_communication_history_and_lead_360_interactions(self):
        """
        Tests Section 5 APIs:
        - GET /api/tasks/{id}/history/
        - GET /api/leads/{id}/interactions/
        """
        from api.models import Lead, LeadTask, TaskCallHistory

        lead = Lead.objects.create(
            company_name="Zydus Life Sciences",
            first_name="Amit",
            last_name="Mehta",
            phone="9871122334"
        )
        task_dhruvi = LeadTask.objects.create(lead=lead, assigned_to=self.dhruvi, status='Pending')
        task_juhi = LeadTask.objects.create(lead=lead, assigned_to=self.juhi, status='Pending')

        # Log calls
        TaskCallHistory.objects.create(
            task=task_dhruvi,
            lead=lead,
            user=self.dhruvi,
            interaction_type='WhatsApp',
            discussion='Shared product deck on WhatsApp.'
        )
        TaskCallHistory.objects.create(
            task=task_juhi,
            lead=lead,
            user=self.juhi,
            interaction_type='Email',
            discussion='Sent quotation by Email.'
        )

        # 1. Dhruvi checks her own task history -> only 1 interaction
        self.client.force_authenticate(user=self.dhruvi)
        dhruvi_hist = self.client.get(f'/api/tasks/{task_dhruvi.id}/history/')
        self.assertEqual(dhruvi_hist.status_code, 200)
        self.assertEqual(dhruvi_hist.data['count'], 1)
        self.assertEqual(dhruvi_hist.data['history'][0]['interaction_type'], 'WhatsApp')

        # 2. Check Lead 360 interactions -> both interactions aggregated
        interactions_res = self.client.get(f'/api/leads/{lead.id}/interactions/')
        self.assertEqual(interactions_res.status_code, 200)
        self.assertEqual(interactions_res.data['total_interactions'], 2)

    def test_mobile_push_device_token_apis(self):
        """
        Tests Section 6 APIs:
        - POST   /api/notifications/device-token/
        - DELETE /api/notifications/device-token/
        """
        from api.models import MobileDeviceToken

        self.client.force_authenticate(user=self.dhruvi)

        # Register device token
        res = self.client.post('/api/notifications/device-token/', {
            'token': 'fcm_sample_token_dhruvi_device_001',
            'platform': 'android'
        }, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['platform'], 'android')
        self.assertTrue(MobileDeviceToken.objects.filter(token='fcm_sample_token_dhruvi_device_001').exists())

        # Unregister device token
        del_res = self.client.delete('/api/notifications/device-token/', {
            'token': 'fcm_sample_token_dhruvi_device_001'
        }, format='json')
        self.assertEqual(del_res.status_code, 200)
        self.assertFalse(MobileDeviceToken.objects.filter(token='fcm_sample_token_dhruvi_device_001').exists())
