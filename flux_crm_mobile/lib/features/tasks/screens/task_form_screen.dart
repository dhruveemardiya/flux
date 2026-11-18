import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/custom_button.dart';
import '../../../core/widgets/custom_text_field.dart';
import '../../../models/lead_model.dart';
import '../../../models/task_group_model.dart';
import '../../../models/user_model.dart';
import '../../../services/crm_service.dart';

/// Form screen supporting both Creation and EDIT of a Task Group.
class TaskFormScreen extends StatefulWidget {
  final TaskGroup? existingTaskGroup;

  const TaskFormScreen({Key? key, this.existingTaskGroup}) : super(key: key);

  @override
  State<TaskFormScreen> createState() => _TaskFormScreenState();
}

class _TaskFormScreenState extends State<TaskFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _titleController;
  late final TextEditingController _descController;
  late final TextEditingController _startDateController;
  late final TextEditingController _endDateController;

  String _priority = 'medium';
  String _status = 'active';

  List<CRMUser> _allStaff = [];
  List<CRMLead> _allLeads = [];
  final Set<int> _selectedStaffIds = {};
  final Set<int> _selectedLeadIds = {};

  bool _isLoading = true;
  bool _isSaving = false;

  bool get isEdit => widget.existingTaskGroup != null;

  @override
  void initState() {
    super.initState();
    final tg = widget.existingTaskGroup;
    _titleController = TextEditingController(text: tg?.title ?? '');
    _descController = TextEditingController(text: tg?.description ?? '');
    _startDateController = TextEditingController(
      text: tg?.startDate ?? DateFormat('yyyy-MM-dd').format(DateTime.now()),
    );
    _endDateController = TextEditingController(
      text: tg?.endDate ?? DateFormat('yyyy-MM-dd').format(DateTime.now().add(const Duration(days: 7))),
    );

    if (tg != null) {
      _priority = tg.priority;
      _status = tg.status;
      _selectedStaffIds.addAll(tg.assignedStaffIds);
      _selectedLeadIds.addAll(tg.leadIds);
    }

    _loadStaffAndLeads();
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descController.dispose();
    _startDateController.dispose();
    _endDateController.dispose();
    super.dispose();
  }

  Future<void> _loadStaffAndLeads() async {
    final crmService = context.read<CrmService>();
    try {
      final results = await Future.wait([
        crmService.getStaffUsers().catchError((_) => <CRMUser>[]),
        crmService.getLeads().catchError((_) => <CRMLead>[]),
      ]);

      if (mounted) {
        setState(() {
          _allStaff = results[0] as List<CRMUser>;
          _allLeads = results[1] as List<CRMLead>;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _pickDate(TextEditingController controller) async {
    DateTime initial = DateTime.now();
    try {
      initial = DateFormat('yyyy-MM-dd').parse(controller.text);
    } catch (_) {}

    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
    );

    if (picked != null) {
      controller.text = DateFormat('yyyy-MM-dd').format(picked);
    }
  }

  void _showStaffSelectionDialog() {
    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('Assign Staff Members', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          content: SizedBox(
            width: double.maxFinite,
            height: 300,
            child: ListView.builder(
              itemCount: _allStaff.length,
              itemBuilder: (context, i) {
                final staff = _allStaff[i];
                final isSelected = _selectedStaffIds.contains(staff.id);
                return CheckboxListTile(
                  value: isSelected,
                  title: Text(staff.displayName, style: const TextStyle(fontSize: 14)),
                  subtitle: Text(staff.role.toUpperCase(), style: const TextStyle(fontSize: 11)),
                  onChanged: (val) {
                    setDialogState(() {
                      if (val == true) {
                        _selectedStaffIds.add(staff.id);
                      } else {
                        _selectedStaffIds.remove(staff.id);
                      }
                    });
                    setState(() {});
                  },
                );
              },
            ),
          ),
          actions: [
            ElevatedButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Done'),
            ),
          ],
        ),
      ),
    );
  }

  void _showLeadsSelectionDialog() {
    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('Link Leads', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          content: SizedBox(
            width: double.maxFinite,
            height: 320,
            child: ListView.builder(
              itemCount: _allLeads.length,
              itemBuilder: (context, i) {
                final lead = _allLeads[i];
                final isSelected = _selectedLeadIds.contains(lead.id);
                return CheckboxListTile(
                  value: isSelected,
                  title: Text(lead.companyName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                  subtitle: Text('${lead.contactPerson} • ${lead.status}', style: const TextStyle(fontSize: 11)),
                  onChanged: (val) {
                    setDialogState(() {
                      if (val == true) {
                        _selectedLeadIds.add(lead.id);
                      } else {
                        _selectedLeadIds.remove(lead.id);
                      }
                    });
                    setState(() {});
                  },
                );
              },
            ),
          ),
          actions: [
            ElevatedButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Done'),
            ),
          ],
        ),
      ),
    );
  }

  void _handleSave() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSaving = true);
    final crmService = context.read<CrmService>();

    final payload = {
      'title': _titleController.text.trim(),
      'description': _descController.text.trim(),
      'start_date': _startDateController.text.trim(),
      'end_date': _endDateController.text.trim(),
      'priority': _priority,
      'status': _status,
      'assigned_staff_ids': _selectedStaffIds.toList(),
      'lead_ids': _selectedLeadIds.toList(),
    };

    try {
      if (isEdit) {
        await crmService.updateTaskGroup(widget.existingTaskGroup!.id, payload);
      } else {
        await crmService.createTaskGroup(payload);
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(isEdit ? 'Task group updated successfully' : 'Task group created successfully')),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSaving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error saving task group: $e'), backgroundColor: AppColors.danger),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(isEdit ? 'Edit Task Group' : 'Create Task Group'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 16.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              CustomTextField(
                controller: _titleController,
                label: 'Task Group Title *',
                hint: 'e.g. Q4 Enterprise Outbound Campaign',
                validator: (val) {
                  if (val == null || val.trim().isEmpty) {
                    return 'Title is required';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              CustomTextField(
                controller: _descController,
                label: 'Description',
                hint: 'Goals, scripts, and context for assigned staff...',
                maxLines: 3,
              ),
              const SizedBox(height: 16),

              // Date pickers
              Row(
                children: [
                  Expanded(
                    child: CustomTextField(
                      controller: _startDateController,
                      label: 'Start Date *',
                      readOnly: true,
                      prefixIcon: Icons.calendar_today,
                      onTap: () => _pickDate(_startDateController),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: CustomTextField(
                      controller: _endDateController,
                      label: 'End Date *',
                      readOnly: true,
                      prefixIcon: Icons.event,
                      onTap: () => _pickDate(_endDateController),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Priority and Status
              Row(
                children: [
                  // Priority
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Priority *', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          decoration: BoxDecoration(
                            color: AppColors.surface,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: AppColors.divider),
                          ),
                          child: DropdownButtonHideUnderline(
                            child: DropdownButton<String>(
                              value: _priority,
                              isExpanded: true,
                              items: const [
                                DropdownMenuItem(value: 'low', child: Text('Low')),
                                DropdownMenuItem(value: 'medium', child: Text('Medium')),
                                DropdownMenuItem(value: 'high', child: Text('High')),
                                DropdownMenuItem(value: 'urgent', child: Text('Urgent')),
                              ],
                              onChanged: (val) {
                                if (val != null) setState(() => _priority = val);
                              },
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),

                  // Status
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Status *', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          decoration: BoxDecoration(
                            color: AppColors.surface,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: AppColors.divider),
                          ),
                          child: DropdownButtonHideUnderline(
                            child: DropdownButton<String>(
                              value: _status,
                              isExpanded: true,
                              items: const [
                                DropdownMenuItem(value: 'pending', child: Text('Pending')),
                                DropdownMenuItem(value: 'active', child: Text('Active')),
                                DropdownMenuItem(value: 'completed', child: Text('Completed')),
                                DropdownMenuItem(value: 'cancelled', child: Text('Cancelled')),
                              ],
                              onChanged: (val) {
                                if (val != null) setState(() => _status = val);
                              },
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Staff Selection Button & Summary
              OutlinedButton.icon(
                icon: const Icon(Icons.people_outline),
                label: Text('Assigned Staff (${_selectedStaffIds.length} Selected)'),
                onPressed: _showStaffSelectionDialog,
              ),
              const SizedBox(height: 12),

              // Leads Selection Button & Summary
              OutlinedButton.icon(
                icon: const Icon(Icons.business_outlined),
                label: Text('Linked Leads (${_selectedLeadIds.length} Selected)'),
                onPressed: _showLeadsSelectionDialog,
              ),
              const SizedBox(height: 28),

              CustomButton(
                text: isEdit ? 'Update Task Group' : 'Create Task Group',
                isLoading: _isSaving,
                onPressed: _handleSave,
                height: 50,
              ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }
}
