import 'package:flutter/material.dart';

/// Centralized color palette for Flux CRM enterprise design system.
class AppColors {
  // Primary & Secondary Brand Colors
  static const Color primary = Color(0xFF1D4ED8);       // Royal Blue
  static const Color primaryDark = Color(0xFF1E40AF);   // Dark Blue
  static const Color primaryLight = Color(0xFF60A5FA);  // Light Blue
  static const Color secondary = Color(0xFF0F172A);     // Slate 900
  static const Color accent = Color(0xFF0284C7);        // Ocean Teal

  // Background & Surface
  static const Color background = Color(0xFFF8FAFC);    // Slate 50
  static const Color surface = Color(0xFFFFFFFF);       // White
  static const Color cardBg = Color(0xFFFFFFFF);
  static const Color divider = Color(0xFFE2E8F0);       // Slate 200

  // Text Colors
  static const Color textPrimary = Color(0xFF0F172A);   // Slate 900
  static const Color textSecondary = Color(0xFF475569); // Slate 600
  static const Color textMuted = Color(0xFF94A3B8);     // Slate 400
  static const Color textWhite = Color(0xFFFFFFFF);

  // Status & Severity Colors
  static const Color success = Color(0xFF16A34A);       // Emerald Green
  static const Color successBg = Color(0xFFDCFCE7);
  static const Color warning = Color(0xFFD97706);       // Amber
  static const Color warningBg = Color(0xFFFEF3C7);
  static const Color danger = Color(0xFFDC2626);        // Crimson Red
  static const Color dangerBg = Color(0xFFFEE2E2);
  static const Color info = Color(0xFF0284C7);          // Cyan
  static const Color infoBg = Color(0xFFE0F2FE);

  // Status-specific colors
  static Color statusColor(String? status) {
    switch (status?.toLowerCase()) {
      case 'won':
      case 'completed':
      case 'qualified':
        return success;
      case 'in_progress':
      case 'negotiation':
      case 'proposal_sent':
        return warning;
      case 'lost':
      case 'cancelled':
        return danger;
      case 'contacted':
        return info;
      case 'new':
      case 'pending':
      default:
        return const Color(0xFF64748B); // Slate 500
    }
  }

  static Color statusBgColor(String? status) {
    switch (status?.toLowerCase()) {
      case 'won':
      case 'completed':
      case 'qualified':
        return successBg;
      case 'in_progress':
      case 'negotiation':
      case 'proposal_sent':
        return warningBg;
      case 'lost':
      case 'cancelled':
        return dangerBg;
      case 'contacted':
        return infoBg;
      case 'new':
      case 'pending':
      default:
        return const Color(0xFFF1F5F9);
    }
  }

  static Color priorityColor(String? priority) {
    switch (priority?.toLowerCase()) {
      case 'urgent':
      case 'critical':
      case 'high':
        return danger;
      case 'medium':
        return warning;
      case 'low':
      default:
        return const Color(0xFF64748B);
    }
  }
}
