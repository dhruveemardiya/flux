import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../core/auth/auth_controller.dart';
import '../features/authentication/screens/login_screen.dart';
import '../features/dashboard/screens/dashboard_screen.dart';
import '../features/leads/screens/leads_screen.dart';
import '../features/leads/screens/lead_detail_screen.dart';
import '../features/leads/screens/lead_form_screen.dart';
import '../features/lead_import/screens/lead_import_screen.dart';
import '../features/tasks/screens/tasks_screen.dart';
import '../features/tasks/screens/task_detail_screen.dart';
import '../features/tasks/screens/task_form_screen.dart';
import '../features/my_work/screens/my_work_screen.dart';
import '../features/reports/screens/reports_screen.dart';
import '../features/users/screens/users_screen.dart';
import '../features/segments/screens/segments_screen.dart';
import '../features/assignments/screens/assignments_screen.dart';
import '../features/quick_search/screens/quick_search_screen.dart';
import '../features/communication_timeline/screens/communication_timeline_screen.dart';
import '../features/navigation/main_scaffold.dart';
import '../models/lead_model.dart';
import '../models/task_group_model.dart';

/// Application router with auth redirection guard and nested module routes.
GoRouter createRouter(AuthController authController) {
  return GoRouter(
    initialLocation: '/dashboard',
    refreshListenable: authController,
    redirect: (BuildContext context, GoRouterState state) {
      final isAuth = authController.isAuthenticated;
      final isLoggingIn = state.matchedLocation == '/login';

      if (!isAuth && !isLoggingIn) {
        return '/login';
      }
      if (isAuth && isLoggingIn) {
        return '/dashboard';
      }
      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),

      // Shell route hosting the persistent BottomNav and Navigation Drawer
      ShellRoute(
        builder: (context, state, child) {
          return MainScaffold(
            location: state.matchedLocation,
            child: child,
          );
        },
        routes: [
          GoRoute(
            path: '/dashboard',
            builder: (context, state) => const DashboardScreen(),
          ),
          GoRoute(
            path: '/leads',
            builder: (context, state) => const LeadsScreen(),
            routes: [
              GoRoute(
                path: 'create',
                builder: (context, state) => const LeadFormScreen(),
              ),
              GoRoute(
                path: 'import',
                builder: (context, state) => const LeadImportScreen(),
              ),
              GoRoute(
                path: ':id',
                builder: (context, state) {
                  final id = int.tryParse(state.pathParameters['id'] ?? '0') ?? 0;
                  return LeadDetailScreen(leadId: id);
                },
                routes: [
                  GoRoute(
                    path: 'edit',
                    builder: (context, state) {
                      final lead = state.extra as CRMLead?;
                      return LeadFormScreen(existingLead: lead);
                    },
                  ),
                  GoRoute(
                    path: 'timeline',
                    builder: (context, state) {
                      final id = int.tryParse(state.pathParameters['id'] ?? '0') ?? 0;
                      final lead = state.extra as CRMLead?;
                      return CommunicationTimelineScreen(leadId: id, lead: lead);
                    },
                  ),
                ],
              ),
            ],
          ),
          GoRoute(
            path: '/tasks',
            builder: (context, state) => const TasksScreen(),
            routes: [
              GoRoute(
                path: 'create',
                builder: (context, state) => const TaskFormScreen(),
              ),
              GoRoute(
                path: ':id',
                builder: (context, state) {
                  final id = int.tryParse(state.pathParameters['id'] ?? '0') ?? 0;
                  return TaskDetailScreen(taskGroupId: id);
                },
                routes: [
                  GoRoute(
                    path: 'edit',
                    builder: (context, state) {
                      final taskGroup = state.extra as TaskGroup?;
                      return TaskFormScreen(existingTaskGroup: taskGroup);
                    },
                  ),
                ],
              ),
            ],
          ),
          GoRoute(
            path: '/my-work',
            builder: (context, state) => const MyWorkScreen(),
          ),
          GoRoute(
            path: '/reports',
            builder: (context, state) => const ReportsScreen(),
          ),
          GoRoute(
            path: '/users',
            builder: (context, state) => const UsersScreen(),
          ),
          GoRoute(
            path: '/segments',
            builder: (context, state) => const SegmentsScreen(),
          ),
          GoRoute(
            path: '/assignments',
            builder: (context, state) => const AssignmentsScreen(),
          ),
          GoRoute(
            path: '/quick-search',
            builder: (context, state) => const QuickSearchScreen(),
          ),
        ],
      ),
    ],
  );
}
