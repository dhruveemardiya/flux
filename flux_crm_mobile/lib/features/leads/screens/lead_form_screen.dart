import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/custom_button.dart';
import '../../../core/widgets/custom_text_field.dart';
import '../../../models/lead_model.dart';
import '../../../models/segment_model.dart';
import '../../../services/crm_service.dart';

/// Form screen for creating or editing a CRM lead record.
class LeadFormScreen extends StatefulWidget {
  final CRMLead? existingLead;

  const LeadFormScreen({Key? key, this.existingLead}) : super(key: key);

  @override
  State<LeadFormScreen> createState() => _LeadFormScreenState();
}

class _LeadFormScreenState extends State<LeadFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _companyController;
  late final TextEditingController _contactController;
  late final TextEditingController _phoneController;
  late final TextEditingController _emailController;
  late final TextEditingController _notesController;
  late final TextEditingController _addressController;
  late final TextEditingController _cityController;
  late final TextEditingController _stateController;
  late final TextEditingController _countryController;

  String _status = 'new';
  int? _segmentId;
  List<CRMSegment> _segments = [];
  bool _isLoading = false;
  bool _isSaving = false;

  bool get isEdit => widget.existingLead != null;

  @override
  void initState() {
    super.initState();
    final l = widget.existingLead;
    _companyController = TextEditingController(text: l?.companyName ?? '');
    _contactController = TextEditingController(text: l?.contactPerson ?? '');
    _phoneController = TextEditingController(text: l?.phone ?? '');
    _emailController = TextEditingController(text: l?.email ?? '');
    _notesController = TextEditingController(text: l?.notes ?? '');
    _addressController = TextEditingController(text: l?.address ?? '');
    _cityController = TextEditingController(text: l?.city ?? '');
    _stateController = TextEditingController(text: l?.state ?? '');
    _countryController = TextEditingController(text: l?.country ?? '');

    if (l != null) {
      _status = l.status;
      _segmentId = l.segmentId;
    }

    _loadSegments();
  }

  @override
  void dispose() {
    _companyController.dispose();
    _contactController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _notesController.dispose();
    _addressController.dispose();
    _cityController.dispose();
    _stateController.dispose();
    _countryController.dispose();
    super.dispose();
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
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _handleSave() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSaving = true);
    final crmService = context.read<CrmService>();

    final payload = {
      'company_name': _companyController.text.trim(),
      'contact_person': _contactController.text.trim(),
      'phone': _phoneController.text.trim(),
      'email': _emailController.text.trim(),
      'status': _status,
      if (_segmentId != null) 'segment': _segmentId,
      'notes': _notesController.text.trim(),
      'address': _addressController.text.trim(),
      'city': _cityController.text.trim(),
      'state': _stateController.text.trim(),
      'country': _countryController.text.trim(),
    };

    try {
      if (isEdit) {
        await crmService.updateLead(widget.existingLead!.id, payload);
      } else {
        await crmService.createLead(payload);
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(isEdit ? 'Lead updated successfully' : 'Lead created successfully')),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSaving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error saving lead: $e'), backgroundColor: AppColors.danger),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(isEdit ? 'Edit Lead' : 'Create New Lead'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 16.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              CustomTextField(
                controller: _companyController,
                label: 'Company Name *',
                hint: 'e.g. Acme Corporation',
                prefixIcon: Icons.business,
                validator: (val) {
                  if (val == null || val.trim().isEmpty) {
                    return 'Company name is required';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              CustomTextField(
                controller: _contactController,
                label: 'Contact Person',
                hint: 'e.g. John Doe',
                prefixIcon: Icons.person_outline,
              ),
              const SizedBox(height: 16),

              CustomTextField(
                controller: _phoneController,
                label: 'Phone Number',
                hint: '+1 234 567 890',
                keyboardType: TextInputType.phone,
                prefixIcon: Icons.phone_outlined,
              ),
              const SizedBox(height: 16),

              CustomTextField(
                controller: _emailController,
                label: 'Email Address',
                hint: 'contact@acme.com',
                keyboardType: TextInputType.emailAddress,
                prefixIcon: Icons.email_outlined,
              ),
              const SizedBox(height: 16),

              // Status Dropdown
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Lead Status *',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.divider),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: _status,
                        isExpanded: true,
                        items: AppConstants.leadStatuses.map((s) {
                          return DropdownMenuItem(
                            value: s,
                            child: Text(s.replaceAll('_', ' ').toUpperCase(), style: const TextStyle(fontSize: 13.5)),
                          );
                        }).toList(),
                        onChanged: (val) {
                          if (val != null) setState(() => _status = val);
                        },
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Segment Dropdown
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Segment',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.divider),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<int?>(
                        value: _segmentId,
                        isExpanded: true,
                        hint: const Text('None (Unassigned Segment)', style: TextStyle(fontSize: 13.5)),
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
                        onChanged: (val) => setState(() => _segmentId = val),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              CustomTextField(
                controller: _addressController,
                label: 'Street Address',
                hint: '123 Enterprise Blvd',
                prefixIcon: Icons.location_on_outlined,
              ),
              const SizedBox(height: 16),

              Row(
                children: [
                  Expanded(
                    child: CustomTextField(
                      controller: _cityController,
                      label: 'City',
                      hint: 'Metropolis',
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: CustomTextField(
                      controller: _stateController,
                      label: 'State / Province',
                      hint: 'NY',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              CustomTextField(
                controller: _notesController,
                label: 'Notes & Observations',
                hint: 'Additional context, requirements, or lead source...',
                maxLines: 4,
              ),
              const SizedBox(height: 28),

              CustomButton(
                text: isEdit ? 'Update Lead' : 'Save Lead',
                isLoading: _isSaving,
                onPressed: _handleSave,
                height: 50,
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
