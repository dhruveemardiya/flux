import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../core/auth/auth_controller.dart';
import '../core/constants/app_constants.dart';
import '../core/theme/app_theme.dart';
import 'routes.dart';

/// Root application widget configuring Theme and GoRouter navigation.
class FluxCrmApp extends StatefulWidget {
  const FluxCrmApp({Key? key}) : super(key: key);

  @override
  State<FluxCrmApp> createState() => _FluxCrmAppState();
}

class _FluxCrmAppState extends State<FluxCrmApp> {
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    final authController = context.read<AuthController>();
    _router = createRouter(authController);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: AppConstants.appName,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      routerConfig: _router,
    );
  }
}
