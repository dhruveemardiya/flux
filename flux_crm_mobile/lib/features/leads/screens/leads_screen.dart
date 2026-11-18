import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/empty_state_view.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../../../core/widgets/status_badge.dart';
import '../../../models/lead_model.dart';
import '../../../models/segment_model.dart';
import '../../../services/crm_service.dart';

/// Searchable and filterable CRM lead management list screen.
class LeadsScreen extends StatefulWidget {
  const LeadsScreen({Key? key}) : super(key: key);

  @override
  State<LeadsScreen> createState() => _LeadsScreenState();
}

class _LeadsScreenState extends State<LeadsScreen> {
  List<CRMLead> _leads = [];
  List<CRMSegment> _segments = [];
  bool _isLoading = true;
  String _selectedStatus = 'all';
  int? _selectedSegmentId;
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadInitialData() async {
    setState(() => _isLoading = true);
    final crmService = context.read<CrmService>();

    try {
      final results = await Future.wait([
        crmService.getLeads(
          status: _selectedStatus == 'all' ? null : _selectedStatus,
          segmentId: _selectedSegmentId,
          search: _searchController.text.trim(),
        ),
        crmService.getSegments().catchError((_) => <CRMSegment>[]),
      ]);

      if (mounted) {
        setState(() {
          _leads = results[0] as List<CRMLead>;
          _segments = results[1] as List<CRMSegment>;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error loading leads: $e'), backgroundColor: AppColors.danger),
        );
      }
    }
  }

  Future<void> _fetchLeads() async {
    setState(() => _isLoading = true);
    final crmService = context.read<CrmService>();

    try {
      final leads = await crmService.getLeads(
        status: _selectedStatus == 'all' ? null : _selectedStatus,
        segmentId: _selectedSegmentId,
        search: _searchController.text.trim(),
      );

      if (mounted) {
        setState(() {
          _leads = leads;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Lead Management'),
        actions: [
          IconButton(
            tooltip: 'Import Excel Leads',
            icon: const Icon(Icons.file_upload_outlined),
            onPressed: () => context.push('/leads/import'),
          ),
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh),
            onPressed: _fetchLeads,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: AppColors.primary,
        onPressed: () async {
          final created = await context.push<bool>('/leads/create');
          if (created == true) _fetchLeads();
        },
        child: const Icon(Icons.add, color: Colors.white),
      ),
      body: Column(
        children: [
          // Search & Filter Header
          Container(
            color: AppColors.surface,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Column(
              children: [
                // Search Input
                TextField(
                  controller: _searchController,
                  onSubmitted: (_) => _fetchLeads(),
                  decoration: InputDecoration(
                    hintText: 'Search by company, contact, or email...',
                    prefixIcon: const Icon(Icons.search, size: 20),
                    suffixIcon: _searchController.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear, size: 18),
                            onPressed: () {
                              _searchController.clear();
                              _fetchLeads();
                            },
                          )
                        : null,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  ),
                ),
                const SizedBox(height: 10),

                // Segment Dropdown & Status Filter
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
                            value: _selectedSegmentId,
                            isExpanded: true,
                            hint: const Text('All Segments', style: TextStyle(fontSize: 13)),
                            items: [
                              const DropdownMenuItem<int?>(
                                value: null,
                                child: Text('All Segments', style: TextStyle(fontSize: 13)),
                              ),
                              ..._segments.map(
                                (s) => DropdownMenuItem<int?>(
                                  value: s.id,
                                  child: Text(s.name, style: const TextStyle(fontSize: 13)),
                                ),
                              ),
                            ],
                            onChanged: (val) {
                              setState(() => _selectedSegmentId = val);
                              _fetchLeads();
                            },
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '${_leads.length} Leads',
                        style: const TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.bold,
                          color: AppColors.primary,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),

                // Horizontal Status Pills
                SizedBox(
                  height: 32,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: [
                      _statusChip('all', 'ALL'),
                      ...AppConstants.leadStatuses.map(
                        (status) => _statusChip(status, status.replaceAll('_', ' ').toUpperCase()),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          // Leads List
          Expanded(
            child: _isLoading
                ? const LoadingIndicator(message: 'Loading leads...')
                : _leads.isEmpty
                    ? EmptyStateView(
                        icon: Icons.people_outline,
                        title: 'No Leads Found',
                        description: 'No leads match the selected status or filter.',
                        actionLabel: 'Create New Lead',
                        onAction: () async {
                          final created = await context.push<bool>('/leads/create');
                          if (created == true) _fetchLeads();
                        },
                      )
                    : RefreshIndicator(
                        onRefresh: _fetchLeads,
                        child: ListView.separated(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          itemCount: _leads.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 10),
                          itemBuilder: (context, index) {
                            final lead = _leads[index];
                            return _LeadCard(
                              lead: lead,
                              onTap: () async {
                                final modified = await context.push<bool>('/leads/${lead.id}');
                                if (modified == true) _fetchLeads();
                              },
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _statusChip(String status, String label) {
    final isSelected = _selectedStatus == status;
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
        onSelected: (val) {
          setState(() => _selectedStatus = status);
          _fetchLeads();
        },
      ),
    );
  }
}

class _LeadCard extends StatelessWidget {
  final CRMLead lead;
  final VoidCallback onTap;

  const _LeadCard({Key? key, required this.lead, required this.onTap}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.divider),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      lead.companyName,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                  StatusBadge(status: lead.status),
                ],
              ),
              const SizedBox(height: 8),

              if (lead.contactPerson.isNotEmpty) ...[
                Row(
                  children: [
                    const Icon(Icons.person_outline, size: 15, color: AppColors.textMuted),
                    const SizedBox(width: 6),
                    Text(
                      lead.contactPerson,
                      style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
              ],

              if (lead.phone.isNotEmpty) ...[
                Row(
                  children: [
                    const Icon(Icons.phone_outlined, size: 15, color: AppColors.textMuted),
                    const SizedBox(width: 6),
                    Text(
                      lead.phone,
                      style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
              ],

              const SizedBox(height: 8),
              const Divider(height: 1),
              const SizedBox(height: 8),

              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  if (lead.segmentName != null && lead.segmentName!.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.infoBg,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        lead.segmentName!,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: AppColors.info,
                        ),
                      ),
                    )
                  else
                    const SizedBox.shrink(),

                  Text(
                    lead.assignedToName != null && lead.assignedToName!.isNotEmpty
                        ? 'Assigned: ${lead.assignedToName}'
                        : 'Unassigned',
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w500,
                      color: lead.assignedToName != null ? AppColors.textSecondary : AppColors.warning,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
