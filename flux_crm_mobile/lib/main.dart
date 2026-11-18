import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'app/app.dart';
import 'core/api/api_client.dart';
import 'core/auth/auth_controller.dart';
import 'core/storage/secure_storage_service.dart';
import 'services/crm_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize storage service
  final storageService = SecureStorageService();
  await storageService.init();

  // Initialize API client and CRM repository service
  final apiClient = ApiClient(storageService: storageService);
  final crmService = CrmService(apiClient);

  // Initialize Auth controller
  final authController = AuthController(
    apiClient: apiClient,
    storageService: storageService,
  );

  // Check existing session
  await authController.checkAuth();

  runApp(
    MultiProvider(
      providers: [
        Provider<SecureStorageService>.value(value: storageService),
        Provider<ApiClient>.value(value: apiClient),
        Provider<CrmService>.value(value: crmService),
        ChangeNotifierProvider<AuthController>.value(value: authController),
      ],
      child: const FluxCrmApp(),
    ),
  );
}
