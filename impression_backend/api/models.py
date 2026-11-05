from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.db.models import JSONField

class Role(models.Model):
    role = models.CharField(max_length=100,unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'Role'  # Custom table name

    def __str__(self):
        return self.role

class UserManager(BaseUserManager):
    def create_user(self, username, password=None, **extra_fields):
        if not username:
            raise ValueError("Username is required")
        user = self.model(username=username, **extra_fields)
        user.set_password(password)  # hashes password
        user.save(using=self._db)
        return user

class User(AbstractBaseUser):
    username = models.CharField(max_length=150, unique=True)
    password = models.CharField(max_length=128)  # Explicitly defining password field
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    role = models.CharField(max_length=100)
    last_login = None  
    companies = models.ManyToManyField(
        'Company',
        blank=True,
        related_name='users'
    )
    created_by = models.ForeignKey(
    'self',
    null=True,
    blank=True,
    on_delete=models.SET_NULL,
    related_name='created_users'
)


    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "username"

    class Meta:
        db_table = 'Users'  

    def __str__(self):
        return self.username



from django.db import models
from django.utils import timezone
from django.conf import settings

class Warehouse(models.Model):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, null=True, blank=True)
    description = models.TextField()

    company = models.ForeignKey('Company', on_delete=models.CASCADE, related_name='warehouses')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_warehouses'
    )

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'warehouses'
        verbose_name = 'Warehouse'
        verbose_name_plural = 'Warehouses'
        unique_together = ('name', 'company')  # warehouse name must be unique within a company

    def __str__(self):
        return f"{self.name} ({self.company.name})"



from django.conf import settings
from django.db import models
from django.utils import timezone

class Product(models.Model):
    product_name = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    company = models.ForeignKey('Company', on_delete=models.CASCADE, related_name='products')

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_products'
    )

    warehouses = models.ManyToManyField(
        'Warehouse',
        through='ProductWarehouse',
        related_name='products'
    )

    class Meta:
        db_table = 'Product'
        unique_together = ('product_name', 'company')  # optional stricter uniqueness

    def __str__(self):
        return f"{self.product_name} ({self.company.name})"


    

class ProductWarehouse(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'product_warehouse'
        unique_together = ('product', 'warehouse')

# models.py  # Assuming you have this

User = get_user_model()

class UserWarehouse(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table='user_warehouse'
        unique_together = ('user', 'warehouse')


class ProductStock(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE)
    date = models.DateField()
    quantity = models.IntegerField(null=True, blank=True, default=0)
    company = models.ForeignKey('Company', on_delete=models.CASCADE, related_name='product_stocks')  # New field

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'product_stocks'
        unique_together = ('product', 'warehouse', 'date', 'company')  # Consider including company here for uniqueness?

    def __str__(self):
        prod_name = getattr(self.product, 'product_name', getattr(self.product, 'name', 'Product'))
        wh_name = getattr(self.warehouse, 'name', 'Warehouse') if self.warehouse else 'Warehouse'
        co_name = getattr(self.company, 'name', 'Company') if self.company else 'Company'
        return f"{prod_name} @ {wh_name} on {self.date} ({co_name})"

    


class ShowPrevDateSetting(models.Model):
    name = models.CharField(max_length=100, unique=True)
    show = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.name} - {'Shown' if self.show else 'Hidden'}"




class Permission(models.Model):
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=100, unique=True)  # e.g., 'edit_product'

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'permissions'

    def __str__(self):
        return self.name


class PermissionAssignment(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    role = models.ForeignKey(Role, on_delete=models.CASCADE, null=True, blank=True)
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE)
    allow = models.BooleanField(default=True)
    # Only one of `user` or `role` should be non-null per row
    class Meta:
        db_table = 'permission_assignments'
        unique_together = ('user', 'role', 'permission')  # Prevents duplicate assignments

    def __str__(self):
        if self.user:
            return f"{self.user.username} - {self.permission.name} (user-specific)"
        return f"{self.role.role} - {self.permission.name} (role-wide)"


