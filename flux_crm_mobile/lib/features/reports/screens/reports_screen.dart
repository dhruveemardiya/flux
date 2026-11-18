import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/kpi_card.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../../../models/report_model.dart';
import '../../../services/crm_service.dart';

/// CRM performance and staff productivity analytics report screen.
class ReportsScreen extends StatefulWidget {
  const ReportsScreen({Key? key}) : super(key: key);

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  CRMPerformanceReport? _report;
  bool _isLoading = true;

  DateTime? _startDate;
  DateTime? _endDate;

  @override
  void initState() {
    super.initState();
    _loadReport();
  }

  Future<void> _loadReport() async {
    setState(() => _isLoading = true);
    final crmService = context.read<CrmService>();

    final startStr = _startDate != null ? DateFormat('yyyy-MM-dd').format(_startDate!) : null;
    final endStr = _endDate != null ? DateFormat('yyyy-MM-dd').format(_endDate!) : null;

    try {
      final rep = await crmService.getPerformanceReport(
        startDate: startStr,
        endDate: endStr,
      );
      if (mounted) {
        setState(() {
          _report = rep;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error loading report: $e'), backgroundColor: AppColors.danger),
        );
      }
    }
  }

  void _pickDateRange() async {
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2023),
      lastDate: DateTime(2030),
      initialDateRange: _startDate != null && _endDate != null
          ? DateTimeRange(start: _startDate!, end: _endDate!)
          : null,
    );

    if (picked != null) {
      setState(() {
        _startDate = picked.start;
        _endDate = picked.end;
      });
      _loadReport();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Performance Reports'),
        actions: [
          IconButton(
            tooltip: 'Filter Date Range',
            icon: const Icon(Icons.date_range_outlined),
            onPressed: _pickDateRange,
          ),
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh),
            onPressed: _loadReport,
          ),
        ],
      ),
      body: _isLoading
          ? const LoadingIndicator(message: 'Generating CRM performance report...')
          : RefreshIndicator(
              onRefresh: _loadReport,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 14.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Active Filter Indicator
                    if (_startDate != null && _endDate != null) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: AppColors.infoBg,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppColors.info.withOpacity(0.3)),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Date Filter: ${DateFormat("MMM d").format(_startDate!)} - ${DateFormat("MMM d, yyyy").format(_endDate!)}',
                              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.info),
                            ),
                            InkWell(
                              onTap: () {
                                setState(() {
                                  _startDate = null;
                                  _endDate = null;
                                });
                                _loadReport();
                              },
                              child: const Icon(Icons.close, size: 16, color: AppColors.info),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                    ],

                    // Top KPI Grid
                    GridView.count(
                      crossAxisCount: 2,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                      childAspectRatio: 1.35,
                      children: [
                        KpiCard(
                          title: 'Total Activities',
                          value: '${_report?.totalActivities ?? 0}',
                          icon: Icons.assignment_outlined,
                          color: AppColors.primary,
                        ),
                        KpiCard(
                          title: 'Completed',
                          value: '${_report?.completedActivities ?? 0}',
                          icon: Icons.check_circle_outline,
                          color: AppColors.success,
                        ),
                        KpiCard(
                          title: 'Pending',
                          value: '${_report?.pendingActivities ?? 0}',
                          icon: Icons.pending_actions_outlined,
                          color: AppColors.warning,
                        ),
                        KpiCard(
                          title: 'Completion Rate',
                          value: '${((_report?.overallCompletionRate ?? 0) * 100).round()}%',
                          icon: Icons.pie_chart_outline,
                          color: AppColors.accent,
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // Staff Performance Breakdown
                    const Text(
                      'STAFF PRODUCTIVITY LEADERBOARD',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textSecondary,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 10),

                    if (_report == null || _report!.staffMetrics.isEmpty)
                      Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.divider),
                        ),
                        child: const Center(
                          child: Text('No staff activity metrics recorded for this period.'),
                        ),
                      )
                    else
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: _report!.staffMetrics.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (context, index) {
                          final metric = _report!.staffMetrics[index];
                          return Card(
                            child: Padding(
                              padding: const EdgeInsets.all(14.0),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        metric.staffName,
                                        style: const TextStyle(
                                          fontSize: 15,
                                          fontWeight: FontWeight.w700,
                                          color: AppColors.textPrimary,
                                        ),
                                      ),
                                      Text(
                                        '${metric.completionPercent}%',
                                        style: const TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.bold,
                                          color: AppColors.primary,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 8),

                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(4),
                                    child: LinearProgressIndicator(
                                      value: metric.completionRate,
                                      minHeight: 6,
                                      backgroundColor: AppColors.divider,
                                      valueColor: AlwaysStoppedAnimation<Color>(
                                        metric.completionRate >= 1.0 ? AppColors.success : AppColors.primary,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 8),

                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        'Assigned: ${metric.totalAssigned}',
                                        style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                      ),
                                      Text(
                                        'Done: ${metric.completed}',
                                        style: const TextStyle(fontSize: 12, color: AppColors.success, fontWeight: FontWeight.w600),
                                      ),
                                      Text(
                                        'Pending: ${metric.pending}',
                                        style: const TextStyle(fontSize: 12, color: AppColors.warning, fontWeight: FontWeight.w600),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),
    );
  }
}
