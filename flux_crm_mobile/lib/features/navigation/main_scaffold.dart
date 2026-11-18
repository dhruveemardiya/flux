import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../core/auth/auth_controller.dart';
import '../../../core/storage/secure_storage_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/confirm_dialog.dart';

/// Main scaffold with bottom navigation for core daily tabs and drawer for full module access.
class MainScaffold extends StatefulWidget {
  final Widget child;
  final String location;

  const MainScaffold({
    Key? key,
    required this.child,
    required this.location,
  }) : super(key: key);

  @override
  State<MainScaffold> createState() => _MainScaffoldState();
}

class _MainScaffoldState extends State<MainScaffold> {
  int _calculateSelectedIndex(BuildContext context) {
    final loc = widget.location;
    if (loc.startsWith('/dashboard')) return 0;
    if (loc.startsWith('/leads')) return 1;
    if (loc.startsWith('/tasks')) return 2;
    if (loc.startsWith('/my-work')) return 3;
    return 0;
  }

  void _onBottomNavTapped(int index) {
    switch (index) {
      case 0:
        context.go('/dashboard');
        break;
      case 1:
        context.go('/leads');
        break;
      case 2:
        context.go('/tasks');
        break;
      case 3:
        context.go('/my-work');
        break;
    }
  }

  void _showServerConfigDialog() async {
    final storage = context.read<SecureStorageService>();
    final currentUrl = await storage.getBaseUrl();
    final urlController = TextEditingController(text: currentUrl);

    if (!mounted) return;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Backend Server Settings', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Enter the URL of your Django backend API:',
              style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: urlController,
              decoration: const InputDecoration(
                labelText: 'Base URL',
                hintText: 'http://10.0.2.2:8000/api',
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'Tips:\n• Android Emulator: http://10.0.2.2:8000/api\n• iOS / Desktop: http://127.0.0.1:8000/api\n• Real Device: http://<LAN_IP>:8000/api',
              style: TextStyle(fontSize: 11.5, color: AppColors.textMuted, height: 1.3),
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
              final newUrl = urlController.text.trim();
              if (newUrl.isNotEmpty) {
                await storage.saveCustomBaseUrl(newUrl);
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Server URL updated to $newUrl')),
                  );
                }
              }
              Navigator.pop(ctx);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  void _handleLogout() async {
    final confirmed = await showConfirmDialog(
      context: context,
      title: 'Sign Out',
      message: 'Are you sure you want to end your CRM session?',
      confirmLabel: 'Sign Out',
      isDestructive: true,
    );

    if (confirmed == true && mounted) {
      await context.read<AuthController>().logout();
      if (mounted) {
        context.go('/login');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authController = context.watch<AuthController>();
    final user = authController.currentUser;
    final selectedIndex = _calculateSelectedIndex(context);

    return Scaffold(
      drawer: Drawer(
        child: Column(
          children: [
            // User Header
            UserAccountsDrawerHeader(
              decoration: const BoxDecoration(
                color: AppColors.secondary,
              ),
              currentAccountPicture: CircleAvatar(
                backgroundColor: AppColors.primary,
                child: Text(
                  (user?.displayName.isNotEmpty == true ? user!.displayName[0] : 'U').toUpperCase(),
                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white),
                ),
              ),
              accountName: Text(
                user?.displayName ?? 'CRM User',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
              accountEmail: Row(
                children: [
                  Text(
                    user?.email.isNotEmpty == true ? user!.email : '@${user?.username ?? ""}',
                    style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 13),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      (user?.role ?? 'staff').toUpperCase(),
                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                  ),
                ],
              ),
            ),

            // Navigation Links
            Expanded(
              child: ListView(
                padding: EdgeInsets.zero,
                children: [
                  ListTile(
                    leading: const Icon(Icons.dashboard_outlined, color: AppColors.primary),
                    title: const Text('Dashboard'),
                    selected: widget.location.startsWith('/dashboard'),
                    onTap: () {
                      Navigator.pop(context);
                      context.go('/dashboard');
                    },
                  ),
                  ListTile(
                    leading: const Icon(Icons.people_alt_outlined, color: AppColors.primary),
                    title: const Text('Lead Management'),
                    selected: widget.location.startsWith('/leads'),
                    onTap: () {
                      Navigator.pop(context);
                      context.go('/leads');
                    },
                  ),
                  ListTile(
                    leading: const Icon(Icons.assignment_outlined, color: AppColors.primary),
                    title: const Text('Task Groups'),
                    selected: widget.location.startsWith('/tasks'),
                    onTap: () {
                      Navigator.pop(context);
                      context.go('/tasks');
                    },
                  ),
                  ListTile(
                    leading: const Icon(Icons.work_outline, color: AppColors.primary),
                    title: const Text('My Work (Staff Tasks)'),
                    selected: widget.location.startsWith('/my-work'),
                    onTap: () {
                      Navigator.pop(context);
                      context.go('/my-work');
                    },
                  ),
                  const Divider(),
                  ListTile(
                    leading: const Icon(Icons.bar_chart_outlined, color: AppColors.accent),
                    title: const Text('Performance Reports'),
                    selected: widget.location.startsWith('/reports'),
                    onTap: () {
                      Navigator.pop(context);
                      context.go('/reports');
                    },
                  ),
                  ListTile(
                    leading: const Icon(Icons.person_add_alt_1_outlined, color: AppColors.accent),
                    title: const Text('Lead Assignment'),
                    selected: widget.location.startsWith('/assignments'),
                    onTap: () {
                      Navigator.pop(context);
                      context.go('/assignments');
                    },
                  ),
                  ListTile(
                    leading: const Icon(Icons.file_upload_outlined, color: AppColors.accent),
                    title: const Text('Excel Lead Import'),
                    selected: widget.location.startsWith('/leads/import'),
                    onTap: () {
                      Navigator.pop(context);
                      context.go('/leads/import');
                    },
                  ),
                  ListTile(
                    leading: const Icon(Icons.category_outlined, color: AppColors.accent),
                    title: const Text('Segment Management'),
                    selected: widget.location.startsWith('/segments'),
                    onTap: () {
                      Navigator.pop(context);
                      context.go('/segments');
                    },
                  ),
                  ListTile(
                    leading: const Icon(Icons.badge_outlined, color: AppColors.accent),
                    title: const Text('User & Role Directory'),
                    subtitle: const Text('Read-only', style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
                    selected: widget.location.startsWith('/users'),
                    onTap: () {
                      Navigator.pop(context);
                      context.go('/users');
                    },
                  ),
                  ListTile(
                    leading: const Icon(Icons.search_outlined, color: AppColors.accent),
                    title: const Text('Quick Search'),
                    selected: widget.location.startsWith('/quick-search'),
                    onTap: () {
                      Navigator.pop(context);
                      context.go('/quick-search');
                    },
                  ),
                ],
              ),
            ),

            // Bottom Actions (Server config & Logout)
            const Divider(),
            ListTile(
              leading: const Icon(Icons.dns_outlined, color: AppColors.textSecondary),
              title: const Text('Server Configuration'),
              onTap: () {
                Navigator.pop(context);
                _showServerConfigDialog();
              },
            ),
            ListTile(
              leading: const Icon(Icons.logout, color: AppColors.danger),
              title: const Text('Sign Out', style: TextStyle(color: AppColors.danger, fontWeight: FontWeight.w600)),
              onTap: () {
                Navigator.pop(context);
                _handleLogout();
              },
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
      body: widget.child,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: selectedIndex,
        onTap: _onBottomNavTapped,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.dashboard_outlined),
            activeIcon: Icon(Icons.dashboard),
            label: 'Dashboard',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.people_outline),
            activeIcon: Icon(Icons.people),
            label: 'Leads',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.assignment_outlined),
            activeIcon: Icon(Icons.assignment),
            label: 'Tasks',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.work_outline),
            activeIcon: Icon(Icons.work),
            label: 'My Work',
          ),
        ],
      ),
    );
  }
}
