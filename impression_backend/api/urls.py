from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    RoleCreateView, RoleListView, create_user, get_user, update_user, delete_user,
    login_user, logout_user, UserListAPIView, add_warehouse, warehouse_list,
    ProductListCreateView, add_product, get_all_products, bulk_toggle_product_status,
    update_product_warehouse, update_user_warehouse, upload_product_quantities,
    check_file_uploaded, get_stock_by_warehouse, update_stock,
    get_current_and_previous_stock, get_today_date, update_warehouse, get_warehouse_by_id,
    RoleDeleteView, update_product, delete_product, delete_warehouse,
    get_logged_in_user, ShowPrevDateSettingView, get_product_stock_overview,
    remove_product_column_or_stock, check_existing_upload, get_superadmins,
    create_superadmin, update_superadmin, delete_superadmin,
    get_selected_prev_date_stock, get_user_warehouses, RoleUpdateView, change_password,
    CompanyViewSet, report_dashboard, report_filters, StateSalesSummaryAPIView,
    AllTablesAPIView, SavedReportListCreateAPIView, SavedReportDetailAPIView,
    report_dropdowns, delete_products_bulk, static_reorder_report, sync_product_quantities,
    get_table_columns, add_customer, get_customers, customers_api, customer_detail_api,
    upload_customer_excel, get_duplicate_groups, handle_duplicate_action, city_autofill,
    campaigns_api, campaign_detail_api, campaign_leads_api, campaign_lead_detail_api,
    campaign_leads_bulk_api, campaign_lead_delete_api, campaign_lead_attempts_api,
    courier_names_api, product_names_api
)

from .auth_views import (
    auth_token_obtain_api, auth_token_refresh_api,
    auth_user_me_api, auth_logout_api
)
from .notification_views import notification_device_token_api
from .lead_views import (
    leads_list_create_api, lead_detail_api, lead_status_update_api,
    lead_bulk_status_api, lead_bulk_assign_api, lead_upload_parse_or_import_api,
    lead_filters_options_api, lead_assignments_api, lead_assignment_remove_user_api,
    lead_interactions_360_api
)
from .task_views import (
    tasks_list_create_api, task_detail_api, task_record_call_api,
    task_status_toggle_api, task_available_leads_api, task_notifications_api,
    task_notification_mark_read_api,
    task_communication_history_api, task_activities_api, task_assignable_users_api
)
from .segment_views import (
    segments_list_create_api, segment_detail_api
)
from .crm_views import (
    crm_users_api, crm_user_detail_api, crm_roles_api, crm_role_detail_api,
    crm_permissions_get_api, crm_permissions_save_api,
    crm_access_requests_api, crm_access_request_decision_api,
    crm_access_request_approve_api, crm_access_request_reject_api, crm_access_logs_api,
    crm_segments_api, crm_segment_detail_api, crm_segment_safe_delete_api,
    crm_lead_assignments_list_api, crm_lead_assign_execute_api, crm_lead_unassign_execute_api,
    crm_assignment_detail_api, crm_lead_reassign_execute_api,
    crm_task_groups_api, crm_task_group_detail_api, crm_task_group_assign_api, crm_task_group_associate_leads_api,
    crm_my_work_api, crm_my_work_activities_api, crm_my_work_activity_detail_api, crm_my_work_followups_api,
    crm_activity_update_api,
    crm_performance_reports_api, crm_reports_staff_api, crm_reports_task_groups_api, crm_reports_segments_api, crm_reports_export_api,
    crm_quick_search_api, crm_lead_timeline_api, crm_lead_communications_api,
    crm_dashboard_summary_api,
    crm_leads_api, crm_lead_detail_api, crm_leads_search_api,
    crm_lead_import_upload_api, crm_lead_import_validate_duplicates_api, crm_lead_import_commit_api,
    crm_lead_import_preview_api, crm_lead_import_failed_rows_api, crm_import_history_api
)

company_list = CompanyViewSet.as_view({
    'get': 'list',
    'post': 'create'
})

company_detail = CompanyViewSet.as_view({
    'get': 'retrieve',
    'put': 'update',
    'patch': 'partial_update',
    'delete': 'destroy'
})

