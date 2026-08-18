from django.contrib import admin
from .models import Campaign, CampaignLead, Customer


@admin.register(Campaign)
class CampaignAdmin(admin.ModelAdmin):
	list_display = ('id', 'name', 'company', 'start_date', 'status', 'created_at')
	list_filter = ('status', 'company')
	search_fields = ('name', 'description')


@admin.register(CampaignLead)
class CampaignLeadAdmin(admin.ModelAdmin):
	list_display = ('id', 'campaign', 'customer', 'status', 'dispatch_date', 'expected_delivery_date', 'actual_delivery_date', 'courier_name')
	list_filter = ('status', 'campaign')
	search_fields = ('first_name', 'last_name', 'phone', 'courier_name', 'courier_description')


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
	list_display = ('id', 'first_name', 'last_name', 'company_upload_name', 'excel_name', 'file_uploaded_at', 'phone', 'company', 'created_at')
	list_filter = ('company',)
	search_fields = ('first_name', 'last_name', 'company_upload_name', 'excel_name', 'phone')
