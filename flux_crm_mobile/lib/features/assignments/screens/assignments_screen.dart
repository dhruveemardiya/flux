import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/custom_button.dart';
import '../../../core/widgets/empty_state_view.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../../../models/lead_model.dart';
import '../../../models/user_model.dart';
import '../../../services/crm_service.dart';

/// Screen allowing bulk assignment of unassigned leads to staff members.
class AssignmentsScreen extends StatefulWidget {
  const AssignmentsScreen({Key? key}) : super(key: key);

  @override
  State<AssignmentsScreen> createState() => _AssignmentsScreenState();
}

class _AssignmentsScreenState extends State<AssignmentsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<CRMLead> _unassignedLeads = [];
  List<CRMUser> _staffList = [];
  List<dynamic> _history = [];

  final Set<int> _selectedLeadIds = {};
  int? _selectedStaffId;
  final TextEditingController _notesController = TextEditingController();

  bool _isLoading = true;
  bool _isAssigning = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final crmService = context.read<CrmService>();

    try {
      final results = await Future.wait([
        crmService.getUnassignedLeads().catchError((_) => <CRMLead>[]),
        crmService.getStaffUsers().catchError((_) => <CRMUser>[]),
        crmService.getAssignmentHistory().catchError((_) => <dynamic>[]),
      ]);

      if (mounted) {
        setState(() {
          _unassignedLeads = results[0] as List<CRMLead>;
          _staffList = results[1] as List<CRMUser>;
          _history = results[2] as List<dynamic>;
          _selectedLeadIds.clear();
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error loading assignments: $e'), backgroundColor: AppColors.danger),
        );
      }
    }
  }

  void _handleAssign() async {
    if (_selectedLeadIds.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select at least one lead to assign')),
      );
      return;
    }
    if (_selectedStaffId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a staff member')),
      );
      return;
    }

    setState(() => _isAssigning = true);
    final crmService = context.read<CrmService>();

    try {
      await crmService.assignLeads(
        leadIds: _selectedLeadIds.toList(),
        staffId: _selectedStaffId!,
        notes: _notesController.text.trim().isNotEmpty ? _notesController.text.trim() : null,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Successfully assigned ${_selectedLeadIds.length} leads')),
        );
        _notesController.clear();
        _loadData();
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isAssigning = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error assigning leads: $e'), backgroundColor: AppColors.danger),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Lead Assignment'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh),
            onPressed: _loadData,
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textSecondary,
          indicatorColor: AppColors.primary,
          tabs: const [
            Tab(text: 'UNASSIGNED LEADS'),
            Tab(text: 'ASSIGNMENT LOGS'),
          ],
        ),
      ),
      body: _isLoading
          ? const LoadingIndicator(message: 'Loading assignment data...')
          : TabBarView(
              controller: _tabController,
              children: [
                // Tab 1: Assign Leads
                _buildAssignTab(),

                // Tab 2: Assignment History
                _buildHistoryTab(),
              ],
            ),
    );
  }

  Widget _buildAssignTab() {
    if (_unassignedLeads.isEmpty) {
      return const EmptyStateView(
        icon: Icons.done_all,
        title: 'All Leads Assigned',
        description: 'There are currently no unassigned leads in the pipeline.',
      );
    }

    return Column(
      children: [
        // Assignment Action Bar
        Container(
          padding: const EdgeInsets.all(14),
          color: AppColors.surface,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      decoration: BoxDecoration(
                        color: AppColors.background,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.divider),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<int?>(
                          value: _selectedStaffId,
                          isExpanded: true,
                          hint: const Text('Select Staff Member *', style: TextStyle(fontSize: 13)),
                          items: _staffList.map((s) {
                            return DropdownMenuItem(
                              value: s.id,
                              child: Text(s.displayName, style: const TextStyle(fontSize: 13)),
                            );
                          }).toList(),
                          onChanged: (val) => setState(() => _selectedStaffId = val),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  TextButton(
                    onPressed: () {
                      setState(() {
                        if (_selectedLeadIds.length == _unassignedLeads.length) {
                          _selectedLeadIds.clear();
                        } else {
                          _selectedLeadIds.addAll(_unassignedLeads.map((l) => l.id));
                        }
                      });
                    },
                    child: Text(
                      _selectedLeadIds.length == _unassignedLeads.length ? 'Deselect All' : 'Select All',
                      style: const TextStyle(fontSize: 12),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              CustomButton(
                text: 'Assign ${_selectedLeadIds.length} Selected Leads',
                isLoading: _isAssigning,
                onPressed: _handleAssign,
                height: 42,
              ),
            ],
          ),
        ),
        const Divider(height: 1),

        // Leads Checklist
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            itemCount: _unassignedLeads.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final lead = _unassignedLeads[index];
              final isSelected = _selectedLeadIds.contains(lead.id);

              return Card(
                child: CheckboxListTile(
                  value: isSelected,
                  title: Text(
                    lead.companyName,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14.5),
                  ),
                  subtitle: Text(
                    '${lead.contactPerson.isNotEmpty ? lead.contactPerson : "No contact"} • ${lead.segmentName ?? "No segment"}',
                    style: const TextStyle(fontSize: 12),
                  ),
                  secondary: CircleAvatar(
                    backgroundColor: AppColors.primary.withOpacity(0.1),
                    child: const Icon(Icons.business, color: AppColors.primary, size: 18),
                  ),
                  onChanged: (val) {
                    setState(() {
                      if (val == true) {
                        _selectedLeadIds.add(lead.id);
                      } else {
                        _selectedLeadIds.remove(lead.id);
                      }
                    });
                  },
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildHistoryTab() {
    if (_history.isEmpty) {
      return const EmptyStateView(
        icon: Icons.history,
        title: 'No Assignment History',
        description: 'Past lead assignments will appear here.',
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _history.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final item = _history[index];
        final leadName = item is Map ? (item['lead_company'] ?? item['company_name'] ?? 'Lead') : 'Lead';
        final staffName = item is Map ? (item['staff_name'] ?? item['username'] ?? 'Staff') : 'Staff';
        final date = item is Map ? (item['created_at'] ?? item['assigned_at'] ?? '') : '';

        return Card(
          child: ListTile(
            leading: const CircleAvatar(
              backgroundColor: AppColors.infoBg,
              child: Icon(Icons.assignment_ind, color: AppColors.info, size: 18),
            ),
            title: Text(leadName.toString(), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
            subtitle: Text('Assigned to $staffName', style: const TextStyle(fontSize: 12)),
            trailing: Text(
              date.toString().split('T').first,
              style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
            ),
          ),
        );
      },
    );
  }
}
