import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/custom_button.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../../../models/segment_model.dart';
import '../../../services/crm_service.dart';

/// Multi-step Excel / CSV file import screen with column mapping and duplicate resolution.
class LeadImportScreen extends StatefulWidget {
  const LeadImportScreen({Key? key}) : super(key: key);

  @override
  State<LeadImportScreen> createState() => _LeadImportScreenState();
}

class _LeadImportScreenState extends State<LeadImportScreen> {
  File? _selectedFile;
  String? _fileName;
  bool _isPreviewing = false;
  bool _isCommitting = false;

  List<String> _headers = [];
  List<Map<String, dynamic>> _previewRows = [];
  List<CRMSegment> _segments = [];
  int? _targetSegmentId;
  String _duplicatePolicy = 'skip'; // 'skip' or 'overwrite'

  final Map<String, String?> _mapping = {
    'company_name': null,
    'contact_person': null,
    'phone': null,
    'email': null,
    'notes': null,
  };

  Map<String, dynamic>? _importResult;

  @override
  void initState() {
    super.initState();
    _loadSegments();
  }

  Future<void> _loadSegments() async {
    try {
      final segments = await context.read<CrmService>().getSegments();
      if (mounted) setState(() => _segments = segments);
    } catch (_) {}
  }

  void _pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['xlsx', 'xls', 'csv'],
    );

    if (result != null && result.files.single.path != null) {
      final file = File(result.files.single.path!);
      setState(() {
        _selectedFile = file;
        _fileName = result.files.single.name;
        _importResult = null;
      });
      _previewFile(file);
    }
  }

  Future<void> _previewFile(File file) async {
    setState(() => _isPreviewing = true);
    final crmService = context.read<CrmService>();

    try {
      final previewData = await crmService.previewLeadImport(file);
      final rawHeaders = previewData['headers'] is List
          ? (previewData['headers'] as List).map((e) => e.toString()).toList()
          : <String>[];
      final rawRows = previewData['preview_rows'] is List
          ? (previewData['preview_rows'] as List).cast<Map<String, dynamic>>()
          : <Map<String, dynamic>>[];

      // Auto-detect common column headers
      for (final h in rawHeaders) {
        final lower = h.toLowerCase();
        if ((lower.contains('company') || lower.contains('business')) && _mapping['company_name'] == null) {
          _mapping['company_name'] = h;
        } else if ((lower.contains('contact') || lower.contains('name') || lower.contains('person')) && _mapping['contact_person'] == null) {
          _mapping['contact_person'] = h;
        } else if ((lower.contains('phone') || lower.contains('mobile') || lower.contains('tel')) && _mapping['phone'] == null) {
          _mapping['phone'] = h;
        } else if (lower.contains('email') && _mapping['email'] == null) {
          _mapping['email'] = h;
        } else if (lower.contains('notes') || lower.contains('remark')) {
          _mapping['notes'] = h;
        }
      }

      if (mounted) {
        setState(() {
          _headers = rawHeaders;
          _previewRows = rawRows;
          _isPreviewing = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isPreviewing = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to preview file: $e'), backgroundColor: AppColors.danger),
        );
      }
    }
  }

  void _commitImport() async {
    if (_mapping['company_name'] == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please map the "Company Name" column'), backgroundColor: AppColors.danger),
      );
      return;
    }

    setState(() => _isCommitting = true);
    final crmService = context.read<CrmService>();

    final validMapping = <String, String>{};
    _mapping.forEach((k, v) {
      if (v != null) validMapping[k] = v;
    });

    try {
      final result = await crmService.commitLeadImport(
        rows: _previewRows,
        mapping: validMapping,
        segmentId: _targetSegmentId,
        duplicatePolicy: _duplicatePolicy,
      );

      if (mounted) {
        setState(() {
          _importResult = result;
          _isCommitting = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isCommitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Import failed: $e'), backgroundColor: AppColors.danger),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Excel Lead Import'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Upload Dropzone
            InkWell(
              onTap: _pickFile,
              borderRadius: BorderRadius.circular(14),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 20),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: _selectedFile != null ? AppColors.primary : AppColors.divider,
                    width: _selectedFile != null ? 1.5 : 1,
                  ),
                ),
                child: Column(
                  children: [
                    Icon(
                      _selectedFile != null ? Icons.check_circle_outline : Icons.cloud_upload_outlined,
                      size: 44,
                      color: _selectedFile != null ? AppColors.success : AppColors.primary,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      _fileName ?? 'Tap to select an Excel (.xlsx, .xls) or CSV file',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: _selectedFile != null ? AppColors.textPrimary : AppColors.primary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Supports standard sheets with lead contacts',
                      style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            if (_isPreviewing)
              const LoadingIndicator(message: 'Parsing and previewing columns...')
            else if (_headers.isNotEmpty) ...[
              // Configuration Section
              const Text(
                '1. COLUMN MAPPING',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 8),

              _mappingDropdown('Company Name *', 'company_name'),
              const SizedBox(height: 10),
              _mappingDropdown('Contact Person', 'contact_person'),
              const SizedBox(height: 10),
              _mappingDropdown('Phone Number', 'phone'),
              const SizedBox(height: 10),
              _mappingDropdown('Email Address', 'email'),
              const SizedBox(height: 10),
              _mappingDropdown('Notes / Details', 'notes'),
              const SizedBox(height: 20),

              const Text(
                '2. TARGET SEGMENT & DUPLICATES',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 8),

              // Segment Picker
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.divider),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<int?>(
                    value: _targetSegmentId,
                    isExpanded: true,
                    hint: const Text('Assign Target Segment (Optional)', style: TextStyle(fontSize: 13.5)),
                    items: [
                      const DropdownMenuItem<int?>(
                        value: null,
                        child: Text('None (Unassigned Segment)', style: TextStyle(fontSize: 13.5)),
                      ),
                      ..._segments.map(
                        (s) => DropdownMenuItem<int?>(
                          value: s.id,
                          child: Text(s.name, style: const TextStyle(fontSize: 13.5)),
                        ),
                      ),
                    ],
                    onChanged: (val) => setState(() => _targetSegmentId = val),
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // Duplicate Handling
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.divider),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _duplicatePolicy,
                    isExpanded: true,
                    items: const [
                      DropdownMenuItem(
                        value: 'skip',
                        child: Text('Skip Existing Leads (Preserve Existing)', style: TextStyle(fontSize: 13.5)),
                      ),
                      DropdownMenuItem(
                        value: 'overwrite',
                        child: Text('Overwrite / Update Existing Leads', style: TextStyle(fontSize: 13.5)),
                      ),
                    ],
                    onChanged: (val) {
                      if (val != null) setState(() => _duplicatePolicy = val);
                    },
                  ),
                ),
              ),
              const SizedBox(height: 24),

              CustomButton(
                text: 'Commit Import (${_previewRows.length} Rows)',
                isLoading: _isCommitting,
                onPressed: _commitImport,
                height: 50,
              ),
              const SizedBox(height: 20),
            ],

            // Success Result Banner
            if (_importResult != null) ...[
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.successBg,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.success.withOpacity(0.4)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: const [
                        Icon(Icons.check_circle, color: AppColors.success, size: 22),
                        SizedBox(width: 8),
                        Text(
                          'Import Completed Successfully',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppColors.success),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      '• Created: ${_importResult!['created'] ?? _importResult!['created_count'] ?? 0} leads\n'
                      '• Updated: ${_importResult!['updated'] ?? _importResult!['updated_count'] ?? 0} leads\n'
                      '• Skipped: ${_importResult!['skipped'] ?? _importResult!['skipped_count'] ?? 0} records',
                      style: const TextStyle(fontSize: 13, height: 1.5, color: AppColors.textPrimary),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
            ],
          ],
        ),
      ),
    );
  }

  Widget _mappingDropdown(String label, String key) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
        ),
        const SizedBox(height: 4),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.divider),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String?>(
              value: _mapping[key],
              isExpanded: true,
              hint: const Text('Select file column...', style: TextStyle(fontSize: 13)),
              items: [
                const DropdownMenuItem<String?>(
                  value: null,
                  child: Text('Ignore / Not Mapped', style: TextStyle(fontSize: 13, color: AppColors.textMuted)),
                ),
                ..._headers.map(
                  (h) => DropdownMenuItem<String?>(
                    value: h,
                    child: Text(h, style: const TextStyle(fontSize: 13)),
                  ),
                ),
              ],
              onChanged: (val) => setState(() => _mapping[key] = val),
            ),
          ),
        ),
      ],
    );
  }
}
