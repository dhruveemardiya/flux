import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/custom_button.dart';
import '../../../core/widgets/custom_text_field.dart';
import '../../../core/widgets/empty_state_view.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../../../models/communication_log_model.dart';
import '../../../models/lead_model.dart';
import '../../../services/crm_service.dart';

/// 360° Lead Communication Timeline displaying calls, emails, meetings, and notes.
class CommunicationTimelineScreen extends StatefulWidget {
  final int leadId;
  final CRMLead? lead;

  const CommunicationTimelineScreen({
    Key? key,
    required this.leadId,
    this.lead,
  }) : super(key: key);

  @override
  State<CommunicationTimelineScreen> createState() => _CommunicationTimelineScreenState();
}

class _CommunicationTimelineScreenState extends State<CommunicationTimelineScreen> {
  List<CRMCommunicationLog> _logs = [];
  bool _isLoading = true;
  String _selectedChannel = 'all';

  @override
  void initState() {
    super.initState();
    _loadTimeline();
  }

  Future<void> _loadTimeline() async {
    setState(() => _isLoading = true);
    final crmService = context.read<CrmService>();

    try {
      final logs = await crmService.getLeadTimeline(widget.leadId);
      if (mounted) {
        setState(() {
          _logs = logs;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error loading timeline: $e'), backgroundColor: AppColors.danger),
        );
      }
    }
  }

  void _showLogInteractionDialog() {
    String channel = 'call';
    final summaryController = TextEditingController();
    final notesController = TextEditingController();
    bool isSaving = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) => Padding(
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
                  const Text(
                    'Log Interaction',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Channel selector
              const Text('Channel *', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: AppConstants.communicationChannels.map((ch) {
                  final isSelected = channel == ch;
                  return ChoiceChip(
                    label: Text(ch.toUpperCase()),
                    labelStyle: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: isSelected ? Colors.white : AppColors.textSecondary,
                    ),
                    selected: isSelected,
                    selectedColor: AppColors.primary,
                    onSelected: (val) {
                      if (val) setModalState(() => channel = ch);
                    },
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),

              CustomTextField(
                controller: summaryController,
                label: 'Subject / Summary *',
                hint: 'e.g. Discussed pricing and timeline',
              ),
              const SizedBox(height: 14),

              CustomTextField(
                controller: notesController,
                label: 'Interaction Details / Notes',
                hint: 'Specific feedback, customer concerns, or next steps...',
                maxLines: 3,
              ),
              const SizedBox(height: 24),

              CustomButton(
                text: 'Save Interaction',
                isLoading: isSaving,
                onPressed: () async {
                  final summary = summaryController.text.trim();
                  if (summary.isEmpty) return;

                  setModalState(() => isSaving = true);
                  final crmService = context.read<CrmService>();

                  try {
                    await crmService.logCommunication(
                      leadId: widget.leadId,
                      channel: channel,
                      summary: summary,
                      notes: notesController.text.trim().isNotEmpty ? notesController.text.trim() : null,
                    );
                    Navigator.pop(ctx);
                    _loadTimeline();
                  } catch (e) {
                    setModalState(() => isSaving = false);
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Failed to save log: $e'), backgroundColor: AppColors.danger),
                    );
                  }
                },
                height: 48,
              ),
            ],
          ),
        ),
      ),
    );
  }

  IconData _channelIcon(String channel) {
    switch (channel.toLowerCase()) {
      case 'call':
        return Icons.phone;
      case 'email':
        return Icons.email_outlined;
      case 'whatsapp':
        return Icons.chat_bubble_outline;
      case 'meeting':
        return Icons.groups_outlined;
      default:
        return Icons.notes;
    }
  }

  Color _channelColor(String channel) {
    switch (channel.toLowerCase()) {
      case 'call':
        return AppColors.success;
      case 'email':
        return AppColors.accent;
      case 'whatsapp':
        return const Color(0xFF25D366);
      case 'meeting':
        return AppColors.primary;
      default:
        return const Color(0xFF64748B);
    }
  }

  @override
  Widget build(BuildContext context) {
    final filteredLogs = _selectedChannel == 'all'
        ? _logs
        : _logs.where((l) => l.channel.toLowerCase() == _selectedChannel).toList();

    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.lead != null ? '${widget.lead!.companyName} Timeline' : '360° Lead Timeline',
        ),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh),
            onPressed: _loadTimeline,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primary,
        onPressed: _showLogInteractionDialog,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Log Interaction', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: Column(
        children: [
          // Channel Filter Chips
          Container(
            color: AppColors.surface,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: SizedBox(
              height: 32,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  _channelFilterChip('all', 'ALL'),
                  ...AppConstants.communicationChannels.map(
                    (ch) => _channelFilterChip(ch, ch.toUpperCase()),
                  ),
                ],
              ),
            ),
          ),
          const Divider(height: 1),

          // Timeline Stream
          Expanded(
            child: _isLoading
                ? const LoadingIndicator(message: 'Loading timeline interactions...')
                : filteredLogs.isEmpty
                    ? EmptyStateView(
                        icon: Icons.timeline,
                        title: 'No Interactions Logged',
                        description: 'No communication records have been logged for this lead yet.',
                        actionLabel: 'Log First Interaction',
                        onAction: _showLogInteractionDialog,
                      )
                    : RefreshIndicator(
                        onRefresh: _loadTimeline,
                        child: ListView.separated(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                          itemCount: filteredLogs.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 12),
                          itemBuilder: (context, index) {
                            final log = filteredLogs[index];
                            final icon = _channelIcon(log.channel);
                            final color = _channelColor(log.channel);

                            return Card(
                              child: Padding(
                                padding: const EdgeInsets.all(14.0),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.all(10),
                                      decoration: BoxDecoration(
                                        color: color.withOpacity(0.12),
                                        shape: BoxShape.circle,
                                      ),
                                      child: Icon(icon, color: color, size: 20),
                                    ),
                                    const SizedBox(width: 14),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                            children: [
                                              Text(
                                                log.summary,
                                                style: const TextStyle(
                                                  fontSize: 14.5,
                                                  fontWeight: FontWeight.w700,
                                                  color: AppColors.textPrimary,
                                                ),
                                              ),
                                              Text(
                                                log.createdAt.split('T').first,
                                                style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                                              ),
                                            ],
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            'Logged by: ${log.loggedByName.isNotEmpty ? log.loggedByName : "Staff"}',
                                            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                          ),
                                          if (log.notes.isNotEmpty) ...[
                                            const SizedBox(height: 8),
                                            Container(
                                              padding: const EdgeInsets.all(8),
                                              decoration: BoxDecoration(
                                                color: AppColors.background,
                                                borderRadius: BorderRadius.circular(6),
                                              ),
                                              child: Text(
                                                log.notes,
                                                style: const TextStyle(fontSize: 12.5, color: AppColors.textPrimary),
                                              ),
                                            ),
                                          ],
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _channelFilterChip(String channel, String label) {
    final isSelected = _selectedChannel == channel;
    return Padding(
      padding: const EdgeInsets.only(right: 8.0),
      child: FilterChip(
        selected: isSelected,
        label: Text(label),
        labelStyle: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: isSelected ? Colors.white : AppColors.textSecondary,
        ),
        selectedColor: AppColors.primary,
        backgroundColor: AppColors.background,
        checkmarkColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 4),
        onSelected: (val) => setState(() => _selectedChannel = channel),
      ),
    );
  }
}
