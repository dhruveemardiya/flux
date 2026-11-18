import 'package:flutter_test/flutter_test.dart';
import 'package:flux_crm_mobile/models/user_model.dart';
import 'package:flux_crm_mobile/models/lead_model.dart';
import 'package:flux_crm_mobile/models/segment_model.dart';
import 'package:flux_crm_mobile/models/task_group_model.dart';
import 'package:flux_crm_mobile/models/work_activity_model.dart';
import 'package:flux_crm_mobile/models/communication_log_model.dart';

void main() {
  group('CRM Models Serialization & Deserialization Tests', () {
    test('CRMUser serialization test', () {
      final json = {
        'id': 10,
        'username': 'john_admin',
        'email': 'john@flux.com',
        'first_name': 'John',
        'last_name': 'Doe',
        'role': 'admin',
        'is_active': true,
      };

      final user = CRMUser.fromJson(json);
      expect(user.id, 10);
      expect(user.username, 'john_admin');
      expect(user.displayName, 'John Doe');
      expect(user.isAdmin, true);
      expect(user.isManager, true);

      final serialized = user.serialize();
      final restored = CRMUser.deserialize(serialized);
      expect(restored.username, user.username);
      expect(restored.role, user.role);
    });

    test('CRMLead deserialization test', () {
      final json = {
        'id': 101,
        'company_name': 'Acme Global Corp',
        'contact_person': 'Jane Smith',
        'email': 'jane@acme.com',
        'phone': '+1234567890',
        'status': 'qualified',
        'segment': {'id': 5, 'name': 'Enterprise SaaS'},
        'assigned_to': {'id': 2, 'username': 'sales_rep_1'},
        'notes': 'High priority deal for Q4',
      };

      final lead = CRMLead.fromJson(json);
      expect(lead.id, 101);
      expect(lead.companyName, 'Acme Global Corp');
      expect(lead.segmentId, 5);
      expect(lead.segmentName, 'Enterprise SaaS');
      expect(lead.assignedToId, 2);
      expect(lead.assignedToName, 'sales_rep_1');
      expect(lead.status, 'qualified');
    });

    test('CRMSegment deserialization test', () {
      final json = {
        'id': 4,
        'name': 'Healthcare & Life Sciences',
        'description': 'Hospitals and pharma companies',
        'leads_count': 18,
      };

      final segment = CRMSegment.fromJson(json);
      expect(segment.id, 4);
      expect(segment.name, 'Healthcare & Life Sciences');
      expect(segment.leadCount, 18);
    });

    test('TaskGroup progress calculation test', () {
      final json = {
        'id': 1,
        'title': 'Outbound Lead Verification',
        'description': 'Verify phone numbers and emails',
        'start_date': '2026-11-01',
        'end_date': '2026-11-30',
        'priority': 'high',
        'status': 'active',
        'activities_count': 10,
        'completed_activities': 6,
      };

      final tg = TaskGroup.fromJson(json);
      expect(tg.totalActivities, 10);
      expect(tg.completedActivities, 6);
      expect(tg.progress, 0.6);
      expect(tg.progressPercent, 60);
    });

    test('LeadTaskActivity completion status test', () {
      final json = {
        'id': 45,
        'task_group_id': 1,
        'task_title': 'Cold Calling',
        'lead_id': 101,
        'lead_company': 'Acme Global Corp',
        'status': 'completed',
        'notes': 'Spoke with CFO, agreed to demo next Tuesday.',
      };

      final act = LeadTaskActivity.fromJson(json);
      expect(act.id, 45);
      expect(act.leadCompany, 'Acme Global Corp');
      expect(act.isCompleted, true);
    });

    test('CRMCommunicationLog deserialization test', () {
      final json = {
        'id': 12,
        'lead': 101,
        'lead_company': 'Acme Global Corp',
        'channel': 'meeting',
        'summary': 'Introductory product demo',
        'notes': 'Presented Flux CRM architecture and DRF integration.',
        'logged_by_name': 'Sarah Manager',
        'created_at': '2026-11-18T10:30:00Z',
      };

      final log = CRMCommunicationLog.fromJson(json);
      expect(log.id, 12);
      expect(log.channel, 'meeting');
      expect(log.summary, 'Introductory product demo');
      expect(log.loggedByName, 'Sarah Manager');
    });
  });
}
