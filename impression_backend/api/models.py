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
        return f"{self.product.name} @ {self.warehouse.name} on {self.date} ({self.company.name})"

    


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


from django.db import models
from django.contrib.postgres.fields import JSONField  # or use models.JSONField in Django 3.1+

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

