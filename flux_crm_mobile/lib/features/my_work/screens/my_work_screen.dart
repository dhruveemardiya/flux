import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/empty_state_view.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../../../core/widgets/status_badge.dart';
import '../../../models/work_activity_model.dart';
import '../../../services/crm_service.dart';
import '../widgets/activity_update_sheet.dart';

/// Staff daily execution screen with date navigation and status update workflows.
class MyWorkScreen extends StatefulWidget {
  const MyWorkScreen({Key? key}) : super(key: key);

  @override
  State<MyWorkScreen> createState() => _MyWorkScreenState();
}

class _MyWorkScreenState extends State<MyWorkScreen> {
  DateTime _selectedDate = DateTime.now();
  List<LeadTaskActivity> _activities = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadActivities();
  }

  String get _formattedDate => DateFormat('yyyy-MM-dd').format(_selectedDate);

  Future<void> _loadActivities() async {
    setState(() => _isLoading = true);
    final crmService = context.read<CrmService>();

    try {
      final activities = await crmService.getMyWork(date: _formattedDate);
      if (mounted) {
        setState(() {
          _activities = activities;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error loading activities: $e'), backgroundColor: AppColors.danger),
        );
      }
    }
  }

  void _changeDate(DateTime newDate) {
    setState(() => _selectedDate = newDate);
    _loadActivities();
  }

  void _pickCustomDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2023),
      lastDate: DateTime(2030),
    );

    if (picked != null) {
      _changeDate(picked);
    }
  }

  void _openUpdateSheet(LeadTaskActivity activity) async {
    final updated = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => ActivityUpdateSheet(activity: activity),
    );

    if (updated == true) {
      _loadActivities();
    }
  }

  void _callPhone(String phone) async {
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  @override
  Widget build(BuildContext context) {
    final completedCount = _activities.where((a) => a.isCompleted).length;
    final pendingCount = _activities.length - completedCount;

    final isToday = DateFormat('yyyy-MM-dd').format(DateTime.now()) == _formattedDate;
    final isYesterday = DateFormat('yyyy-MM-dd').format(DateTime.now().subtract(const Duration(days: 1))) == _formattedDate;
    final isTomorrow = DateFormat('yyyy-MM-dd').format(DateTime.now().add(const Duration(days: 1))) == _formattedDate;

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Work Dashboard'),
        actions: [
          IconButton(
            tooltip: 'Pick Date',
            icon: const Icon(Icons.calendar_month_outlined),
            onPressed: _pickCustomDate,
          ),
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh),
            onPressed: _loadActivities,
          ),
        ],
      ),
      body: Column(
        children: [
          // Date Selector Header
          Container(
            color: AppColors.surface,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.chevron_left),
                      onPressed: () => _changeDate(_selectedDate.subtract(const Duration(days: 1))),
                    ),
                    Column(
                      children: [
                        Text(
                          isToday
                              ? 'Today'
                              : isYesterday
                                  ? 'Yesterday'
                                  : isTomorrow
                                      ? 'Tomorrow'
                                      : DateFormat('EEEE').format(_selectedDate),
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                        ),
                        Text(
                          DateFormat('MMMM d, yyyy').format(_selectedDate),
                          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                    IconButton(
                      icon: const Icon(Icons.chevron_right),
                      onPressed: () => _changeDate(_selectedDate.add(const Duration(days: 1))),
                    ),
                  ],
                ),
                const SizedBox(height: 10),

                // Quick Counters
                Row(
                  children: [
                    _counterBadge('Total Assigned', '${_activities.length}', AppColors.primary),
                    const SizedBox(width: 8),
                    _counterBadge('Pending', '$pendingCount', AppColors.warning),
                    const SizedBox(width: 8),
                    _counterBadge('Completed', '$completedCount', AppColors.success),
                  ],
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          // Activity List
          Expanded(
            child: _isLoading
                ? const LoadingIndicator(message: 'Loading your activities...')
                : _activities.isEmpty
                    ? EmptyStateView(
                        icon: Icons.check_circle_outline,
                        title: 'No Work Scheduled',
                        description: 'You have no assigned lead activities for this date.',
                        actionLabel: 'Check Today',
                        onAction: () => _changeDate(DateTime.now()),
                      )
                    : RefreshIndicator(
                        onRefresh: _loadActivities,
                        child: ListView.separated(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          itemCount: _activities.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 10),
                          itemBuilder: (context, index) {
                            final activity = _activities[index];
                            return _ActivityCard(
                              activity: activity,
                              onTap: () => _openUpdateSheet(activity),
                              onCall: activity.leadPhone.isNotEmpty ? () => _callPhone(activity.leadPhone) : null,
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _counterBadge(String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: color),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w600),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActivityCard extends StatelessWidget {
  final LeadTaskActivity activity;
  final VoidCallback onTap;
  final VoidCallback? onCall;

  const _ActivityCard({
    Key? key,
    required this.activity,
    required this.onTap,
    this.onCall,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      activity.leadCompany,
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                    ),
                  ),
                  StatusBadge(status: activity.status),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                'Task Group: ${activity.taskTitle}',
                style: const TextStyle(fontSize: 12.5, color: AppColors.primary, fontWeight: FontWeight.w500),
              ),
              const SizedBox(height: 8),

              if (activity.leadContact.isNotEmpty || activity.leadPhone.isNotEmpty) ...[
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '${activity.leadContact} ${activity.leadPhone.isNotEmpty ? "• ${activity.leadPhone}" : ""}',
                      style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
                    ),
                    if (onCall != null)
                      IconButton(
                        icon: const Icon(Icons.phone, size: 18, color: AppColors.success),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                        onPressed: onCall,
                      ),
                  ],
                ),
                const SizedBox(height: 6),
              ],

              if (activity.notes.isNotEmpty) ...[
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.background,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    activity.notes,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                  ),
                ),
                const SizedBox(height: 8),
              ],

              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: const [
                  Text(
                    'Tap to update status',
                    style: TextStyle(fontSize: 11, color: AppColors.primary, fontWeight: FontWeight.w600),
                  ),
                  Icon(Icons.chevron_right, size: 16, color: AppColors.primary),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