urlpatterns = [
    # -------------------------------------------------------------
    # Section 1: Authentication & Session APIs (JWT & RBAC)
    # -------------------------------------------------------------
    path('auth/token/', auth_token_obtain_api, name='auth_token_obtain_api'),
    path('auth/token/refresh/', auth_token_refresh_api, name='auth_token_refresh_api'),
    path('auth/me/', auth_user_me_api, name='auth_user_me_api'),
    path('auth/logout/', auth_logout_api, name='auth_logout_api'),

    # -------------------------------------------------------------
    # Section 2 & 3: Lead Generation & Multiple-User Assignment
    # -------------------------------------------------------------
    path('leads/', leads_list_create_api, name='leads_list_create_api'),
    path('leads/filters/', lead_filters_options_api, name='lead_filters_options_api'),
    path('leads/filters-options/', lead_filters_options_api, name='lead_filters_options_compat'),
    path('leads/assign/', lead_bulk_assign_api, name='lead_bulk_assign_api'),
    path('leads/bulk-status/', lead_bulk_status_api, name='lead_bulk_status_api'),
    path('leads/upload/', lead_upload_parse_or_import_api, name='lead_upload_parse_or_import_api'),
    path('leads/<int:lead_id>/', lead_detail_api, name='lead_detail_api'),
    path('leads/<int:lead_id>/status/', lead_status_update_api, name='lead_status_update_api'),
    path('leads/<int:lead_id>/assignments/', lead_assignments_api, name='lead_assignments_api'),
    path('leads/<int:lead_id>/assignments/<int:user_id>/', lead_assignment_remove_user_api, name='lead_assignment_remove_user_api'),
    path('leads/<int:lead_id>/interactions/', lead_interactions_360_api, name='lead_interactions_360_api'),

    # -------------------------------------------------------------
    # Section 4 & 5: Task Manager & Lead Communication History
    # -------------------------------------------------------------
    path('tasks/', tasks_list_create_api, name='tasks_list_create_api'),
    path('tasks/available-leads/', task_available_leads_api, name='task_available_leads_api'),
    path('tasks/notifications/', task_notifications_api, name='task_notifications_api'),
    path('tasks/notifications/read/', task_notification_mark_read_api, name='task_notification_mark_read_api'),
    path('tasks/notifications/<int:notification_id>/read/', task_notification_mark_read_api, name='task_notification_detail_read_api'),
    path('tasks/<int:task_id>/', task_detail_api, name='task_detail_api'),
    path('tasks/<int:task_id>/calls/', task_record_call_api, name='task_record_call_api'),
    path('tasks/assignable-users/', task_assignable_users_api, name='task_assignable_users_api'),
    path('tasks/<int:task_id>/history/', task_communication_history_api, name='task_communication_history_api'),
    path('tasks/<int:task_id>/activities/', task_activities_api, name='task_activities_api'),
    path('tasks/<int:task_id>/status/', task_status_toggle_api, name='task_status_toggle_api'),

    # -------------------------------------------------------------
    # Section 6: Reminders & Mobile Push Notifications
    # -------------------------------------------------------------
    path('notifications/device-token/', notification_device_token_api, name='notification_device_token_api'),

    # -------------------------------------------------------------
    # Data Mapping / Customers / Campaigns
    # -------------------------------------------------------------
    path('customers/', customers_api, name='customers_api'),
    path('customers/<int:customer_id>/', customer_detail_api, name='customer_detail_api'),
    path('customers/list/', get_customers, name='get_customers'),
    path('customers/add/', add_customer, name='add_customer'),
    path('customers/upload-excel/', upload_customer_excel, name='upload_customer_excel'),
    path('customers/table-columns/', get_table_columns, name='get_table_columns'),
    path('customers/duplicates/', get_duplicate_groups, name='get_duplicate_groups'),
    path('customers/handle-duplicate/', handle_duplicate_action, name='handle_duplicate_action'),
    path('city-autofill/', city_autofill, name='city_autofill'),
    path('campaigns/', campaigns_api, name='campaigns_api'),
    path('campaigns/<int:campaign_id>/', campaign_detail_api, name='campaign_detail_api'),
    path('campaigns/<int:campaign_id>/leads/', campaign_leads_api, name='campaign_leads_api'),
    path('campaigns/<int:campaign_id>/leads/bulk/', campaign_leads_bulk_api, name='campaign_leads_bulk_api'),
    path('campaigns/<int:campaign_id>/leads/<int:lead_id>/', campaign_lead_detail_api, name='campaign_lead_detail_api'),
    path('campaigns/<int:campaign_id>/leads/<int:lead_id>/delete/', campaign_lead_delete_api, name='campaign_lead_delete_api'),
    path('campaigns/<int:campaign_id>/leads/<int:lead_id>/attempts/', campaign_lead_attempts_api, name='campaign_lead_attempts_api'),
    path('segments/', segments_list_create_api, name='segments_list_create_api'),
    path('segments/<int:segment_id>/', segment_detail_api, name='segment_detail_api'),
    path('courier-names/', courier_names_api, name='courier_names_api'),
    path('product-names/', product_names_api, name='product_names_api'),

    # Compatibility aliases
    path('customers/columns/', get_table_columns, name='get_table_columns_compat'),
    path('customers/bulk_upload/', upload_customer_excel, name='upload_customer_excel_compat'),

    # -------------------------------------------------------------
    # Existing CRM Administration & Inventory Endpoints
    # -------------------------------------------------------------
    path('roles/create/', RoleCreateView.as_view()),
    path('roles/get/', RoleListView.as_view()),
    path('roles/update/<int:pk>/', RoleUpdateView.as_view(), name='role-update'),
    path('roles/delete/<int:pk>/', RoleDeleteView.as_view(), name='role-delete'),
    path('users/create/', create_user),
    path('users/<int:user_id>/', get_user),
    path('users/<int:user_id>/update/', update_user),
    path('users/<int:user_id>/delete/', delete_user),
    path('login/', login_user),
    path('logout/', logout_user),
    path('users/', UserListAPIView.as_view(), name='user-list'),
    path('add_warehouse/', add_warehouse, name='add_warehouse'),
    path('get_warehouse/', warehouse_list),
    path('products/', ProductListCreateView.as_view(), name='product-list-create'),
    path('add_product/', add_product, name='add_product'),
    path('get_products/', get_all_products, name='get_all_products'),
    path('products/bulk-toggle-status/', bulk_toggle_product_status, name='bulk_toggle_product_status'),
    path('update_product_warehouse/', update_product_warehouse, name='update_product_warehouse'),
    path('update_user_warehouse/', update_user_warehouse, name='update_user_warehouse'),
    path('upload_product_quantities/', upload_product_quantities, name='upload_product_quantities'),
    path('check_file_uploaded/<str:date>/', check_file_uploaded, name='check_file_uploaded'),
    path('get_stock/', get_stock_by_warehouse, name="get_stock_by_warehouse"),
    path('update_stock/', update_stock, name='update_stock'),
    path('get_products_with_latest_stock/', get_current_and_previous_stock, name='get_products_with_latest_stock'),
    path('today/', get_today_date, name='get_today_date'),
    path('update_warehouse/<int:pk>/', update_warehouse),
    path('delete_warehouse/<int:pk>/', delete_warehouse),
    path('get_user_warehouses/', get_user_warehouses, name='get_user_warehouses'),

    path('get_warehouse/<int:id>/', get_warehouse_by_id, name='get_warehouse_by_id'),
    path('update_product/<int:pk>/', update_product),
    path('delete_product/<int:pk>/', delete_product),
    path('delete_product/', delete_products_bulk),

    path('users/me/', get_logged_in_user),
    path('show-prev-date/', ShowPrevDateSettingView.as_view(), name='show-prev-date'),
    path('get_product_stock_overview/', get_product_stock_overview, name='get_product_stock_overview'),
    path('remove_product_column/', remove_product_column_or_stock, name='remove_product_column'),
    path('check-file-exists/<str:date>/', check_existing_upload, name='check_existing_upload'),
    path('superadmins/', get_superadmins),
    path('superadmins/create/', create_superadmin),
    path('superadmins/<int:user_id>/update/', update_superadmin),
    path('superadmins/<int:user_id>/delete/', delete_superadmin),
    path('get_selected_prev_date_stock/', get_selected_prev_date_stock, name='get_selected_prev_date_stock'),
    path('users/change-password/', change_password),
    path('companies/', company_list, name='company-list-create'),
    path('companies/<int:pk>/', company_detail, name='company-detail'),
    path("reports/data/", report_dashboard),
    path("filters/", report_filters),
    path("sales/summary-by-state/", StateSalesSummaryAPIView.as_view(), name="summary-by-state"),
    path('tables/', AllTablesAPIView.as_view()),
    path("reports/", SavedReportListCreateAPIView.as_view(), name="report-list"),
    path("reports/<int:pk>/", SavedReportDetailAPIView.as_view(), name="report-detail"),
    path("reports/<int:id>/data/", report_dashboard, name="report_dashboard_with_id"),
    path('report-dropdowns', report_dropdowns),

    path("static-reorder-report/", static_reorder_report),
    path("sync_data/", sync_product_quantities),

    # -------------------------------------------------------------
    # Custom CRM Endpoints (Inside Lead Generation Module)
    # -------------------------------------------------------------
    path('crm/dashboard/summary/', crm_dashboard_summary_api, name='crm_dashboard_summary_api'),

    # User & Role Management (Part 4)
    path('crm/users/', crm_users_api, name='crm_users_api'),
    path('crm/users/<int:user_id>/', crm_user_detail_api, name='crm_user_detail_api'),
    path('crm/roles/', crm_roles_api, name='crm_roles_api'),
    path('crm/roles/<int:role_id>/', crm_role_detail_api, name='crm_role_detail_api'),
    path('crm/permissions/', crm_permissions_get_api, name='crm_permissions_get_api'),
    path('crm/permissions/save/', crm_permissions_save_api, name='crm_permissions_save_api'),

    # CRM Access Approval & Access Logs (Part 5)
    path('crm/access-requests/', crm_access_requests_api, name='crm_access_requests_api'),
    path('crm/access-requests/<int:request_id>/decision/', crm_access_request_decision_api, name='crm_access_request_decision_api'),
    path('crm/access-requests/<int:request_id>/approve/', crm_access_request_approve_api, name='crm_access_request_approve_api'),
    path('crm/access-requests/<int:request_id>/reject/', crm_access_request_reject_api, name='crm_access_request_reject_api'),
    path('crm/access-logs/', crm_access_logs_api, name='crm_access_logs_api'),

    # Segment Management (Part 6)
    path('crm/segments/', crm_segments_api, name='crm_segments_api'),
    path('crm/segments/<int:segment_id>/', crm_segment_detail_api, name='crm_segment_detail_api'),
    path('crm/segments/<int:segment_id>/safe-delete/', crm_segment_safe_delete_api, name='crm_segment_safe_delete_api'),

    # Lead Management (Part 7)
    path('crm/leads/', crm_leads_api, name='crm_leads_api'),
    path('crm/leads/search/', crm_leads_search_api, name='crm_leads_search_api'),
    path('crm/leads/<int:lead_id>/', crm_lead_detail_api, name='crm_lead_detail_api'),

    # Advanced Excel / CSV Import (Part 8)
    path('crm/leads/import/upload/', crm_lead_import_upload_api, name='crm_lead_import_upload_api'),
    path('crm/leads/import/validate/', crm_lead_import_validate_duplicates_api, name='crm_lead_import_validate_duplicates_api'),
    path('crm/leads/import/commit/', crm_lead_import_commit_api, name='crm_lead_import_commit_api'),
    path('crm/leads/import/<int:job_id>/commit/', crm_lead_import_commit_api, name='crm_lead_import_commit_job_api'),
    path('crm/leads/import/<int:job_id>/preview/', crm_lead_import_preview_api, name='crm_lead_import_preview_api'),
    path('crm/leads/import/<int:job_id>/failed-rows/', crm_lead_import_failed_rows_api, name='crm_lead_import_failed_rows_api'),
    path('crm/leads/import/history/', crm_import_history_api, name='crm_import_history_api'),

    # Lead Assignment (Part 9)
    path('crm/assignments/', crm_lead_assignments_list_api, name='crm_lead_assignments_list_api'),
    path('crm/assignments/<int:assignment_id>/', crm_assignment_detail_api, name='crm_assignment_detail_api'),
    path('crm/assignments/assign/', crm_lead_assign_execute_api, name='crm_lead_assign_execute_api'),
    path('crm/assignments/reassign/', crm_lead_reassign_execute_api, name='crm_lead_reassign_execute_api'),
    path('crm/assignments/unassign/', crm_lead_unassign_execute_api, name='crm_lead_unassign_execute_api'),

    # Task Management (Part 10)
    path('crm/task-groups/', crm_task_groups_api, name='crm_task_groups_api'),
    path('crm/task-groups/<int:task_group_id>/', crm_task_group_detail_api, name='crm_task_group_detail_api'),
    path('crm/task-groups/<int:task_group_id>/assign/', crm_task_group_assign_api, name='crm_task_group_assign_api'),
    path('crm/task-groups/<int:task_group_id>/associate-leads/', crm_task_group_associate_leads_api, name='crm_task_group_associate_leads_api'),

    # My Work Dashboard (Part 11)
    path('crm/my-work/', crm_my_work_api, name='crm_my_work_api'),
    path('crm/my-work/activities/', crm_my_work_activities_api, name='crm_my_work_activities_api'),
    path('crm/my-work/activities/<int:activity_id>/', crm_my_work_activity_detail_api, name='crm_my_work_activity_detail_api'),
    path('crm/my-work/activities/<int:activity_id>/update/', crm_activity_update_api, name='crm_activity_update_api'),
    path('crm/my-work/follow-ups/', crm_my_work_followups_api, name='crm_my_work_followups_api'),

    # Performance Reports (Part 12)
    path('crm/reports/performance/', crm_performance_reports_api, name='crm_performance_reports_api'),
    path('crm/reports/staff/', crm_reports_staff_api, name='crm_reports_staff_api'),
    path('crm/reports/task-groups/', crm_reports_task_groups_api, name='crm_reports_task_groups_api'),
    path('crm/reports/segments/', crm_reports_segments_api, name='crm_reports_segments_api'),
    path('crm/reports/export/', crm_reports_export_api, name='crm_reports_export_api'),

    # Quick Lead Search & Communication Timeline (Part 13)
    path('crm/quick-search/', crm_quick_search_api, name='crm_quick_search_api'),
    path('crm/leads/<int:lead_id>/timeline/', crm_lead_timeline_api, name='crm_lead_timeline_api'),
    path('crm/leads/<int:lead_id>/communications/', crm_lead_communications_api, name='crm_lead_communications_api'),
]