class Company(models.Model):
    name = models.CharField(max_length=255, unique=True)
    location = models.CharField(max_length=255)
    logo = models.ImageField(upload_to='company_logos/', null=True, blank=True)


    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'companies'

    def __str__(self):
        return self.name


class Customer(models.Model):
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=50, null=True, blank=True)
    company_name = models.CharField(max_length=255, blank=True, default='')
    company_upload_name = models.TextField(blank=True, default='')
    docat = models.TextField(blank=True, default='')
    reviews = models.TextField(blank=True, default='')
    excel_name = models.CharField(max_length=255, blank=True, default='')
    file_uploaded_at = models.DateTimeField(null=True, blank=True)
    address_line1 = models.TextField(blank=True)
    address_line2 = models.TextField(blank=True)
    country = models.CharField(max_length=100, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    pincode = models.CharField(max_length=20, blank=True)
    company = models.ForeignKey('Company', on_delete=models.CASCADE, null=True, blank=True, related_name='customers')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_customers')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'api_customer'

    def __str__(self):
        return f"{self.first_name} {self.last_name}".strip()


class Campaign(models.Model):
    STATUS_DRAFT = 'Draft'
    STATUS_ACTIVE = 'Active'
    STATUS_CLOSED = 'Closed'

    STATUS_CHOICES = (
        (STATUS_DRAFT, 'Draft'),
        (STATUS_ACTIVE, 'Active'),
        (STATUS_CLOSED, 'Closed'),
    )

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    start_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    company = models.ForeignKey('Company', on_delete=models.CASCADE, related_name='campaigns')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_campaigns'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'campaigns'
        ordering = ['-id']
        unique_together = ('name', 'company')

    def __str__(self):
        return f"{self.name} ({self.company.name})"


class CampaignLead(models.Model):
    STATUS_PENDING = 'Pending'
    STATUS_DISPATCHED = 'Dispatched'
    STATUS_DELIVERED = 'Delivered'
    STATUS_FAILED = 'Failed'
    STATUS_RETURNED = 'Returned'

    STATUS_CHOICES = (
        (STATUS_PENDING, 'Pending'),
        (STATUS_DISPATCHED, 'Dispatched'),
        (STATUS_DELIVERED, 'Delivered'),
        (STATUS_FAILED, 'Failed'),
        (STATUS_RETURNED, 'Returned'),
    )

    CLIENT_STATUS_PENDING = 'Pending'
    CLIENT_STATUS_APPROVED = 'Approved'
    CLIENT_STATUS_REJECTED = 'Rejected'

    CLIENT_STATUS_CHOICES = (
        (CLIENT_STATUS_PENDING, 'Pending'),
        (CLIENT_STATUS_APPROVED, 'Approved'),
        (CLIENT_STATUS_REJECTED, 'Rejected'),
    )

    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name='leads')
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='campaign_leads')
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=50, null=True, blank=True)
    address_line1 = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    dispatch_date = models.DateField(null=True, blank=True)
    expected_delivery_date = models.DateField(null=True, blank=True)
    actual_delivery_date = models.DateField(null=True, blank=True)
    courier_name = models.CharField(max_length=255, blank=True)
    client_status = models.CharField(max_length=20, choices=CLIENT_STATUS_CHOICES, blank=True, default='')
    courier_status = models.CharField(max_length=20, choices=STATUS_CHOICES, blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    notes = models.TextField(blank=True)
    client_review = models.TextField(blank=True, default='')
    courier_description = models.TextField(blank=True, default='')
    products = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'campaign_leads'
        ordering = ['-id']
        unique_together = ('campaign', 'customer')

    def __str__(self):
        return f"{self.campaign.name} - {self.first_name} {self.last_name}".strip()
    

class CampaignLeadAttempt(models.Model):
    lead = models.ForeignKey(CampaignLead, on_delete=models.CASCADE, related_name='attempts')
    attempt_number = models.IntegerField(default=1)
    dispatch_date = models.DateField(null=True, blank=True)
    expected_delivery_date = models.DateField(null=True, blank=True)
    actual_delivery_date = models.DateField(null=True, blank=True)
    courier_name = models.CharField(max_length=255, blank=True)
    courier_status = models.CharField(max_length=50, blank=True)
    courier_description = models.TextField(blank=True, default='')
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'campaign_lead_attempts'
        ordering = ['attempt_number']
        unique_together = ('lead', 'attempt_number')

    def __str__(self):
        return f"Lead {self.lead_id} Attempt {self.attempt_number}"


class SavedReport(models.Model):
    name = models.CharField(max_length=255)
    row_header = models.CharField(max_length=100)
    column_header = models.CharField(max_length=100)
    filters = models.JSONField()  # store filters as JSON
    filter_values = models.JSONField(default=dict)
    row_values = models.JSONField(default=list)     # ✅ Selected values for row header
    column_values = models.JSONField(default=list) 
    created_at = models.DateTimeField(auto_now_add=True)
    hidden = models.BooleanField(default=False)


class Lead(models.Model):
    STATUS_LEAD = 'Lead'
    STATUS_HOSTLEAD = 'HostLead'
    STATUS_CONVERTED = 'Converted'

    STATUS_CHOICES = (
        (STATUS_LEAD, 'Lead'),
        (STATUS_HOSTLEAD, 'HostLead'),
        (STATUS_CONVERTED, 'Converted'),
    )

    company_name = models.CharField(max_length=255, blank=True, default='')
    first_name = models.CharField(max_length=150, blank=True, default='')
    last_name = models.CharField(max_length=150, blank=True, default='')
    email = models.CharField(max_length=255, blank=True, default='', db_index=True)
    secondary_email = models.CharField(max_length=255, blank=True, default='')
    phone = models.CharField(max_length=50, blank=True, default='', db_index=True)
    secondary_phone = models.CharField(max_length=50, blank=True, default='')
    mobile = models.CharField(max_length=50, blank=True, default='')
    secondary_mobile = models.CharField(max_length=50, blank=True, default='')
    address_line1 = models.TextField(blank=True, default='')
    address_line2 = models.TextField(blank=True, default='')
    city = models.CharField(max_length=100, blank=True, default='', db_index=True)
    state = models.CharField(max_length=100, blank=True, default='')
    country = models.CharField(max_length=100, blank=True, default='')
    pincode = models.CharField(max_length=20, blank=True, default='')
    website = models.CharField(max_length=255, blank=True, default='')
    segment = models.CharField(max_length=255, blank=True, default='')
    category = models.CharField(max_length=255, blank=True, default='')
    rating = models.CharField(max_length=50, blank=True, default='')
    notes = models.TextField(blank=True, default='')
    raw_data = models.JSONField(default=dict, blank=True)

    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default=STATUS_LEAD, db_index=True)
    status_updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='status_updated_leads')
    status_updated_at = models.DateTimeField(null=True, blank=True)

    company = models.ForeignKey('Company', on_delete=models.CASCADE, null=True, blank=True, related_name='leads')
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_leads', db_index=True)
    assigned_users = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        through='LeadAssignment',
        through_fields=('lead', 'user'),
        related_name='multi_assigned_leads',
        blank=True
    )
    assigned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='dispatched_leads')
    assigned_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_leads')
    excel_name = models.CharField(max_length=255, blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'lead'
        ordering = ['-id']

    def __str__(self):
        name = f"{self.first_name} {self.last_name}".strip()
        return name or self.company_name or f"Lead #{self.id}"


class LeadAssignment(models.Model):
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='assignments')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='lead_assignments')
    assigned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_lead_assignments')
    assigned_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'lead_assignments'
        unique_together = ('lead', 'user')
        ordering = ['-assigned_at']

    def __str__(self):
        return f"Lead #{self.lead_id} -> User #{self.user_id}"


