import 'package:flutter_test/flutter_test.dart';
import 'package:flux_crm_mobile/core/api/api_endpoints.dart';

void main() {
  group('API Endpoints Formatting Tests', () {
    test('Authentication endpoints', () {
      expect(ApiEndpoints.login, '/login/');
      expect(ApiEndpoints.logout, '/logout/');
      expect(ApiEndpoints.currentUser, '/users/me/');
    });

    test('Parameterized detail endpoints', () {
      expect(ApiEndpoints.userDetail(42), '/users/42/');
      expect(ApiEndpoints.segmentDetail(5), '/crm/segments/5/');
      expect(ApiEndpoints.leadDetail(101), '/crm/leads/101/');
      expect(ApiEndpoints.taskGroupDetail(8), '/crm/task-groups/8/');
      expect(ApiEndpoints.myWorkActivityUpdate(19), '/crm/my-work/activities/19/');
      expect(ApiEndpoints.leadTimeline(101), '/crm/leads/101/timeline/');
    });

    test('Import endpoints', () {
      expect(ApiEndpoints.leadImportPreview, '/crm/leads/import/preview/');
      expect(ApiEndpoints.leadImportCommit, '/crm/leads/import/commit/');
    });
  });
}
