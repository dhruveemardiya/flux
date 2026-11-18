import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/empty_state_view.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../../../core/widgets/priority_badge.dart';
import '../../../core/widgets/status_badge.dart';
import '../../../models/task_group_model.dart';
import '../../../services/crm_service.dart';

/// Task group listing screen with status tabs, progress tracking, and group creation.
class TasksScreen extends StatefulWidget {
  const TasksScreen({Key? key}) : super(key: key);

  @override
  State<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends State<TasksScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<TaskGroup> _taskGroups = [];
  bool _isLoading = true;

  final List<String> _tabs = ['all', 'active', 'completed', 'pending'];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabs.length, vsync: this);
    _tabController.addListener(() {
      if (_tabController.indexIsChanging) {
        _loadTaskGroups();
      }
    });
    _loadTaskGroups();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadTaskGroups() async {
    setState(() => _isLoading = true);
    final status = _tabs[_tabController.index];
    try {
      final groups = await context.read<CrmService>().getTaskGroups(
            status: status == 'all' ? null : status,
          );
      if (mounted) {
        setState(() {
          _taskGroups = groups;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error loading task groups: $e'), backgroundColor: AppColors.danger),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Task Groups'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh),
            onPressed: _loadTaskGroups,
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textSecondary,
          indicatorColor: AppColors.primary,
          indicatorWeight: 3,
          tabs: const [
            Tab(text: 'ALL'),
            Tab(text: 'ACTIVE'),
            Tab(text: 'COMPLETED'),
            Tab(text: 'PENDING'),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: AppColors.primary,
        onPressed: () async {
          final created = await context.push<bool>('/tasks/create');
          if (created == true) _loadTaskGroups();
        },
        child: const Icon(Icons.add, color: Colors.white),
      ),
      body: _isLoading
          ? const LoadingIndicator(message: 'Loading task groups...')
          : _taskGroups.isEmpty
              ? EmptyStateView(
                  icon: Icons.assignment_outlined,
                  title: 'No Task Groups Found',
                  description: 'No task groups match the selected tab filter.',
                  actionLabel: 'Create Task Group',
                  onAction: () async {
                    final created = await context.push<bool>('/tasks/create');
                    if (created == true) _loadTaskGroups();
                  },
                )
              : RefreshIndicator(
                  onRefresh: _loadTaskGroups,
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    itemCount: _taskGroups.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final tg = _taskGroups[index];
                      return _TaskGroupCard(
                        taskGroup: tg,
                        onTap: () async {
                          final modified = await context.push<bool>('/tasks/${tg.id}');
                          if (modified == true) _loadTaskGroups();
                        },
                      );
                    },
                  ),
                ),
    );
  }
}

class _TaskGroupCard extends StatelessWidget {
  final TaskGroup taskGroup;
  final VoidCallback onTap;

  const _TaskGroupCard({Key? key, required this.taskGroup, required this.onTap}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header: Title & Badges
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      taskGroup.title,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  PriorityBadge(priority: taskGroup.priority),
                ],
              ),
              if (taskGroup.description.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  taskGroup.description,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                ),
              ],
              const SizedBox(height: 14),

              // Progress Bar
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Progress: ${taskGroup.completedActivities}/${taskGroup.totalActivities} Completed',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                  ),
                  Text(
                    '${taskGroup.progressPercent}%',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.primary),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: taskGroup.progress,
                  minHeight: 6,
                  backgroundColor: AppColors.divider,
                  valueColor: AlwaysStoppedAnimation<Color>(
                    taskGroup.progress >= 1.0 ? AppColors.success : AppColors.primary,
                  ),
                ),
              ),
              const SizedBox(height: 14),

              // Footer: Date Range & Counts
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.calendar_today_outlined, size: 14, color: AppColors.textMuted),
                      const SizedBox(width: 5),
                      Text(
                        '${taskGroup.startDate} -> ${taskGroup.endDate}',
                        style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                  StatusBadge(status: taskGroup.status),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