class LeadAssignmentHistory(models.Model):
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='assignment_history')
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='lead_history_assigned')
    assigned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='lead_history_actor')
    assigned_at = models.DateTimeField(default=timezone.now)
    previous_assignee = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='lead_history_prev')
    notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'lead_assignment_history'
        ordering = ['-assigned_at']

    def __str__(self):
        assignee = self.assigned_to.username if self.assigned_to else "Unassigned"
        return f"Lead #{self.lead_id} -> {assignee} by {self.assigned_by}"


class LeadStatusHistory(models.Model):
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='status_history')
    old_status = models.CharField(max_length=30, blank=True, default='')
    new_status = models.CharField(max_length=30)
    changed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='lead_status_changes')
    changed_at = models.DateTimeField(default=timezone.now)
    notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'lead_status_history'
        ordering = ['-changed_at']

    def __str__(self):
        return f"Lead #{self.lead_id}: {self.old_status} -> {self.new_status}"


class LeadTask(models.Model):
    STATUS_PENDING = 'Pending'
    STATUS_COMPLETED = 'Completed'

    STATUS_CHOICES = (
        (STATUS_PENDING, 'Pending'),
        (STATUS_COMPLETED, 'Completed'),
    )

    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='tasks')
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='lead_tasks', db_index=True)
    description = models.TextField(blank=True, default='')
    assigned_date = models.DateField(default=timezone.now)
    next_followup_date = models.DateField(null=True, blank=True, db_index=True)
    reminder_date = models.DateField(null=True, blank=True, db_index=True)
    future_discussion = models.TextField(blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'lead_tasks'
        ordering = ['-id']

    def __str__(self):
        return f"Task #{self.id} for Lead #{self.lead_id} ({self.status})"

    def save(self, *args, **kwargs):
        # Automatically calculate reminder_date as 1 day before next_followup_date
        if self.next_followup_date:
            from datetime import timedelta, datetime, date
            if isinstance(self.next_followup_date, str):
                try:
                    self.next_followup_date = datetime.strptime(str(self.next_followup_date)[:10], '%Y-%m-%d').date()
                except Exception:
                    self.next_followup_date = None
            self.reminder_date = (self.next_followup_date - timedelta(days=1)) if self.next_followup_date else None
        else:
            self.reminder_date = None
        super().save(*args, **kwargs)


class TaskCallHistory(models.Model):
    INTERACTION_CALL = 'Call'
    INTERACTION_WHATSAPP = 'WhatsApp'
    INTERACTION_EMAIL = 'Email'

    INTERACTION_CHOICES = (
        (INTERACTION_CALL, 'Call'),
        (INTERACTION_WHATSAPP, 'WhatsApp'),
        (INTERACTION_EMAIL, 'Email'),
    )
    task = models.ForeignKey(LeadTask, on_delete=models.CASCADE, related_name='call_history')
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='task_call_history')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='recorded_task_calls')
    interaction_type = models.CharField(max_length=20, default=INTERACTION_CALL, choices=INTERACTION_CHOICES)
    call_date = models.DateField(default=timezone.now)
    discussion = models.TextField(blank=True, default='')
    next_followup_date = models.DateField(null=True, blank=True)
    future_discussion = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'task_call_history'
        ordering = ['-call_date', '-id']

    def __str__(self):
        return f"Call on {self.call_date} for Task #{self.task_id}"




class MobileDeviceToken(models.Model):
    PLATFORM_ANDROID = 'android'
    PLATFORM_IOS = 'ios'
    PLATFORM_WEB = 'web'

    PLATFORM_CHOICES = (
        (PLATFORM_ANDROID, 'Android'),
        (PLATFORM_IOS, 'iOS'),
        (PLATFORM_WEB, 'Web'),
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='device_tokens')
    token = models.CharField(max_length=255, db_index=True)
    platform = models.CharField(max_length=20, default=PLATFORM_ANDROID, choices=PLATFORM_CHOICES)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'mobile_device_tokens'
        unique_together = ('user', 'token')
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.user.username} ({self.platform}): {self.token[:20]}..."


class BlacklistedRefreshToken(models.Model):
    token_jti = models.CharField(max_length=64, db_index=True, unique=True)
    token = models.TextField(blank=True, default='')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='blacklisted_tokens', null=True, blank=True)
    blacklisted_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'blacklisted_refresh_tokens'
        ordering = ['-blacklisted_at']

    def __str__(self):
        return f"Blacklisted token {self.token_jti[:8]}... for {self.user}"
