import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/empty_state_view.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../../../core/widgets/status_badge.dart';
import '../../../models/lead_model.dart';
import '../../../services/crm_service.dart';

/// Instant debounced search screen across company, contact, phone, and email.
class QuickSearchScreen extends StatefulWidget {
  const QuickSearchScreen({Key? key}) : super(key: key);

  @override
  State<QuickSearchScreen> createState() => _QuickSearchScreenState();
}

class _QuickSearchScreenState extends State<QuickSearchScreen> {
  final TextEditingController _searchController = TextEditingController();
  Timer? _debounceTimer;
  List<CRMLead> _searchResults = [];
  bool _isSearching = false;
  bool _hasSearched = false;

  @override
  void dispose() {
    _searchController.dispose();
    _debounceTimer?.cancel();
    super.dispose();
  }

  void _onSearchChanged(String query) {
    _debounceTimer?.cancel();
    if (query.trim().isEmpty) {
      setState(() {
        _searchResults = [];
        _isSearching = false;
        _hasSearched = false;
      });
      return;
    }

    _debounceTimer = Timer(const Duration(milliseconds: 350), () {
      _performSearch(query.trim());
    });
  }

  Future<void> _performSearch(String query) async {
    setState(() {
      _isSearching = true;
      _hasSearched = true;
    });

    try {
      final results = await context.read<CrmService>().quickSearch(query);
      if (mounted) {
        setState(() {
          _searchResults = results;
          _isSearching = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSearching = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: TextField(
          controller: _searchController,
          autofocus: true,
          onChanged: _onSearchChanged,
          decoration: const InputDecoration(
            hintText: 'Search company, contact, phone, email...',
            border: InputBorder.none,
            enabledBorder: InputBorder.none,
            focusedBorder: InputBorder.none,
            filled: false,
            hintStyle: TextStyle(color: AppColors.textMuted, fontSize: 15),
          ),
          style: const TextStyle(fontSize: 15, color: AppColors.textPrimary),
        ),
        actions: [
          if (_searchController.text.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.clear),
              onPressed: () {
                _searchController.clear();
                _onSearchChanged('');
              },
            ),
        ],
      ),
      body: _isSearching
          ? const LoadingIndicator(message: 'Searching CRM database...')
          : !_hasSearched
              ? const EmptyStateView(
                  icon: Icons.search,
                  title: 'Instant CRM Search',
                  description: 'Type a company name, contact person, phone number, or email to search live records.',
                )
              : _searchResults.isEmpty
                  ? EmptyStateView(
                      icon: Icons.search_off,
                      title: 'No Matching Leads Found',
                      description: 'No leads matched "${_searchController.text.trim()}".',
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      itemCount: _searchResults.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        final lead = _searchResults[index];
                        return Card(
                          child: ListTile(
                            leading: CircleAvatar(
                              backgroundColor: AppColors.primary.withOpacity(0.1),
                              child: const Icon(Icons.business, color: AppColors.primary, size: 20),
                            ),
                            title: Text(
                              lead.companyName,
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14.5),
                            ),
                            subtitle: Text(
                              '${lead.contactPerson} • ${lead.phone.isNotEmpty ? lead.phone : lead.email}',
                              style: const TextStyle(fontSize: 12),
                            ),
                            trailing: StatusBadge(status: lead.status),
                            onTap: () => context.push('/leads/${lead.id}'),
                          ),
                        );
                      },
                    ),
    );
  }
}
