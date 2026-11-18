import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/confirm_dialog.dart';
import '../../../core/widgets/empty_state_view.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../../../models/segment_model.dart';
import '../../../services/crm_service.dart';

/// Segment management screen with lead counters and modal CRUD actions.
class SegmentsScreen extends StatefulWidget {
  const SegmentsScreen({Key? key}) : super(key: key);

  @override
  State<SegmentsScreen> createState() => _SegmentsScreenState();
}

class _SegmentsScreenState extends State<SegmentsScreen> {
  List<CRMSegment> _segments = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadSegments();
  }

  Future<void> _loadSegments() async {
    setState(() => _isLoading = true);
    try {
      final segments = await context.read<CrmService>().getSegments();
      if (mounted) {
        setState(() {
          _segments = segments;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error loading segments: $e'), backgroundColor: AppColors.danger),
        );
      }
    }
  }

  void _showSegmentDialog({CRMSegment? segment}) {
    final isEdit = segment != null;
    final nameController = TextEditingController(text: segment?.name ?? '');
    final descController = TextEditingController(text: segment?.description ?? '');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(isEdit ? 'Edit Segment' : 'Create New Segment', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameController,
              decoration: const InputDecoration(labelText: 'Segment Name *', hintText: 'e.g. Technology & SaaS'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: descController,
              maxLines: 2,
              decoration: const InputDecoration(labelText: 'Description', hintText: 'Criteria or target group...'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              final name = nameController.text.trim();
              if (name.isEmpty) return;

              final crmService = context.read<CrmService>();
              try {
                if (isEdit) {
                  await crmService.updateSegment(segment.id, name, descController.text.trim());
                } else {
                  await crmService.createSegment(name, descController.text.trim());
                }
                Navigator.pop(ctx);
                _loadSegments();
              } catch (e) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Error saving segment: $e'), backgroundColor: AppColors.danger),
                );
              }
            },
            child: Text(isEdit ? 'Update' : 'Create'),
          ),
        ],
      ),
    );
  }

  void _handleDelete(CRMSegment segment) async {
    final confirmed = await showConfirmDialog(
      context: context,
      title: 'Delete Segment',
      message: 'Are you sure you want to delete "${segment.name}"? Leads in this segment will remain in the database.',
      confirmLabel: 'Delete',
      isDestructive: true,
    );

    if (confirmed == true && mounted) {
      try {
        await context.read<CrmService>().deleteSegment(segment.id);
        _loadSegments();
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error deleting segment: $e'), backgroundColor: AppColors.danger),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Segment Management'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh),
            onPressed: _loadSegments,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: AppColors.primary,
        onPressed: () => _showSegmentDialog(),
        child: const Icon(Icons.add, color: Colors.white),
      ),
      body: _isLoading
          ? const LoadingIndicator(message: 'Loading segments...')
          : _segments.isEmpty
              ? EmptyStateView(
                  icon: Icons.category_outlined,
                  title: 'No Segments Configured',
                  description: 'Create segments to categorize leads by industry, vertical, or size.',
                  actionLabel: 'Create Segment',
                  onAction: () => _showSegmentDialog(),
                )
              : RefreshIndicator(
                  onRefresh: _loadSegments,
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    itemCount: _segments.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final segment = _segments[index];
                      return Card(
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
                                      segment.name,
                                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: AppColors.primary.withOpacity(0.08),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Text(
                                      '${segment.leadCount} Leads',
                                      style: const TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.bold,
                                        color: AppColors.primary,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              if (segment.description.isNotEmpty) ...[
                                const SizedBox(height: 6),
                                Text(
                                  segment.description,
                                  style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                                ),
                              ],
                              const SizedBox(height: 10),
                              const Divider(height: 1),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.end,
                                children: [
                                  TextButton.icon(
                                    icon: const Icon(Icons.edit_outlined, size: 16),
                                    label: const Text('Edit', style: TextStyle(fontSize: 12.5)),
                                    onPressed: () => _showSegmentDialog(segment: segment),
                                  ),
                                  TextButton.icon(
                                    icon: const Icon(Icons.delete_outline, size: 16, color: AppColors.danger),
                                    label: const Text('Delete', style: TextStyle(fontSize: 12.5, color: AppColors.danger)),
                                    onPressed: () => _handleDelete(segment),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}
