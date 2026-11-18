import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/confirm_dialog.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../../../core/widgets/priority_badge.dart';
import '../../../core/widgets/status_badge.dart';
import '../../../models/task_group_model.dart';
import '../../../services/crm_service.dart';

/// Detailed view of a Task Group with EDIT and DELETE functionality.
class TaskDetailScreen extends StatefulWidget {
  final int taskGroupId;

  const TaskDetailScreen({Key? key, required this.taskGroupId}) : super(key: key);

  @override
  State<TaskDetailScreen> createState() => _TaskDetailScreenState();
}

class _TaskDetailScreenState extends State<TaskDetailScreen> {
  TaskGroup? _taskGroup;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadTaskGroup();
  }

  Future<void> _loadTaskGroup() async {
    setState(() => _isLoading = true);
    try {
      final crmService = context.read<CrmService>();
      final group = await crmService.getTaskGroupDetail(widget.taskGroupId);
      if (mounted) {
        setState(() {
          _taskGroup = group;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load task group: $e'), backgroundColor: AppColors.danger),
        );
      }
    }
  }

  void _handleDelete() async {
    final confirmed = await showConfirmDialog(
      context: context,
      title: 'Delete Task Group',
      message: 'Are you sure you want to delete "${_taskGroup?.title}"? Staff activity history will be preserved.',
      confirmLabel: 'Delete',
      isDestructive: true,
    );

    if (confirmed == true && mounted) {
      try {
        await context.read<CrmService>().deleteTaskGroup(widget.taskGroupId);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Task group deleted successfully')),
          );
          Navigator.pop(context, true);
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error deleting task group: $e'), backgroundColor: AppColors.danger),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: LoadingIndicator(message: 'Loading task group details...'),
      );
    }

    if (_taskGroup == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Task Group Not Found')),
        body: const Center(child: Text('The requested task group could not be found.')),
      );
    }

    final tg = _taskGroup!;

    return Scaffold(
      appBar: AppBar(
        title: Text(tg.title),
        actions: [
          IconButton(
            tooltip: 'Edit Task Group',
            icon: const Icon(Icons.edit_outlined),
            onPressed: () async {
              final updated = await context.push<bool>('/tasks/${tg.id}/edit', extra: tg);
              if (updated == true) _loadTaskGroup();
            },
          ),
          IconButton(
            tooltip: 'Delete Task Group',
            icon: const Icon(Icons.delete_outline, color: AppColors.danger),
            onPressed: _handleDelete,
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 14.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header Card
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.divider),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      PriorityBadge(priority: tg.priority),
                      StatusBadge(status: tg.status),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    tg.title,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  if (tg.description.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      tg.description,
                      style: const TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.4),
                    ),
                  ],
                  const SizedBox(height: 16),

                  // Progress Bar
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Completion: ${tg.completedActivities} of ${tg.totalActivities} activities',
                        style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                      ),
                      Text(
                        '${tg.progressPercent}%',
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.primary),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: tg.progress,
                      minHeight: 8,
                      backgroundColor: AppColors.divider,
                      valueColor: AlwaysStoppedAnimation<Color>(
                        tg.progress >= 1.0 ? AppColors.success : AppColors.primary,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Timeline Dates
            _sectionHeader('TIMELINE SCHEDULE'),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.divider),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Start Date', style: TextStyle(fontSize: 12, color: AppColors.textMuted)),
                        const SizedBox(height: 4),
                        Text(
                          tg.startDate.isNotEmpty ? tg.startDate : 'Not set',
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.arrow_forward, size: 16, color: AppColors.textMuted),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        const Text('End Date', style: TextStyle(fontSize: 12, color: AppColors.textMuted)),
                        const SizedBox(height: 4),
                        Text(
                          tg.endDate.isNotEmpty ? tg.endDate : 'Not set',
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Assigned Staff Members
            _sectionHeader('ASSIGNED STAFF (${tg.assignedStaff.isNotEmpty ? tg.assignedStaff.length : tg.assignedStaffIds.length})'),
            if (tg.assignedStaff.isNotEmpty)
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.divider),
                ),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: tg.assignedStaff.map((staff) {
                    return Chip(
                      avatar: CircleAvatar(
                        backgroundColor: AppColors.primary,
                        child: Text(
                          staff.displayName.isNotEmpty ? staff.displayName[0].toUpperCase() : 'S',
                          style: const TextStyle(fontSize: 10, color: Colors.white),
                        ),
                      ),
                      label: Text(staff.displayName, style: const TextStyle(fontSize: 12.5)),
                      backgroundColor: AppColors.background,
                    );
                  }).toList(),
                ),
              )
            else
              Text(
                'Staff IDs assigned: ${tg.assignedStaffIds.join(", ")}',
                style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
              ),
            const SizedBox(height: 20),

            // Associated Leads
            _sectionHeader('LINKED LEADS (${tg.leads.isNotEmpty ? tg.leads.length : tg.leadIds.length})'),
            if (tg.leads.isNotEmpty)
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: tg.leads.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final lead = tg.leads[index];
                  return Card(
                    margin: EdgeInsets.zero,
                    child: ListTile(
                      dense: true,
                      leading: const Icon(Icons.business, color: AppColors.primary, size: 20),
                      title: Text(lead.companyName, style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text(lead.contactPerson.isNotEmpty ? lead.contactPerson : 'No contact specified'),
                      trailing: StatusBadge(status: lead.status),
                      onTap: () => context.push('/leads/${lead.id}'),
                    ),
                  );
                },
              )
            else
              Text(
                'Lead IDs linked: ${tg.leadIds.join(", ")}',
                style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
              ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _sectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: AppColors.textSecondary,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}
