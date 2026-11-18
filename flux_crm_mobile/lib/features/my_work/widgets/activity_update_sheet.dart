import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/custom_button.dart';
import '../../../core/widgets/custom_text_field.dart';
import '../../../models/work_activity_model.dart';
import '../../../services/crm_service.dart';

/// Modal bottom sheet allowing staff to update activity status, notes, and next follow-up.
class ActivityUpdateSheet extends StatefulWidget {
  final LeadTaskActivity activity;

  const ActivityUpdateSheet({Key? key, required this.activity}) : super(key: key);

  @override
  State<ActivityUpdateSheet> createState() => _ActivityUpdateSheetState();
}

class _ActivityUpdateSheetState extends State<ActivityUpdateSheet> {
  late String _status;
  late final TextEditingController _notesController;
  late final TextEditingController _followupDateController;
  bool _isSaving = false;

  final List<String> _statuses = [
    'pending',
    'contacted',
    'in_progress',
    'qualified',
    'completed',
    'cancelled',
  ];

  @override
  void initState() {
    super.initState();
    _status = widget.activity.status;
    _notesController = TextEditingController(text: widget.activity.notes);
    _followupDateController = TextEditingController(
      text: widget.activity.scheduledFollowupAt ?? '',
    );
  }

  @override
  void dispose() {
    _notesController.dispose();
    _followupDateController.dispose();
    super.dispose();
  }

  Future<void> _pickFollowupDate() async {
    final now = DateTime.now();
    final pickedDate = await showDatePicker(
      context: context,
      initialDate: now.add(const Duration(days: 1)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 90)),
    );

    if (pickedDate != null && mounted) {
      final pickedTime = await showTimePicker(
        context: context,
        initialTime: const TimeOfDay(hour: 10, minute: 0),
      );

      final dt = DateTime(
        pickedDate.year,
        pickedDate.month,
        pickedDate.day,
        pickedTime?.hour ?? 10,
        pickedTime?.minute ?? 0,
      );

      _followupDateController.text = DateFormat('yyyy-MM-dd HH:mm').format(dt);
    }
  }

  void _handleSave() async {
    setState(() => _isSaving = true);
    final crmService = context.read<CrmService>();

    try {
      await crmService.updateActivity(
        widget.activity.id,
        status: _status,
        notes: _notesController.text.trim(),
        scheduledFollowupAt: _followupDateController.text.trim().isNotEmpty
            ? _followupDateController.text.trim()
            : null,
      );

      if (mounted) {
        Navigator.pop(context, true);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Activity updated successfully')),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSaving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error updating activity: $e'), backgroundColor: AppColors.danger),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Update Activity',
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
              ),
              IconButton(
                icon: const Icon(Icons.close),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${widget.activity.leadCompany} • ${widget.activity.taskTitle}',
            style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 18),

          // Status Selector Chips
          const Text('Status *', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: _statuses.map((st) {
              final isSelected = _status == st;
              return ChoiceChip(
                label: Text(st.replaceAll('_', ' ').toUpperCase()),
                labelStyle: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: isSelected ? Colors.white : AppColors.textSecondary,
                ),
                selected: isSelected,
                selectedColor: AppColors.statusColor(st),
                onSelected: (val) {
                  if (val) setState(() => _status = st);
                },
              );
            }).toList(),
          ),
          const SizedBox(height: 16),

          // Notes
          CustomTextField(
            controller: _notesController,
            label: 'Interaction Disposition / Notes',
            hint: 'Summary of call/discussion, lead objections, next action...',
            maxLines: 3,
          ),
          const SizedBox(height: 14),

          // Next Follow-up
          CustomTextField(
            controller: _followupDateController,
            label: 'Next Follow-up Schedule (Optional)',
            hint: 'Tap to select follow-up date and time',
            readOnly: true,
            prefixIcon: Icons.alarm,
            onTap: _pickFollowupDate,
            suffixIcon: _followupDateController.text.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.clear, size: 18),
                    onPressed: () => setState(() => _followupDateController.clear()),
                  )
                : null,
          ),
          const SizedBox(height: 24),

          CustomButton(
            text: 'Save Update',
            isLoading: _isSaving,
            onPressed: _handleSave,
            height: 48,
          ),
        ],
      ),
    );
  }
}
