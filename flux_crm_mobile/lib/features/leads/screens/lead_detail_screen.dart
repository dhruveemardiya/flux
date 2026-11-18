import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/confirm_dialog.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../../../core/widgets/status_badge.dart';
import '../../../models/lead_model.dart';
import '../../../services/crm_service.dart';

/// Detailed view of a CRM lead with 360° timeline link and quick communications.
class LeadDetailScreen extends StatefulWidget {
  final int leadId;

  const LeadDetailScreen({Key? key, required this.leadId}) : super(key: key);

  @override
  State<LeadDetailScreen> createState() => _LeadDetailScreenState();
}

class _LeadDetailScreenState extends State<LeadDetailScreen> {
  CRMLead? _lead;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadLead();
  }

  Future<void> _loadLead() async {
    setState(() => _isLoading = true);
    try {
      final crmService = context.read<CrmService>();
      final lead = await crmService.getLeadDetail(widget.leadId);
      if (mounted) {
        setState(() {
          _lead = lead;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load lead: $e'), backgroundColor: AppColors.danger),
        );
      }
    }
  }

  void _callPhone(String phone) async {
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  void _sendEmail(String email) async {
    final uri = Uri.parse('mailto:$email');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  void _handleDelete() async {
    final confirmed = await showConfirmDialog(
      context: context,
      title: 'Delete Lead',
      message: 'Are you sure you want to delete "${_lead?.companyName}"? This action cannot be undone.',
      confirmLabel: 'Delete',
      isDestructive: true,
    );

    if (confirmed == true && mounted) {
      try {
        await context.read<CrmService>().deleteLead(widget.leadId);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Lead deleted successfully')),
          );
          Navigator.pop(context, true);
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error deleting lead: $e'), backgroundColor: AppColors.danger),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: LoadingIndicator(message: 'Loading lead details...'),
      );
    }

    if (_lead == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Lead Not Found')),
        body: const Center(child: Text('The requested lead could not be found.')),
      );
    }

    final lead = _lead!;

    return Scaffold(
      appBar: AppBar(
        title: Text(lead.companyName),
        actions: [
          IconButton(
            tooltip: 'Edit Lead',
            icon: const Icon(Icons.edit_outlined),
            onPressed: () async {
              final updated = await context.push<bool>('/leads/${lead.id}/edit', extra: lead);
              if (updated == true) _loadLead();
            },
          ),
          IconButton(
            tooltip: 'Delete Lead',
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
            // Company Header Card
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
                      Expanded(
                        child: Text(
                          lead.companyName,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ),
                      StatusBadge(status: lead.status),
                    ],
                  ),
                  if (lead.segmentName != null) ...[
                    const SizedBox(height: 6),
                    Text(
                      'Segment: ${lead.segmentName}',
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.primary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),

                  // Quick Action Buttons
                  Row(
                    children: [
                      if (lead.phone.isNotEmpty)
                        Expanded(
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.success,
                              padding: const EdgeInsets.symmetric(vertical: 10),
                            ),
                            icon: const Icon(Icons.phone, size: 16),
                            label: const Text('Call', style: TextStyle(fontSize: 13)),
                            onPressed: () => _callPhone(lead.phone),
                          ),
                        ),
                      if (lead.phone.isNotEmpty && lead.email.isNotEmpty)
                        const SizedBox(width: 10),
                      if (lead.email.isNotEmpty)
                        Expanded(
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.accent,
                              padding: const EdgeInsets.symmetric(vertical: 10),
                            ),
                            icon: const Icon(Icons.email, size: 16),
                            label: const Text('Email', style: TextStyle(fontSize: 13)),
                            onPressed: () => _sendEmail(lead.email),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // 360° Timeline Navigation Card
            InkWell(
              onTap: () => context.push('/leads/${lead.id}/timeline', extra: lead),
              borderRadius: BorderRadius.circular(12),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.primary.withOpacity(0.3)),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.timeline, color: Colors.white, size: 22),
                    ),
                    const SizedBox(width: 14),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '360° Communication Timeline',
                            style: TextStyle(
                              fontSize: 14.5,
                              fontWeight: FontWeight.w700,
                              color: AppColors.primaryDark,
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'View interaction history, calls, emails, and notes',
                            style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right, color: AppColors.primary),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Contact Information
            _sectionHeader('CONTACT DETAILS'),
            _infoCard([
              _infoRow(Icons.person, 'Contact Person', lead.contactPerson),
              _infoRow(Icons.email, 'Email Address', lead.email),
              _infoRow(Icons.phone, 'Phone Number', lead.phone),
            ]),
            const SizedBox(height: 18),

            // Pipeline & Assignment
            _sectionHeader('PIPELINE & ASSIGNMENT'),
            _infoCard([
              _infoRow(Icons.flag_outlined, 'Status', lead.status.replaceAll('_', ' ').toUpperCase()),
              _infoRow(Icons.category_outlined, 'Segment', lead.segmentName ?? 'Unassigned'),
              _infoRow(Icons.assignment_ind_outlined, 'Assigned Staff', lead.assignedToName ?? 'Unassigned'),
            ]),
            const SizedBox(height: 18),

            // Location
            if (lead.address.isNotEmpty || lead.city.isNotEmpty || lead.state.isNotEmpty) ...[
              _sectionHeader('LOCATION DETAILS'),
              _infoCard([
                if (lead.address.isNotEmpty) _infoRow(Icons.location_on_outlined, 'Address', lead.address),
                if (lead.city.isNotEmpty) _infoRow(Icons.location_city_outlined, 'City', lead.city),
                if (lead.state.isNotEmpty) _infoRow(Icons.map_outlined, 'State / Region', lead.state),
                if (lead.country.isNotEmpty) _infoRow(Icons.public_outlined, 'Country', lead.country),
              ]),
              const SizedBox(height: 18),
            ],

            // Internal Notes
            if (lead.notes.isNotEmpty) ...[
              _sectionHeader('INTERNAL NOTES'),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.divider),
                ),
                child: Text(
                  lead.notes,
                  style: const TextStyle(fontSize: 13.5, color: AppColors.textPrimary, height: 1.4),
                ),
              ),
              const SizedBox(height: 24),
            ],
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

  Widget _infoCard(List<Widget> children) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.divider),
      ),
      child: Column(children: children),
    );
  }

  Widget _infoRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: AppColors.textMuted),
          const SizedBox(width: 12),
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
          ),
          Expanded(
            child: Text(
              value.isNotEmpty ? value : '—',
              style: const TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
