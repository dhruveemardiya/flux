from django.urls import path
from .views import RoleCreateView, RoleListView,create_user,get_user,update_user,delete_user,login_user,logout_user
from .views import UserListAPIView,add_warehouse,warehouse_list,ProductListCreateView, add_product, get_all_products, bulk_toggle_product_status
from .views import update_product_warehouse, update_user_warehouse,upload_product_quantities,check_file_uploaded,get_stock_by_warehouse,update_stock
from .views import get_current_and_previous_stock,get_today_date,update_warehouse,get_warehouse_by_id,RoleDeleteView
from .views import update_product,delete_product,delete_warehouse,RoleCreateView,get_logged_in_user,ShowPrevDateSettingView
from .views import get_product_stock_overview,remove_product_column_or_stock, check_existing_upload,get_superadmins,create_superadmin
from .views import update_superadmin, delete_superadmin,get_selected_prev_date_stock,get_user_warehouses, RoleUpdateView,change_password
from django.urls import path
from .views import CompanyViewSet,report_dashboard,report_filters,StateSalesSummaryAPIView,AllTablesAPIView,SavedReportListCreateAPIView,SavedReportDetailAPIView
from rest_framework.routers import DefaultRouter
from .views import report_dropdowns,delete_products_bulk,static_reorder_report,sync_product_quantities
from .views import get_table_columns, add_customer, get_customers, customers_api, customer_detail_api, upload_customer_excel, get_duplicate_groups, handle_duplicate_action, city_autofill
from .views import campaigns_api, campaign_detail_api, campaign_leads_api, campaign_lead_detail_api, campaign_leads_bulk_api, campaign_lead_delete_api, campaign_lead_attempts_api, courier_names_api
from .views import product_names_api

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
    # Data Mapping / Customers
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
    path('courier-names/', courier_names_api, name='courier_names_api'),
    path('product-names/', product_names_api, name='product_names_api'),

    # Compatibility aliases used by the current frontend
    path('customers/columns/', get_table_columns, name='get_table_columns_compat'),
    path('customers/bulk_upload/', upload_customer_excel, name='upload_customer_excel_compat'),

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
    path('add_warehouse/',add_warehouse, name='add_warehouse'),
    path('get_warehouse/',warehouse_list),
    path('products/', ProductListCreateView.as_view(), name='product-list-create'),
    path('add_product/', add_product, name='add_product'),
    path('get_products/', get_all_products, name='get_all_products'),
    path('products/bulk-toggle-status/', bulk_toggle_product_status, name='bulk_toggle_product_status'),
    path('update_product_warehouse/', update_product_warehouse, name='update_product_warehouse'),
    path('update_user_warehouse/', update_user_warehouse, name='update_user_warehouse'),
    path('upload_product_quantities/', upload_product_quantities, name='upload_product_quantities'),
    path('check_file_uploaded/<str:date>/', check_file_uploaded, name='check_file_uploaded'),
    path('get_stock/',get_stock_by_warehouse,name="get_stock_by_warehouse"),
    path('update_stock/',update_stock,name='update_stock'),
    path('get_products_with_latest_stock/',get_current_and_previous_stock,name='get_products_with_latest_stock'),
    path('today/',get_today_date,name='get_today_date'),
    path('update_warehouse/<int:pk>/',update_warehouse),
    path('delete_warehouse/<int:pk>/',delete_warehouse),
    path('get_user_warehouses/', get_user_warehouses, name='get_user_warehouses'),

    path('get_warehouse/<int:id>/', get_warehouse_by_id, name='get_warehouse_by_id'),
    path('update_product/<int:pk>/', update_product),
    path('delete_product/<int:pk>/', delete_product),
    path('delete_product/', delete_products_bulk),

    path('users/me/',get_logged_in_user),
    path('show-prev-date/', ShowPrevDateSettingView.as_view(), name='show-prev-date'),
    path('get_product_stock_overview/', get_product_stock_overview, name='get_product_stock_overview'),
    path('remove_product_column/', remove_product_column_or_stock, name='remove_product_column'),
    path('check-file-exists/<str:date>/',check_existing_upload, name='check_existing_upload'),
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

    path("static-reorder-report/",static_reorder_report),
    path("sync_data/",sync_product_quantities),

]




