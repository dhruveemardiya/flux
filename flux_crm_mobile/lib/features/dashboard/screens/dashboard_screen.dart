import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../core/auth/auth_controller.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/kpi_card.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../../../core/widgets/status_badge.dart';
import '../../../models/dashboard_stats_model.dart';
import '../../../services/crm_service.dart';

/// CRM executive and staff dashboard with KPIs, segment counters, and activity feed.
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({Key? key}) : super(key: key);

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  DashboardStats? _stats;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadDashboardData();
  }

  Future<void> _loadDashboardData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final crmService = context.read<CrmService>();
      final stats = await crmService.getDashboardStats();
      if (mounted) {
        setState(() {
          _stats = stats;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthController>().currentUser;

    return Scaffold(
      appBar: AppBar(
        title: const Text('CRM Dashboard'),
        actions: [
          IconButton(
            tooltip: 'Quick Search',
            icon: const Icon(Icons.search),
            onPressed: () => context.push('/quick-search'),
          ),
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh),
            onPressed: _loadDashboardData,
          ),
        ],
      ),
      body: _isLoading
          ? const LoadingIndicator(message: 'Loading CRM analytics...')
          : RefreshIndicator(
              onRefresh: _loadDashboardData,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Welcome Banner
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [AppColors.secondary, Color(0xFF1E293B)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Welcome back, ${user?.displayName ?? "User"}',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 17,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Role: ${(user?.role ?? "Staff").toUpperCase()} | Live MariaDB Data',
                                  style: TextStyle(
                                    color: Colors.white.withOpacity(0.8),
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              color: AppColors.primary,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Icon(Icons.trending_up, color: Colors.white, size: 22),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 18),

                    // Quick Actions Row
                    const Text(
                      'QUICK ACTIONS',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textSecondary,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        _QuickActionButton(
                          icon: Icons.person_add_alt_1,
                          label: 'New Lead',
                          color: AppColors.primary,
                          onTap: () => context.push('/leads/create'),
                        ),
                        const SizedBox(width: 10),
                        _QuickActionButton(
                          icon: Icons.add_task,
                          label: 'New Task',
                          color: AppColors.accent,
                          onTap: () => context.push('/tasks/create'),
                        ),
                        const SizedBox(width: 10),
                        _QuickActionButton(
                          icon: Icons.work,
                          label: 'My Work',
                          color: AppColors.success,
                          onTap: () => context.go('/my-work'),
                        ),
                        const SizedBox(width: 10),
                        _QuickActionButton(
                          icon: Icons.upload_file,
                          label: 'Import',
                          color: AppColors.warning,
                          onTap: () => context.push('/leads/import'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 22),

                    // KPI Metrics Grid
                    const Text(
                      'METRICS OVERVIEW',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textSecondary,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 10),
                    GridView.count(
                      crossAxisCount: 2,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                      childAspectRatio: 1.35,
                      children: [
                        KpiCard(
                          title: 'Total Leads',
                          value: '${_stats?.totalLeads ?? 0}',
                          icon: Icons.people_outline,
                          color: AppColors.primary,
                          onTap: () => context.go('/leads'),
                        ),
                        KpiCard(
                          title: 'Active Tasks',
                          value: '${_stats?.activeTasks ?? 0}',
                          icon: Icons.assignment_outlined,
                          color: AppColors.accent,
                          onTap: () => context.go('/tasks'),
                        ),
                        KpiCard(
                          title: 'Pending Activities',
                          value: '${_stats?.pendingActivities ?? 0}',
                          icon: Icons.pending_actions_outlined,
                          color: AppColors.warning,
                          onTap: () => context.go('/my-work'),
                        ),
                        KpiCard(
                          title: 'Completed',
                          value: '${_stats?.completedActivities ?? 0}',
                          icon: Icons.check_circle_outline,
                          color: AppColors.success,
                          onTap: () => context.go('/my-work'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // Segment Breakdown
                    if (_stats != null && _stats!.segmentDistribution.isNotEmpty) ...[
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'SEGMENT DISTRIBUTION',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textSecondary,
                              letterSpacing: 0.5,
                            ),
                          ),
                          TextButton(
                            onPressed: () => context.push('/segments'),
                            child: const Text('View All', style: TextStyle(fontSize: 12)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.divider),
                        ),
                        child: Column(
                          children: _stats!.segmentDistribution.entries.map((entry) {
                            return Padding(
                              padding: const EdgeInsets.symmetric(vertical: 6.0),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Row(
                                    children: [
                                      Container(
                                        width: 8,
                                        height: 8,
                                        decoration: const BoxDecoration(
                                          color: AppColors.primary,
                                          shape: BoxShape.circle,
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Text(
                                        entry.key,
                                        style: const TextStyle(
                                          fontSize: 13.5,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                    ],
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: AppColors.background,
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Text(
                                      '${entry.value} leads',
                                      style: const TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.primary,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }).toList(),
                        ),
                      ),
                      const SizedBox(height: 24),
                    ],

                    // Recent Activity Feed
                    if (_stats != null && _stats!.recentActivities.isNotEmpty) ...[
                      const Text(
                        'RECENT WORK ACTIVITIES',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textSecondary,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 10),
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: _stats!.recentActivities.take(5).length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (context, index) {
                          final activity = _stats!.recentActivities[index];
                          return Card(
                            margin: EdgeInsets.zero,
                            child: ListTile(
                              leading: CircleAvatar(
                                backgroundColor: AppColors.statusBgColor(activity.status),
                                child: Icon(
                                  Icons.business,
                                  size: 18,
                                  color: AppColors.statusColor(activity.status),
                                ),
                              ),
                              title: Text(
                                activity.leadCompany,
                                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                              ),
                              subtitle: Text(
                                '${activity.taskTitle} • ${activity.assignedToName}',
                                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                              ),
                              trailing: StatusBadge(status: activity.status),
                              onTap: () => context.go('/my-work'),
                            ),
                          );
                        },
                      ),
                      const SizedBox(height: 20),
                    ],
                  ],
                ),
              ),
            ),
    );
  }
}

class _QuickActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _QuickActionButton({
    Key? key,
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.divider),
          ),
          child: Column(
            children: [
              Icon(icon, size: 22, color: color),
              const SizedBox(height: 6),
              Text(
                label,
                style: const TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
