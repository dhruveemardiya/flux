# views.py
from rest_framework import generics
from .models import Role, User
from .serializers import RoleSerializer, UserSerializer
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import authenticate
from .models import User ,ProductWarehouse # Import your User model
from .serializers import UserSerializer  # Your serializer for the User model
from rest_framework.views import APIView
from django.http import JsonResponse
from rest_framework.decorators import api_view
from .models import Warehouse, Product, UserWarehouse
from .serializers import WarehouseSerializer,ProductSerializer
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
import json
import re
from collections import defaultdict
from django.db import IntegrityError
from django.contrib.auth import get_user_model
from datetime import datetime
from django.db import connection
from rest_framework import serializers
from .product_utils import (
    normalize_product_name,
    find_product_by_normalized_name,
    get_or_create_normalized_product,
)
import requests
import unicodedata
import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from rest_framework.permissions import BasePermission
from django.db.models import Count, Q
from .models import Company, Customer, Campaign, CampaignLead
from .serializers import CampaignSerializer, CampaignLeadSerializer
from .models import CampaignLeadAttempt
from .serializers import CampaignLeadAttemptSerializer

CUSTOMER_TABLE_NAME = 'api_customer'
CUSTOMER_FIELD_ALIASES = {
    'phone_number': 'phone',
    'address_line_1': 'address_line1',
    'address_line_2': 'address_line1',
    'party_name': 'company_upload_name',
    'company_name': 'company_upload_name',
}


def _normalize_text(value):
    return '' if value is None else str(value).strip()


def _normalize_for_comparison(value):
    """Lowercase, strip, remove extra spaces, normalize unicode."""
    if value is None:
        return ''
    value = str(value).strip().lower()
    value = unicodedata.normalize('NFKD', value)
    value = ' '.join(value.split())
    return value


def _normalize_name(value):
    """Sort name tokens so 'Priya Sharma' == 'Sharma Priya'."""
    normalized = _normalize_for_comparison(value)
    tokens = sorted(normalized.split())
    return ' '.join(tokens)


def _extract_phones(raw_phone):
    if not raw_phone:
        return set()

    result = set()
    parts = re.split(r'[,;/]+', str(raw_phone))
    for part in parts:
        part = part.strip()
        if not part or re.search(r'[a-zA-Z]', part):
            continue

        digits = re.sub(r'\D', '', part)
        if len(digits) == 12 and digits.startswith('91'):
            digits = digits[2:]
        elif len(digits) == 11 and digits.startswith('1'):
            digits = digits[1:]

        if len(digits) == 10:
            result.add(digits)

    return result


def _normalize_phone_field(raw_phone):
    phones = _extract_phones(raw_phone)
    return ', '.join(sorted(phones)) if phones else ''


def _extract_name_group(row):
    names = set()
    for field in ('company_upload_name', 'first_name', 'last_name'):
        value = _normalize_for_comparison(row.get(field, ''))
        if value:
            names.add(value)
    return names


def _extract_address_group(row):
    address_line1 = _normalize_text(row.get('address_line1') or '').strip().lower()
    return address_line1


def _rows_are_duplicates(a, b):
    """
    Flexible duplicate detection — works even when fields are missing.

    Scoring system:
      Each signal that is present AND matches scores 1 point.
      Each signal that is present but does NOT match scores -1 (conflict).
      Missing signals score 0 (no evidence either way).

    Decision:
      - 2+ matching signals                          → duplicate
      - 1 matching signal + 0 conflicts              → duplicate (only signal available)
      - 1 matching signal + 1 conflict               → NOT duplicate (contradiction)
      - 0 matching signals                           → NOT duplicate
      - Any signal actively conflicts (mismatch)
        while another matches → NOT duplicate
    """
    a_names = _extract_name_group(a)
    b_names = _extract_name_group(b)
    a_address = _extract_address_group(a)
    b_address = _extract_address_group(b)
    a_phones = _extract_phones(a.get('phone') or a.get('phone_number', ''))
    b_phones = _extract_phones(b.get('phone') or b.get('phone_number', ''))

    has_name = bool(a_names and b_names)
    has_address = bool(a_address and b_address)
    has_phone = bool(a_phones and b_phones)

    # No signals at all — cannot determine
    if not has_name and not has_address and not has_phone:
        return False

    name_match = has_name and bool(a_names.intersection(b_names))
    address_match = has_address and (a_address == b_address)
    phone_match = has_phone and bool(a_phones.intersection(b_phones))

    # Count matches and conflicts among available signals only
    matches = sum([name_match, address_match, phone_match])
    conflicts = sum([
        has_name and not name_match,
        has_address and not address_match,
        has_phone and not phone_match,
    ])

    # Any active conflict cancels the match — e.g. same name but different phone
    # means they are likely different people, not duplicates
    if conflicts > 0 and matches <= 1:
        return False

    # Strong conflict: 2+ signals present and majority conflict
    if conflicts >= matches:
        return False

    # 2 or more signals match → definitely duplicate
    if matches >= 2:
        return True

    # Only 1 signal available and it matches → duplicate
    checkable = sum([has_name, has_address, has_phone])
    if checkable == 1 and matches == 1:
        return True

    return False


def _is_duplicate_customer(company_id, customer_data):
    """
    Check if a customer is duplicate by comparing party name, phone, and address.
    Case-insensitive, order-insensitive for names.
    Returns the matching customer or None.
    """
    candidates = Customer.objects.filter(company_id=company_id)

    incoming_phone = _extract_phones(customer_data.get('phone', ''))
    incoming_names = _extract_name_group(customer_data)
    incoming_address = _extract_address_group(customer_data)

    for c in candidates:
        db_phone = _extract_phones(c.phone)
        db_names = _extract_name_group({
            'company_upload_name': getattr(c, 'company_upload_name', '') or '',
            'first_name': c.first_name or '',
            'last_name': c.last_name or '',
        })
        db_address = _extract_address_group({
            'address_line1': c.address_line1 or '',
        })

        if _rows_are_duplicates({
            'company_upload_name': customer_data.get('company_upload_name', ''),
            'first_name': customer_data.get('first_name', ''),
            'last_name': customer_data.get('last_name', ''),
            'phone': _normalize_phone_field(customer_data.get('phone', '')),
            'address_line1': customer_data.get('address_line1', ''),
            'address_line2': customer_data.get('address_line2', ''),
        }, {
            'company_upload_name': getattr(c, 'company_upload_name', '') or '',
            'first_name': c.first_name or '',
            'last_name': c.last_name or '',
            'phone': _normalize_phone_field(c.phone),
            'address_line1': c.address_line1 or '',
        }):
            return c

    return None


def _normalize_customer_payload(data):
    return {
        'first_name': _normalize_text(data.get('first_name')),
        'last_name': _normalize_text(data.get('last_name')),
        'phone': _normalize_text(data.get('phone') or data.get('phone_number')),
        'company_upload_name': _normalize_text(data.get('company_upload_name') or data.get('party_name') or data.get('company_name')),
        'address_line1': _normalize_text(data.get('address_line1') or data.get('address_line_1')),
        'country': _normalize_text(data.get('country')),
        'city': _normalize_text(data.get('city')),
        'state': _normalize_text(data.get('state')),
        'pincode': _normalize_text(data.get('pincode')),
    }


def _find_existing_customer(customer_data):
    """
    Find an existing customer using whatever signals are available.
    No single field is required — works with any combination of phone/name/address.
    """
    phone = _normalize_phone_field(
        customer_data.get('phone', '') or customer_data.get('phone_number', '')
    )
    lookup_row = {
        'company_upload_name': customer_data.get('company_upload_name', ''),
        'first_name': customer_data.get('first_name', ''),
        'last_name': customer_data.get('last_name', ''),
        'phone': phone,
        'address_line1': customer_data.get('address_line1', '') or customer_data.get('address_line_1', ''),
    }

    candidates = []
    seen_ids = set()

    # Strategy 1: match candidates by phone
    if phone:
        phone_query = Q()
        for extracted_phone in _extract_phones(phone):
            phone_query |= Q(phone__icontains=extracted_phone)
        for candidate in Customer.objects.filter(phone_query):
            if candidate.id not in seen_ids:
                seen_ids.add(candidate.id)
                candidates.append(candidate)

    # Strategy 2: match candidates by name
    name_group = _extract_name_group(lookup_row)
    if name_group:
        name_query = Q()
        for name in name_group:
            name_query |= (
                Q(company_upload_name__iexact=name) |
                Q(first_name__iexact=name) |
                Q(last_name__iexact=name)
            )
        for candidate in Customer.objects.filter(name_query):
            if candidate.id not in seen_ids:
                seen_ids.add(candidate.id)
                candidates.append(candidate)

    # Strategy 3: match candidates by address (if no phone and no name)
    address = _extract_address_group(lookup_row)
    if address and not phone and not name_group:
        for candidate in Customer.objects.filter(address_line1__iexact=address):
            if candidate.id not in seen_ids:
                seen_ids.add(candidate.id)
                candidates.append(candidate)

    for candidate in candidates:
        candidate_row = {
            'company_upload_name': candidate.company_upload_name or '',
            'first_name': candidate.first_name or '',
            'last_name': candidate.last_name or '',
            'phone': _normalize_phone_field(candidate.phone or ''),
            'address_line1': candidate.address_line1 or '',
        }
        if _rows_are_duplicates(lookup_row, candidate_row):
            return candidate

    return None


def _resolve_customer_company_id(user, company_id=None):
    user_role = (getattr(user, 'role', '') or '').strip().lower()

    if not getattr(user, 'is_authenticated', False):
        return None, Response({'error': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)

    if company_id not in (None, ''):
        try:
            company_id = int(company_id)
        except (TypeError, ValueError):
            return None, Response({'error': 'Invalid company_id.'}, status=status.HTTP_400_BAD_REQUEST)

        if user_role != 'techadmin' and not user.companies.filter(id=company_id).exists():
            return None, Response({'error': 'Unauthorized company.'}, status=status.HTTP_403_FORBIDDEN)

        return company_id, None

    company = user.companies.first()
    if not company:
        return None, Response({'error': 'No company associated with user.'}, status=status.HTTP_400_BAD_REQUEST)

    return company.id, None


def _customer_queryset_for_user(user, company_id=None):
    user_role = (getattr(user, 'role', '') or '').strip().lower()

    if not getattr(user, 'is_authenticated', False):
        return Customer.objects.none()

    companies_manager = getattr(user, 'companies', None)
    if companies_manager is None:
        return Customer.objects.none()

    if user_role == 'techadmin':
        queryset = Customer.objects.all()
        if company_id not in (None, ''):
            queryset = queryset.filter(company_id=company_id)
        return queryset

    company_ids = list(companies_manager.values_list('id', flat=True))
    if not company_ids:
        return Customer.objects.none()

    if company_id not in (None, ''):
        try:
            company_id = int(company_id)
        except (TypeError, ValueError):
            return Customer.objects.none()

        if company_id not in company_ids:
            return Customer.objects.none()

        company_ids = [company_id]

    return Customer.objects.filter(company_id__in=company_ids)


def _customer_table_columns(table_name=CUSTOMER_TABLE_NAME):
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = %s
            ORDER BY ORDINAL_POSITION
            """,
            [table_name],
        )
        return [row[0] for row in cursor.fetchall()]


def _campaign_queryset_for_user(user, company_id=None):
    if not getattr(user, 'is_authenticated', False):
        return Campaign.objects.none()

    user_role = (getattr(user, 'role', '') or '').strip().lower()
    queryset = Campaign.objects.all()

    if user_role == 'techadmin':
        if company_id in (None, ''):
            return queryset
        try:
            return queryset.filter(company_id=int(company_id))
        except (TypeError, ValueError):
            return Campaign.objects.none()

    company_ids = list(getattr(user, 'companies', None).values_list('id', flat=True)) if getattr(user, 'companies', None) else []
    if not company_ids:
        return Campaign.objects.none()

    if company_id not in (None, ''):
        try:
            company_id = int(company_id)
        except (TypeError, ValueError):
            return Campaign.objects.none()

        if company_id not in company_ids:
            return Campaign.objects.none()

        company_ids = [company_id]

    return queryset.filter(company_id__in=company_ids)


def _user_can_access_company(user, company_id):
    user_role = (getattr(user, 'role', '') or '').strip().lower()

    if user_role == 'techadmin':
        return True

    companies_manager = getattr(user, 'companies', None)
    if companies_manager is None:
        return False

    return companies_manager.filter(id=company_id).exists()


def _campaign_access_response(user, campaign):
    if not _user_can_access_company(user, campaign.company_id):
        return Response({'error': 'Unauthorized campaign.'}, status=status.HTTP_403_FORBIDDEN)
    return None


def _snapshot_lead_from_customer(customer, campaign):
    phone = getattr(customer, 'phone', None) or getattr(customer, 'phone_number', '') or ''
    address_line1 = getattr(customer, 'address_line1', None) or getattr(customer, 'address_line_1', '') or ''
    address_line2 = getattr(customer, 'address_line2', None) or getattr(customer, 'address_line_2', '') or ''
    addr_parts = [part for part in [address_line1, address_line2] if part]
    combined_addr = ', '.join(addr_parts)

    return CampaignLead(
        campaign=campaign,
        customer=customer,
        first_name=customer.first_name or '',
        last_name=customer.last_name or '',
        phone=phone,
        address_line1=combined_addr or address_line1,
        city=customer.city or '',
        state=customer.state or '',
    )


def _build_campaign_lead_defaults(customer):
    phone = getattr(customer, 'phone', None) or getattr(customer, 'phone_number', '') or ''
    address_line1 = getattr(customer, 'address_line1', None) or getattr(customer, 'address_line_1', '') or ''
    address_line2 = getattr(customer, 'address_line2', None) or getattr(customer, 'address_line_2', '') or ''
    combined_address = ', '.join([part for part in [address_line1, address_line2] if part])

    return {
        'first_name': customer.first_name or '',
        'last_name': customer.last_name or '',
        'phone': phone,
        'address_line1': combined_address or address_line1,
        'city': customer.city or '',
        'state': customer.state or '',
        'client_review': getattr(customer, 'reviews', '') or '',
    }


def _create_campaign_lead_for_customer(campaign, customer):
    existing_lead = CampaignLead.objects.filter(
        campaign_id=campaign.id,
        customer_id=customer.id,
    ).first()
    if existing_lead:
        return existing_lead, False

    lead = CampaignLead.objects.create(
        campaign=campaign,
        customer=customer,
        **_build_campaign_lead_defaults(customer),
    )
    return lead, True


def _delete_customer_if_orphaned(customer):
    if not customer:
        return

    if customer.campaign_leads.exists():
        return

    is_manual_customer = not bool(getattr(customer, 'excel_name', '').strip()) and getattr(customer, 'file_uploaded_at', None) is None
    if is_manual_customer:
        customer.delete()


# logger = logging.getLogger(__name__)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def campaigns_api(request):
    if request.method == 'GET':
        campaigns = Campaign.objects.all().order_by('-id')
        serializer = CampaignSerializer(campaigns, many=True)
        return Response(serializer.data)

    name = _normalize_text(request.data.get('name'))
    description = _normalize_text(request.data.get('description'))
    start_date = request.data.get('start_date')
    company = request.user.companies.first() if getattr(request.user, 'companies', None) else None

    if not name or not start_date:
        return Response({'error': 'name and start_date are required.'}, status=status.HTTP_400_BAD_REQUEST)

    if not company:
        return Response({'error': 'No company associated with user.'}, status=status.HTTP_400_BAD_REQUEST)

    serializer = CampaignSerializer(
        data={
            'name': name,
            'description': description,
            'start_date': start_date,
            'company_id': company.id,
        },
        context={'request': request},
    )
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    campaign = serializer.save()
    return Response(CampaignSerializer(campaign).data, status=status.HTTP_201_CREATED)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def campaign_detail_api(request, campaign_id):
    campaign = Campaign.objects.filter(id=campaign_id).first()
    if not campaign:
        return Response({'error': 'Campaign not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        campaign.delete()
        return Response({'message': 'Campaign deleted successfully.', 'deleted_id': campaign_id})

    payload = {}
    for field in ['name', 'description', 'start_date', 'status']:
        if field in request.data:
            payload[field] = request.data.get(field)

    serializer = CampaignSerializer(campaign, data=payload, partial=True, context={'request': request})
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    serializer.save()
    return Response(CampaignSerializer(campaign).data)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def campaign_leads_api(request, campaign_id):
    meta = request.META if hasattr(request, 'META') else {}
    remote = meta.get('REMOTE_ADDR') or meta.get('HTTP_X_FORWARDED_FOR')
    referer = meta.get('HTTP_REFERER')
    ua = meta.get('HTTP_USER_AGENT')
    logger.info("campaign_leads_api called: campaign_id=%s user=%s remote=%s referer=%s ua=%s data_keys=%s", campaign_id, getattr(request.user, 'id', None), remote, referer, ua, list(request.data.keys()) if hasattr(request, 'data') else None)
    campaign = Campaign.objects.select_related('company').filter(id=campaign_id).first()
    if not campaign:
        return Response({'error': 'Campaign not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        leads = campaign.leads.select_related('customer').order_by('-id')
        serializer = CampaignLeadSerializer(leads, many=True)
        data = serializer.data

        # Ensure returned address includes both customer address lines when available
        for lead_obj, lead_dict in zip(leads, data):
            try:
                cust = getattr(lead_obj, 'customer', None)
                if cust is not None:
                    parts = []
                    if getattr(cust, 'address_line1', None):
                        parts.append(cust.address_line1)
                    if getattr(cust, 'address_line2', None):
                        parts.append(cust.address_line2)
                    combined = ', '.join([p for p in parts if p])
                    if combined:
                        lead_dict['address_line1'] = combined
                    if not lead_dict.get('client_review'):
                        lead_dict['client_review'] = getattr(cust, 'reviews', '') or ''
                    if not lead_dict.get('reviews'):
                        lead_dict['reviews'] = getattr(cust, 'reviews', '') or ''
                    if not lead_dict.get('customer_reviews'):
                        lead_dict['customer_reviews'] = getattr(cust, 'reviews', '') or ''
            except Exception:
                # if anything goes wrong, keep serialized value
                pass

        return Response(data)

    customer_ids = request.data.get('customer_ids', [])
    if not isinstance(customer_ids, list) or not customer_ids:
        return Response({'error': 'customer_ids must be a non-empty list.'}, status=status.HTTP_400_BAD_REQUEST)

    normalized_customer_ids = []
    for item in customer_ids:
        try:
            normalized_customer_ids.append(int(item))
        except (TypeError, ValueError):
            return Response({'error': 'customer_ids must contain integers.'}, status=status.HTTP_400_BAD_REQUEST)

    customers = Customer.objects.filter(id__in=normalized_customer_ids)
    if not customers.exists():
        return Response({'error': 'No valid customers found for this campaign.'}, status=status.HTTP_400_BAD_REQUEST)

    added_count = 0
    existing_count = 0
    created_lead_ids = []
    created_leads = []

    for customer in customers:
        lead, created = _create_campaign_lead_for_customer(campaign, customer)
        if created:
            logger.info("CampaignLead created: id=%s campaign=%s customer=%s", lead.id, campaign_id, customer.id)
            added_count += 1
            created_lead_ids.append(lead.id)
            created_leads.append(lead)
        else:
            existing_count += 1

    created_leads_data = CampaignLeadSerializer(created_leads, many=True).data if created_leads else []

    return Response({
        'message': 'Leads processed successfully.',
        'added_count': added_count,
        'existing_count': existing_count,
        'lead_ids': created_lead_ids,
        'leads': created_leads_data,
    }, status=status.HTTP_201_CREATED)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def campaign_lead_detail_api(request, campaign_id, lead_id):
    campaign = Campaign.objects.select_related('company').filter(id=campaign_id).first()
    if not campaign:
        return Response({'error': 'Campaign not found.'}, status=status.HTTP_404_NOT_FOUND)

    lead = CampaignLead.objects.filter(id=lead_id, campaign_id=campaign_id).first()
    if not lead:
        return Response({'error': 'Lead not found.'}, status=status.HTTP_404_NOT_FOUND)

    allowed_fields = {
        'dispatch_date',
        'expected_delivery_date',
        'actual_delivery_date',
        'courier_name',
        'products',
        'docat',
        'client_status',
        'courier_status',
        'courier_description',
        'address_line1',
        'status',
        'notes',
        'client_review',
    }
    payload = {key: value for key, value in request.data.items() if key in allowed_fields}

    docat_value = str(payload.pop('docat', '') or '').strip()
    if docat_value:
        customer = lead.customer
        if customer and customer.docat != docat_value:
            customer.docat = docat_value
            customer.save(update_fields=['docat', 'updated_at'])

    serializer = CampaignLeadSerializer(lead, data=payload, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    serializer.save()
    return Response(serializer.data)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def campaign_lead_attempts_api(request, campaign_id, lead_id):
    campaign = Campaign.objects.select_related('company').filter(id=campaign_id).first()
    if not campaign:
        return Response({'error': 'Campaign not found.'}, status=status.HTTP_404_NOT_FOUND)

    lead = CampaignLead.objects.filter(id=lead_id, campaign_id=campaign_id).first()
    if not lead:
        return Response({'error': 'Lead not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        attempts = lead.attempts.all().order_by('attempt_number')
        serializer = CampaignLeadAttemptSerializer(attempts, many=True)
        return Response(serializer.data)

    # POST - create a new attempt
    data = request.data or {}
    # determine next attempt number
    existing_count = lead.attempts.count()
    attempt_number = existing_count + 1

    allowed = ['dispatch_date', 'expected_delivery_date', 'actual_delivery_date', 'courier_name', 'courier_status', 'courier_description', 'notes', 'products']
    payload = {k: data.get(k) for k in allowed if k in data}

    attempt = CampaignLeadAttempt.objects.create(
        lead=lead,
        attempt_number=attempt_number,
        **{k: payload.get(k) for k in payload}
    )

    # Optionally update the lead's main fields to reflect latest attempt
    update_payload = {}
    for field in ['dispatch_date', 'expected_delivery_date', 'actual_delivery_date', 'courier_name', 'courier_status', 'courier_description', 'notes', 'products']:
        if field in payload and payload.get(field) is not None:
            update_payload[field] = payload.get(field)

    if update_payload:
        serializer = CampaignLeadSerializer(lead, data=update_payload, partial=True)
        if serializer.is_valid():
            serializer.save()

    return Response(CampaignLeadAttemptSerializer(attempt).data, status=status.HTTP_201_CREATED)




@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def campaign_lead_delete_api(request, campaign_id, lead_id):
    campaign = Campaign.objects.select_related('company').filter(id=campaign_id).first()
    if not campaign:
        return Response({'error': 'Campaign not found.'}, status=status.HTTP_404_NOT_FOUND)

    lead = CampaignLead.objects.filter(id=lead_id, campaign_id=campaign_id).first()
    if not lead:
        return Response({'error': 'Lead not found.'}, status=status.HTTP_404_NOT_FOUND)

    customer = lead.customer
    lead.delete()

    _delete_customer_if_orphaned(customer)

    return Response({'message': 'Lead deleted successfully.', 'deleted_id': lead_id})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def campaign_leads_bulk_api(request, campaign_id):
    campaign = Campaign.objects.select_related('company').filter(id=campaign_id).first()
    if not campaign:
        return Response({'error': 'Campaign not found.'}, status=status.HTTP_404_NOT_FOUND)

    action = str(request.data.get('action') or '').strip().lower()
    lead_ids = request.data.get('lead_ids') or []
    if not isinstance(lead_ids, list) or not lead_ids:
        return Response({'error': 'lead_ids must be a non-empty list.'}, status=status.HTTP_400_BAD_REQUEST)

    leads = CampaignLead.objects.filter(campaign_id=campaign_id, id__in=lead_ids)
    found_ids = list(leads.values_list('id', flat=True))
    missing_ids = [lead_id for lead_id in lead_ids if lead_id not in found_ids]
    if missing_ids:
        return Response({'error': 'Some leads were not found.', 'missing_ids': missing_ids}, status=status.HTTP_404_NOT_FOUND)

    if action == 'delete':
        deleted_count = leads.count()
        customers_to_check = list(leads.select_related('customer').values_list('customer_id', flat=True))
        leads.delete()

        if customers_to_check:
            orphaned_customers = Customer.objects.filter(id__in=customers_to_check)
            for customer in orphaned_customers:
                _delete_customer_if_orphaned(customer)

        return Response({'message': 'Leads deleted successfully.', 'deleted_count': deleted_count, 'deleted_ids': lead_ids})

    if action == 'update':
        update_data = request.data.get('update') or {}
        if not isinstance(update_data, dict):
            return Response({'error': 'update must be an object.'}, status=status.HTTP_400_BAD_REQUEST)

        allowed_fields = {
            'dispatch_date',
            'expected_delivery_date',
            'actual_delivery_date',
            'courier_name',
            'products',
            'docat',
            'client_status',
            'courier_status',
            'courier_description',
            'address_line1',
            'status',
            'notes',
            'client_review',
        }
        payload = {key: value for key, value in update_data.items() if key in allowed_fields}
        if not payload:
            return Response({'error': 'No valid update fields provided.'}, status=status.HTTP_400_BAD_REQUEST)

        docat_value = str(payload.pop('docat', '') or '').strip()
        if docat_value:
            customer_ids = leads.values_list('customer_id', flat=True).distinct()
            customers = Customer.objects.filter(id__in=customer_ids)
            for customer in customers:
                if customer.docat != docat_value:
                    customer.docat = docat_value
                    customer.save(update_fields=['docat', 'updated_at'])

        updated_ids = []
        for lead in leads:
            serializer = CampaignLeadSerializer(lead, data=payload, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            updated_ids.append(lead.id)

        return Response({'message': 'Leads updated successfully.', 'updated_ids': updated_ids})

    return Response({'error': 'Invalid action.'}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def courier_names_api(request):
    courier_names = (
        CampaignLead.objects.all()
        .exclude(courier_name__isnull=True)
        .exclude(courier_name='')
        .values_list('courier_name', flat=True)
        .distinct()
    )

    normalized = {}
    for name in courier_names:
        cleaned = _normalize_text(name)
        if not cleaned:
          continue
        key = cleaned.lower()
        if key not in normalized:
            normalized[key] = cleaned

    couriers = [normalized[key] for key in sorted(normalized.keys(), key=lambda value: normalized[value].lower())]
    return Response({'couriers': couriers})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def product_names_api(request):
    # Collect product names from CampaignLead.products (comma-separated) and Product model
    names = set()

    # From Product model
    for p in Product.objects.all().values_list('product_name', flat=True):
        if p:
            names.add(str(p).strip())

    # From campaign leads products field
    for raw in CampaignLead.objects.exclude(products__isnull=True).exclude(products='').values_list('products', flat=True):
        if not raw:
            continue
        for part in str(raw).split(','):
            part = part.strip()
            if part:
                names.add(part)

    sorted_names = sorted(names, key=lambda s: s.lower())
    return Response({'products': sorted_names})


@api_view(['GET'])
def city_autofill(request):
    city = request.GET.get('city', '')
    if not city or len(city.strip()) < 2:
        return Response({})

    try:
        response = requests.get(
            'https://nominatim.openstreetmap.org/search',
            params={
                'city': city.strip(),
                'format': 'json',
                'limit': 1,
                'addressdetails': 1,
            },
            headers={'User-Agent': 'DevlonApp/1.0'},
            timeout=5,
        )

        if response.status_code == 429:
            return Response({})

        data = response.json()
        if data and data[0].get('address'):
            addr = data[0]['address']
            return Response({
                'state': addr.get('state', ''),
                'country': addr.get('country', ''),
            })
    except Exception:
        pass

    return Response({})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_table_columns(request):
    table_name = request.GET.get('table', CUSTOMER_TABLE_NAME)

    try:
        columns = _customer_table_columns(table_name)
        return Response({'columns': columns, 'table': table_name})
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_customer(request):
    return _add_customer_impl(request)


def _add_customer_impl(request):
    payload = _normalize_customer_payload(request.data)
    allow_duplicate = bool(request.data.get('allow_duplicate'))
    if not payload['first_name'] or not payload['phone']:
        return Response({'error': 'First name and phone are required.'}, status=status.HTTP_400_BAD_REQUEST)

    if not allow_duplicate and Customer.objects.filter(phone=payload['phone']).exists():
        return Response({'error': 'Customer with this phone already exists.', 'duplicate': True}, status=status.HTTP_400_BAD_REQUEST)

    customer = Customer.objects.create(created_by=request.user, **payload)
    return Response(
        {
            'message': 'Customer added successfully.',
            'id': customer.id,
            'customer': {'id': customer.id},
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def customers_api(request):
    if request.method == 'GET':
        return _get_customers_impl(request)
    return _add_customer_impl(request)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_customers(request):
    return _get_customers_impl(request)


def _get_customers_impl(request):
    queryset = Customer.objects.all()

    rows = list(queryset.order_by('-id').values())
    return Response({'customers': rows, 'total': len(rows)})


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def customer_detail_api(request, customer_id):
    queryset = _customer_queryset_for_user(request.user)
    customer = queryset.filter(id=customer_id).first()

    if not customer:
        return Response({'error': 'Customer not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response({'customer': Customer.objects.filter(id=customer_id).values().first()})

    payload = _normalize_customer_payload(request.data)
    if not payload['first_name'] or not payload['phone']:
        return Response({'error': 'First name and phone are required.'}, status=status.HTTP_400_BAD_REQUEST)

    for field, value in payload.items():
        setattr(customer, field, value)
    customer.save()

    return Response({
        'message': 'Customer updated successfully.',
        'customer': Customer.objects.filter(id=customer_id).values().first(),
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_customer_excel(request):
    request_payload = request.data
    column_mapping = {}
    excel_name = ''
    campaign = None
    attach_to_campaign = False
    if isinstance(request_payload, list):
        rows = request_payload
        table_name = CUSTOMER_TABLE_NAME
    else:
        rows = request_payload.get('rows', [])
        column_mapping = request_payload.get('column_mapping', {})
        table_name = request_payload.get('table', CUSTOMER_TABLE_NAME)
        excel_name = _normalize_text(request_payload.get('file_name') or request_payload.get('excel_name'))
        attach_to_campaign = bool(request_payload.get('attach_to_campaign', False))

    if not isinstance(request_payload, list) and attach_to_campaign:
        campaign_id = request_payload.get('campaign_id')
        if campaign_id not in (None, ''):
            try:
                campaign_id = int(campaign_id)
            except (TypeError, ValueError):
                return Response({'error': 'Invalid campaign_id.'}, status=status.HTTP_400_BAD_REQUEST)

            campaign = Campaign.objects.select_related('company').filter(id=campaign_id).first()
            if not campaign:
                return Response({'error': 'Campaign not found.'}, status=status.HTTP_404_NOT_FOUND)

    if table_name != CUSTOMER_TABLE_NAME:
        return Response({'error': 'Only api_customer is supported.'}, status=status.HTTP_400_BAD_REQUEST)

    if not rows:
        return Response({'error': 'rows are required.'}, status=status.HTTP_400_BAD_REQUEST)

    allowed_columns = set(_customer_table_columns(table_name))
    allowed_columns.update({'company_id', 'created_by_id'})
    upload_time = timezone.now()

    inserted_rows = []
    created_ids = []

    for row in rows:
        if not isinstance(row, dict):
            continue

        if column_mapping:
            customer_data = {}
            for excel_col, db_col in column_mapping.items():
                normalized_db_col = CUSTOMER_FIELD_ALIASES.get(db_col, db_col)
                if normalized_db_col in {'company_id', 'created_by_id', 'id', 'created_at', 'updated_at'}:
                    continue
                if normalized_db_col in allowed_columns:
                    customer_data[normalized_db_col] = _normalize_text(row.get(excel_col))
        else:
            customer_data = {}
            for key, value in row.items():
                if value is None:
                    continue

                normalized_key = CUSTOMER_FIELD_ALIASES.get(key, key)
                if normalized_key in {'company_id', 'created_by_id', 'id', 'created_at', 'updated_at'}:
                    continue
                if normalized_key in allowed_columns:
                    customer_data[normalized_key] = _normalize_text(value)

        if customer_data.get('phone'):
            customer_data['phone'] = _normalize_phone_field(customer_data['phone'])

        customer = _find_existing_customer(customer_data)
        if customer:
            fields_updated = False
            for field, value in customer_data.items():
                if value and not getattr(customer, field, ''):
                    setattr(customer, field, value)
                    fields_updated = True

            if excel_name and not getattr(customer, 'excel_name', ''):
                customer.excel_name = excel_name
                fields_updated = True

            if getattr(customer, 'file_uploaded_at', None) is None:
                customer.file_uploaded_at = upload_time
                fields_updated = True

            if fields_updated:
                customer.save()
        else:
            customer = Customer.objects.create(
                created_by=request.user,
                excel_name=excel_name,
                file_uploaded_at=upload_time,
                **customer_data,
            )

        if campaign is not None:
            _create_campaign_lead_for_customer(campaign, customer)

        inserted_rows.append(Customer.objects.filter(id=customer.id).values().first())
        created_ids.append(customer.id)

    meta = request.META if hasattr(request, 'META') else {}
    remote = meta.get('REMOTE_ADDR') or meta.get('HTTP_X_FORWARDED_FOR')
    referer = meta.get('HTTP_REFERER')
    ua = meta.get('HTTP_USER_AGENT')
    logger.info("upload_customer_excel: user=%s excel_name=%s rows=%s created_ids=%s remote=%s referer=%s ua=%s", getattr(request.user, 'id', None), excel_name, len(rows), created_ids, remote, referer, ua)

    for row in inserted_rows:
        if isinstance(row, dict) and row.get('phone'):
            row['phone'] = _normalize_phone_field(row.get('phone'))

    all_inserted_phones = set()
    all_inserted_names = set()
    for row in inserted_rows:
        all_inserted_phones.update(_extract_phones(row.get('phone')))
        all_inserted_names.update(_extract_name_group(row))

    candidate_rows = []
    seen_ids = set()

    if all_inserted_phones:
        q = Q()
        for phone in all_inserted_phones:
            q |= Q(phone__icontains=phone)
        for candidate in Customer.objects.filter(q).values():
            if candidate['id'] not in seen_ids:
                seen_ids.add(candidate['id'])
                candidate_rows.append(candidate)

    if all_inserted_names:
        q = Q()
        for name in all_inserted_names:
            q |= (
                Q(company_upload_name__iexact=name) |
                Q(first_name__iexact=name) |
                Q(last_name__iexact=name)
            )
        for candidate in Customer.objects.filter(q).values():
            if candidate['id'] not in seen_ids:
                seen_ids.add(candidate['id'])
                candidate_rows.append(candidate)

    candidates_by_phone = defaultdict(list)
    candidates_by_name = defaultdict(list)
    for candidate in candidate_rows:
        for phone in _extract_phones(candidate.get('phone')):
            candidates_by_phone[phone].append(candidate)
        for name in _extract_name_group(candidate):
            candidates_by_name[name].append(candidate)

    duplicate_ids = set()
    duplicate_rows = []

    def _register_duplicate(row):
        if row['id'] not in duplicate_ids:
            duplicate_ids.add(row['id'])
            duplicate_rows.append(row)

    # Flag repeated IDs from the same upload before comparing against the database.
    seen_id_count = {}
    for row in inserted_rows:
        row_id = row.get('id')
        seen_id_count[row_id] = seen_id_count.get(row_id, 0) + 1

    intra_duplicate_ids = {row_id for row_id, count in seen_id_count.items() if count > 1}

    for row in inserted_rows:
        if row.get('id') in intra_duplicate_ids:
            duplicate_rows.append(row)
            duplicate_ids.add(row['id'])

    for row in inserted_rows:
        row_phones = _extract_phones(row.get('phone'))
        row_names = _extract_name_group(row)

        seen = set()
        potential = []

        for phone in row_phones:
            for candidate in candidates_by_phone.get(phone, []):
                if candidate['id'] not in seen and candidate['id'] != row['id']:
                    seen.add(candidate['id'])
                    potential.append(candidate)

        for name in row_names:
            for candidate in candidates_by_name.get(name, []):
                if candidate['id'] not in seen and candidate['id'] != row['id']:
                    seen.add(candidate['id'])
                    potential.append(candidate)

        matches = [candidate for candidate in potential if _rows_are_duplicates(row, candidate)]

        if matches:
            _register_duplicate(row)
            for match in matches:
                _register_duplicate(match)

    return Response({
        'message': 'Upload complete.',
        'inserted': len(inserted_rows),
        'updated': len(inserted_rows),
        'inserted_rows': inserted_rows,
        'duplicate_rows': duplicate_rows,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_duplicate_groups(request):
    queryset = Customer.objects.all()
    all_customers = list(queryset.order_by('id').values())

    grouped = []
    used_ids = set()

    for i, c1 in enumerate(all_customers):
        if c1['id'] in used_ids:
            continue

        group = [c1]

        for c2 in all_customers[i + 1:]:
            if c2['id'] in used_ids:
                continue

            if _rows_are_duplicates(c1, c2):
                group.append(c2)
                used_ids.add(c2['id'])

        if len(group) > 1:
            used_ids.add(c1['id'])

            all_fields = ['first_name', 'last_name', 'phone', 'address_line1', 'address_line2', 'city', 'state', 'country', 'pincode']
            conflicting = []
            same = []
            for field in all_fields:
                vals = list({_normalize_for_comparison(str(r.get(field, '') or '')) for r in group})
                if len(vals) > 1:
                    conflicting.append(field)
                else:
                    same.append(field)

            grouped.append({
                'duplicate_column': 'party_name_phone_address',
                'rows': group,
                'count': len(group),
                'conflicting_fields': conflicting,
                'same_fields': same,
            })

    return Response({'groups': grouped, 'total_groups': len(grouped)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def handle_duplicate_action(request):
    action = (request.data.get('action') or '').strip().lower()
    ids = request.data.get('ids', [])
    keep_ids = request.data.get('keep_ids', [])
    merge_data = request.data.get('merge_data', {})
    delete_ids = request.data.get('delete_ids', [])

    if not action or not ids:
        return Response({'error': 'action and ids are required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        customer_ids = [int(item) for item in ids]
        keep_ids = {int(item) for item in keep_ids}
        delete_ids = [int(item) for item in delete_ids] if delete_ids else []
    except (TypeError, ValueError):
        return Response({'error': 'ids must be integers.'}, status=status.HTTP_400_BAD_REQUEST)

    queryset = Customer.objects.filter(id__in=customer_ids)

    if action == 'keep':
        return Response({'message': 'All rows kept as-is.'})

    if action == 'delete':
        target_ids = delete_ids or customer_ids
        deleted_count, _ = Customer.objects.filter(id__in=target_ids).delete()
        return Response({'message': f'{deleted_count} row(s) deleted.', 'deleted_ids': target_ids})

    if action == 'merge':
        merge_ids = [item for item in customer_ids if item not in keep_ids]
        if len(merge_ids) < 2:
            return Response({'error': 'Need at least 2 rows to merge.'}, status=status.HTTP_400_BAD_REQUEST)

        rows = list(Customer.objects.filter(id__in=merge_ids).order_by('id'))
        if not rows:
            return Response({'error': 'No rows found.'}, status=status.HTTP_404_NOT_FOUND)

        merged_data = {}
        mergeable_fields = ['first_name', 'last_name', 'phone', 'address_line1', 'address_line2', 'country', 'city', 'state', 'pincode']
        for field in mergeable_fields:
            values = [getattr(row, field) for row in rows if getattr(row, field) not in (None, '')]
            unique_values = list(dict.fromkeys(values))
            if len(unique_values) == 1:
                merged_data[field] = unique_values[0]
            elif field in merge_data:
                merged_data[field] = merge_data[field]
            elif values:
                merged_data[field] = values[0]

        primary_row = rows[0]
        for field, value in merged_data.items():
            setattr(primary_row, field, value)
        primary_row.save()

        delete_later = [row.id for row in rows[1:]]
        if delete_later:
            Customer.objects.filter(id__in=delete_later).delete()

        return Response({
            'message': f'Merged into ID {primary_row.id}. Deleted {len(delete_later)} row(s). Kept {len(keep_ids)} row(s) separately.',
            'merged_id': primary_row.id,
            'kept_ids': list(keep_ids),
            'deleted_ids': delete_later,
        })

    return Response({'error': 'Invalid action.'}, status=status.HTTP_400_BAD_REQUEST)





class CanViewRoles(BasePermission):
    """
    Custom permission to check if the user can view roles.
    """

    def has_permission(self, request, view):
        # You can use your own logic to check if the user has permission to view roles
        user = request.user

        # You can either hardcode the logic or use a permission model to check if the user has the permission
    
        if user.role == 'techadmin':  # Example: Techadmin can view roles except 'techadmin' itself
            # You can check for more conditions based on your needs
            return True
        return False  # Deny permission by default




@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_logged_in_user(request):
    serializer = UserSerializer(request.user)
    return Response(serializer.data)

# permission_api/views.py

from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework import status
from .models import Role
from .serializers import RoleSerializer

from rest_framework.response import Response
from rest_framework import generics
from .serializers import RoleSerializer
from .models import Role
from .views import CanViewRoles  # Import the custom permission
from rest_framework import generics, permissions
from .models import Role, PermissionAssignment
from .serializers import RoleSerializer
from .views import CanViewRoles  # your custom permission
from django.db.models import Q


from django.db.models import Q
from rest_framework import permissions, generics
from api.models import Role, PermissionAssignment
from api.serializers import RoleSerializer

from django.db.models import Q
from rest_framework import generics, permissions
from .models import Role, PermissionAssignment,Permission
from .serializers import RoleSerializer

class RoleListView(generics.ListAPIView):
    serializer_class = RoleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        user_role = (user.role or "").strip().lower()

        queryset = Role.objects.all()

        # ✅ Allow full access (except techadmin) for techadmin
        if user_role == "techadmin":
            return queryset.exclude(role__iexact="techadmin")

        # ✅ Step 1: User-specific permission overrides
        user_assignments = PermissionAssignment.objects.filter(user=user)
        user_permission_map = {pa.permission_id: pa.allow for pa in user_assignments}

        # ✅ Step 2: Role-based permissions (only allow=True, no user override)
        role_permission_ids = []
        if user.role:
            role_permission_ids = Permission.objects.filter(
                permissionassignment__role__role__iexact=user.role,
                permissionassignment__user__isnull=True,
                permissionassignment__allow=True
            ).values_list('id', flat=True)

        # ✅ Step 3: Compute effective permissions
        effective_permission_ids = set(role_permission_ids)
        for perm_id, allow in user_permission_map.items():
            if allow:
                effective_permission_ids.add(perm_id)
            else:
                effective_permission_ids.discard(perm_id)  # denied overrides allowed

        # ✅ Step 4: Filter for create_* permissions
        permission_codes = Permission.objects.filter(id__in=effective_permission_ids).values_list("code", flat=True)
        create_permission_codes = [code for code in permission_codes if code.startswith("create_")]
        role_names = [code.replace("create_", "").lower() for code in create_permission_codes]

        # ✅ Step 5: Return filtered roles
        if not role_names:
            return Role.objects.none()

        return queryset.filter(role__in=role_names)



class RoleCreateView(generics.CreateAPIView):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def create(self, request, *args, **kwargs):
        role_to_create = request.data.get("role", "").strip().lower().replace(" ", "")
        user_role = request.user.role.lower() if request.user.role else ""

        # Prevent creating own role type
        if (user_role == "techadmin" and role_to_create == "techadmin") or \
           (user_role == "superadmin" and role_to_create in ["superadmin", "techadmin"]):
            return Response(
                {"detail": f"{user_role} is not allowed to create {role_to_create}."},
                status=status.HTTP_403_FORBIDDEN
            )

        # Check for duplicate role
        if Role.objects.filter(role__iexact=role_to_create).exists():
            return Response(
                {"role": "Role already exists."},
                status=status.HTTP_400_BAD_REQUEST
            )

        return super().create(request, *args, **kwargs)


class RoleUpdateView(generics.UpdateAPIView):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def update(self, request, *args, **kwargs):
        instance = self.get_object()

        # Restrict editing superadmin role to techadmin only
        if instance.role.lower() == "superadmin" and request.user.role.lower() != "techadmin":
            return Response({"detail": "Only techadmin can update superadmin role."}, status=status.HTTP_403_FORBIDDEN)

        return super().update(request, *args, **kwargs)

class RoleDeleteView(generics.DestroyAPIView):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()

        # Restrict deleting superadmin role to techadmin only
        if instance.role.lower() == "superadmin" and request.user.role.lower() != "techadmin":
            return Response({"detail": "Only techadmin can delete superadmin role."}, status=status.HTTP_403_FORBIDDEN)

        return super().destroy(request, *args, **kwargs)

    
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .serializers import UserSerializer
from .models import User

def is_superadmin(user):
    return user.role in ['superadmin', 'techadmin']


from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .serializers import UserSerializer

def is_user_role(user):
    return user.role == 'user'


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_user(request):
    # Check if the requesting user has the 'user' role
    if is_user_role(request.user):
        return Response(
            {'message': 'Users cannot create other users', 'type': 'error'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Check if the requesting user is trying to assign their own role to a new user
    requested_role = request.data.get('role')
    if requested_role == request.user.role:
        return Response(
            {'message': 'You cannot assign a user the same role as your own', 'type': 'error'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Check if the username already exists
    username = request.data.get('username')
    if User.objects.filter(username=username).exists():
        return Response(
            {'message': 'Username already exists', 'type': 'error'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Proceed with user creation if the above checks are passed
    serializer = UserSerializer(data=request.data, context={'request': request})
    if serializer.is_valid():
        user = serializer.save()
        if request.user.role.lower() == 'admin':
            user.companies.set(request.user.companies.all())
        user.created_by = request.user  # <<== KEY LINE
        user.save()


        # Return response with the updated user data
        updated_serializer = UserSerializer(user)
        return Response(
            {'message': 'User successfully created', 'type': 'success', 'data': updated_serializer.data},
            status=status.HTTP_201_CREATED
        )
    
    return Response(
        {'message': 'Invalid data', 'type': 'error', 'errors': serializer.errors},
        status=status.HTTP_400_BAD_REQUEST
    )



@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user(request, user_id):
    if not is_superadmin(request.user):
        return Response({'error': 'Only superadmin can view users'}, status=status.HTTP_403_FORBIDDEN)
    try:
        user = User.objects.get(id=user_id)
        serializer = UserSerializer(user)
        return Response(serializer.data)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
    
from rest_framework.exceptions import ValidationError

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_user(request, user_id):
    if not is_superadmin(request.user):
        return Response({'error': 'Only superadmin can edit users'}, status=status.HTTP_403_FORBIDDEN)
    try:
        user = User.objects.get(id=user_id)
        
        # Check if the username already exists and is not the same as the current user's username
        username = request.data.get('username')
        if User.objects.filter(username=username).exclude(id=user.id).exists():
            raise ValidationError({"username": "User with this username already exists."})

        # Proceed with serialization and saving the user
        serializer = UserSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
    except ValidationError as e:
        return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)

    
    
    
    
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_user(request, user_id):
    if not is_superadmin(request.user):
        return Response({'error': 'Only superadmin can delete users'}, status=status.HTTP_403_FORBIDDEN)
    try:
        user = User.objects.get(id=user_id)
        user.delete()
        return Response({'message': 'User deleted successfully'})
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
import base64

@api_view(['POST'])
def login_user(request):
    auth_header = request.META.get('HTTP_AUTHORIZATION')

    if not auth_header or not auth_header.startswith('Basic '):
        return Response({'error': 'Missing or invalid Authorization header'}, status=status.HTTP_401_UNAUTHORIZED)

    try:
        # Decode base64 string
        encoded_credentials = auth_header.split(' ')[1]
        decoded_credentials = base64.b64decode(encoded_credentials).decode('utf-8')
        username, password = decoded_credentials.split(':', 1)
    except Exception:
        return Response({'error': 'Invalid Authorization header format'}, status=status.HTTP_400_BAD_REQUEST)

    # Authenticate user
    user = authenticate(username=username, password=password)

    if user:
        token, _ = Token.objects.get_or_create(user=user)
        serializer = UserSerializer(user)
        return Response({
            'token': token.key,
            'role': serializer.data.get('role')
        })


    try:
        User.objects.get(username=username)
        return Response({'error': 'Incorrect password'}, status=status.HTTP_401_UNAUTHORIZED)
    except User.DoesNotExist:
        return Response({'error': 'Incorrect username'}, status=status.HTTP_401_UNAUTHORIZED)



@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_user(request):
    try:
        # Delete the token for the authenticated user
        request.user.auth_token.delete()
        return Response({'message': 'Logged out successfully'}, status=200)
    except Exception as e:
        return Response({'error': str(e)}, status=400)
    

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model
from .serializers import UserSerializer

User = get_user_model()

class UserListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        current_user = request.user
        role = current_user.role.lower()

        # Base queryset with role-based exclusions
        if role == 'techadmin':
            users = User.objects.exclude(role__iexact='techadmin')
            
            
        elif role == 'superadmin':
            users = User.objects.exclude(role__in=['techadmin', 'superadmin']).filter(created_by=current_user)

            company_id = request.query_params.get('company_id')
            if company_id:
                users = users.filter(companies__id=company_id)

            users = users.distinct()

                
        elif role == 'admin':
            # Get companies assigned to current admin user
            company_ids = current_user.companies.values_list('id', flat=True)

            # Filter users:
            # - Exclude users with roles 'superadmin', 'techadmin', and 'admin' (other admins)
            # - Include only users assigned to current admin's companies
            users = User.objects.filter(
        companies__id__in=company_ids,
        created_by=current_user  # <<== KEY LINE
    ).exclude(
        role__in=['superadmin', 'techadmin', 'admin']
    ).distinct()

  
        else:
            users = User.objects.exclude(role__in=['techadmin', 'superadmin'])

        serializer = UserSerializer(users, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_warehouse(request):
    user = request.user

    warehouse_name = request.data.get('name')
    warehouse_code = request.data.get('code', '')
    description = request.data.get('description')
    company_id = request.data.get('company_id')

    if not warehouse_name or not description:
        return Response({"error": "Both 'name' and 'description' are required."}, status=400)

    if not company_id:
        return Response({"error": "Company ID is required."}, status=400)

    try:
        company = Company.objects.get(pk=company_id)
    except Company.DoesNotExist:
        return Response({"error": "Invalid company ID."}, status=400)

    # Ensure user belongs to this company
    if not user.companies.filter(pk=company.pk).exists():
        return Response({"error": "You do not belong to the selected company."}, status=403)

    # Check warehouse name uniqueness per company (not per user)
    if Warehouse.objects.filter(name=warehouse_name, company=company).exists():
        return Response({"error": "A warehouse with this name already exists for this company."}, status=400)

    try:
        warehouse = Warehouse.objects.create(
            name=warehouse_name,
            code=warehouse_code or None,
            description=description,
            company=company,
            created_by=user
        )
        return Response(WarehouseSerializer(warehouse).data, status=201)

    except IntegrityError:
        return Response({"error": "Failed to create warehouse due to integrity error."}, status=400)

 
      
@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_warehouse(request, pk):
    try:
        warehouse = Warehouse.objects.get(pk=pk)
    except Warehouse.DoesNotExist:
        return Response({'error': 'Warehouse not found'}, status=404)

    serializer = WarehouseSerializer(
        warehouse,
        data=request.data,
        context={'request': request}  # <-- This is important!
    )

    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    
    return Response(serializer.errors, status=400)


@api_view(["DELETE"])
def delete_warehouse(request, pk):
    try:
        warehouse = Warehouse.objects.get(pk=pk)
        warehouse.delete()
        return Response({"message": "Warehouse deleted"}, status=200)
    except Warehouse.DoesNotExist:
        return Response({"error": "Warehouse not found"}, status=404)




def get_warehouse_by_id(request, id):
    try:
        warehouse = Warehouse.objects.get(id=id)
        data = {
            "id": warehouse.id,
            "name": warehouse.name,
            "code": warehouse.code,
            "description": warehouse.description,
        }
        return JsonResponse(data)
    except Warehouse.DoesNotExist:
        return JsonResponse({'error': 'Warehouse not found'}, status=404)

    

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Warehouse
from .serializers import WarehouseSerializer

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def warehouse_list(request):
    user = request.user
    company_id = request.GET.get('company_id')

    if user.role == 'User':
        warehouses = Warehouse.objects.filter(userwarehouse__user=user)

    elif user.role in ['admin', 'superadmin']:
        if company_id:
            warehouses = Warehouse.objects.filter(company__id=company_id, created_by=user)
        else:
            company = user.companies.first()
            if company:
                warehouses = Warehouse.objects.filter(company=company, created_by=user)
            else:
                warehouses = Warehouse.objects.none()
    else:
        warehouses = Warehouse.objects.none()

    serializer = WarehouseSerializer(warehouses, many=True, context={'request': request})
    return Response(serializer.data)







from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Warehouse, UserWarehouse  # adjust if using related name
from .serializers import WarehouseSerializer

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_warehouses(request):
    user = request.user
    if user.role == 'User':
        warehouses = Warehouse.objects.filter(userwarehouse__user=user)
    else:
        warehouses = Warehouse.objects.all()
    
    serializer = WarehouseSerializer(warehouses, many=True)
    return Response(serializer.data)



from django.contrib.auth import get_user_model

def get_all_descendant_users(user):
    """
    Returns a list of all users created by the given user (recursively), including the user.
    Also prints the list of descendant users for debugging.
    """
    User = get_user_model()
    all_related_users = set()
    to_process = [user]

    while to_process:
        current = to_process.pop()
        if current not in all_related_users:
            all_related_users.add(current)
            children = User.objects.filter(created_by=current)
            to_process.extend(children)

    descendant_list = list(all_related_users)
    print(f"[DEBUG] Descendant users of '{user.username}': {[u.username for u in descendant_list]}")
    return descendant_list



@permission_classes([IsAuthenticated])
class ProductListCreateView(generics.ListCreateAPIView):
    serializer_class = ProductSerializer

    def get_queryset(self):
        user = self.request.user
        user_companies = user.companies.all()
        company_id = self.request.query_params.get('company_id')

        try:
            company_id = int(company_id) if company_id is not None else None
        except ValueError:
            return Product.objects.none()

        visible_users = get_all_descendant_users(user)

        if company_id:
            if user_companies.filter(id=company_id).exists():
                queryset = Product.objects.filter(
                    company_id=company_id,
                    created_by__in=visible_users
                ).order_by('-created_at')
            else:
                queryset = Product.objects.none()
        else:
            queryset = Product.objects.filter(
                company__in=user_companies,
                created_by__in=visible_users
            ).order_by('-created_at')

        return queryset

    def perform_create(self, serializer):
        user = self.request.user
        company = user.companies.first()
        serializer.save(company=company, created_by=user)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_all_products(request):
    user = request.user
    company_id = request.query_params.get('company_id')
    warehouse_id = request.query_params.get('warehouse_id')
    status_filter = request.query_params.get('status', 'all')

    user_companies = user.companies.all()
    visible_users = get_all_descendant_users(user)

    try:
        company_id = int(company_id) if company_id is not None else None
    except ValueError:
        return Response({'error': 'Invalid company_id'}, status=400)

    products = Product.objects.filter(
        company__in=user_companies,
        created_by__in=visible_users
    )

    if company_id and user_companies.filter(id=company_id).exists():
        products = products.filter(company_id=company_id)
    elif company_id:
        return Response({'error': 'Unauthorized company_id'}, status=403)

    if warehouse_id:
        try:
            warehouse_id = int(warehouse_id)
            products = products.filter(warehouses__id=warehouse_id).distinct()
        except ValueError:
            return Response({'error': 'Invalid warehouse_id'}, status=400)

    if status_filter == 'active':
        products = products.filter(is_active=True)
    elif status_filter == 'disabled':
        products = products.filter(is_active=False)
    elif status_filter != 'all':
        return Response({'error': 'Invalid status. Use active, disabled, or all.'}, status=400)

    products = products.order_by('-created_at')

    serializer = ProductSerializer(products, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bulk_toggle_product_status(request):
    product_ids = request.data.get('product_ids', [])
    action = request.data.get('action', '').lower()

    if not product_ids or not isinstance(product_ids, list):
        return Response({'error': 'product_ids must be a non-empty list.'}, status=status.HTTP_400_BAD_REQUEST)

    if action not in ('enable', 'disable'):
        return Response({'error': 'action must be enable or disable.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        product_ids = [int(pid) for pid in product_ids]
    except (TypeError, ValueError):
        return Response({'error': 'product_ids must contain integers.'}, status=status.HTTP_400_BAD_REQUEST)

    is_active = action == 'enable'
    user_companies = request.user.companies.all()
    products = Product.objects.filter(id__in=product_ids, company__in=user_companies)
    updated = products.update(is_active=is_active)

    return Response({'updated': updated}, status=status.HTTP_200_OK)



@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_product(request):
    company_id = request.data.get('company_id')
    product_name = normalize_product_name(request.data.get('product_name'))

    if not company_id:
        return Response({'company_id': ['This field is required.']}, status=status.HTTP_400_BAD_REQUEST)

    if not product_name:
        return Response({'message': 'Product name is required.'}, status=status.HTTP_400_BAD_REQUEST)

    # Check that the user belongs to the given company
    if not request.user.companies.filter(id=company_id).exists():
        return Response({'message': 'You do not belong to this company.'}, status=status.HTTP_403_FORBIDDEN)

    # Check uniqueness within company (normalized name)
    if find_product_by_normalized_name(company_id, product_name):
        return Response({'message': 'Product already exists in your company'}, status=status.HTTP_400_BAD_REQUEST)

    payload = request.data.copy()
    payload['product_name'] = product_name
    serializer = ProductSerializer(data=payload, context={'user': request.user})

    if serializer.is_valid():
        serializer.save()
        return Response({'message': 'Product created successfully'}, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_product(request, pk):
    company_ids = request.user.companies.values_list('id', flat=True)

    try:
        product = Product.objects.get(id=pk, company__id__in=company_ids)
    except Product.DoesNotExist:
        return Response({'message': 'Product not found or not in your company'}, status=status.HTTP_404_NOT_FOUND)

    payload = request.data.copy()
    if 'product_name' in payload:
        normalized_name = normalize_product_name(payload.get('product_name'))
        if not normalized_name:
            return Response({'message': 'Product name is required.'}, status=status.HTTP_400_BAD_REQUEST)
        duplicate = find_product_by_normalized_name(product.company_id, normalized_name, exclude_id=product.id)
        if duplicate:
            return Response({'message': 'Product already exists in your company'}, status=status.HTTP_400_BAD_REQUEST)
        payload['product_name'] = normalized_name

    serializer = ProductSerializer(product, data=payload, partial=True, context={'company': product.company, 'user': request.user})

    if serializer.is_valid():
        serializer.save()
        return Response({'message': 'Product updated successfully'})

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response
from rest_framework import status
from .models import Product

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import Product

from rest_framework.authentication import TokenAuthentication
from rest_framework.decorators import authentication_classes

from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .models import Product


# views.py

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_product(request, pk):
    try:
        product = Product.objects.get(pk=pk)
        product.delete()
        return Response({'message': 'Product deleted successfully'}, status=status.HTTP_200_OK)
    except Product.DoesNotExist:
        return Response({'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_products_bulk(request):
    ids_param = request.query_params.get('ids')
    if not ids_param:
        return Response({'error': 'No product IDs provided'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        ids = [int(i) for i in ids_param.split(',')]
        products = Product.objects.filter(id__in=ids)
        count = products.count()

        if count == 0:
            return Response({'message': 'No products found for deletion'}, status=status.HTTP_404_NOT_FOUND)

        products.delete()
        return Response({'message': f'{count} product(s) deleted successfully'}, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def update_product_warehouse(request):
    product_id = request.data.get('product_id')
    warehouse_id = request.data.get('warehouse_id')
    action = request.data.get('action', '').lower()

    if not product_id or not warehouse_id:
        return Response({"status": "error", "message": "Missing product_id or warehouse_id"})

    try:
        product = Product.objects.get(id=product_id)
        warehouse = Warehouse.objects.get(id=warehouse_id)
    except Product.DoesNotExist:
        return Response({"status": "error", "message": "Product not found"})
    except Warehouse.DoesNotExist:
        return Response({"status": "error", "message": "Warehouse not found"})

    if action == "add":
        try:
            ProductWarehouse.objects.create(product=product, warehouse=warehouse)
            return Response({"status": "success", "message": "Product linked to warehouse"})
        except IntegrityError:
            return Response({"status": "error", "message": "This product is already linked to this warehouse"})

    elif action == "remove":
        deleted, _ = ProductWarehouse.objects.filter(product=product, warehouse=warehouse).delete()
        if deleted:
            return Response({"status": "success", "message": "Product unlinked from warehouse"})
        else:
            return Response({"status": "error", "message": "No matching link found"})

    else:
        return Response({"status": "error", "message": "Invalid action"})
    


User = get_user_model()

@api_view(['POST'])
def update_user_warehouse(request):
    user_id = request.data.get('user_id')
    warehouse_id = request.data.get('warehouse_id')
    action = request.data.get('action', '').lower()

    if not user_id or not warehouse_id:
        return Response({"status": "error", "message": "Missing user_id or warehouse_id"})

    try:
        user = User.objects.get(id=user_id, role='User')  # Restrict only to 'User' role
        warehouse = Warehouse.objects.get(id=warehouse_id)
    except User.DoesNotExist:
        return Response({"status": "error", "message": "User not found or not allowed"})
    except Warehouse.DoesNotExist:
        return Response({"status": "error", "message": "Warehouse not found"})

    if action == "add":
        try:
            UserWarehouse.objects.create(user=user, warehouse=warehouse)
            return Response({"status": "success", "message": "User linked to warehouse"})
        except IntegrityError:
            return Response({"status": "error", "message": "This user is already linked to this warehouse"})

    elif action == "remove":
        deleted, _ = UserWarehouse.objects.filter(user=user, warehouse=warehouse).delete()
        if deleted:
            return Response({"status": "success", "message": "User unlinked from warehouse"})
        else:
            return Response({"status": "error", "message": "No matching link found"})

    else:
        return Response({"status": "error", "message": "Invalid action"})
    
from django.http import JsonResponse
from django.db import connection
from rest_framework.decorators import api_view
from .models import Product
from datetime import datetime

def add_dynamic_column(date_str):
    column_name = f'quantity_{date_str}'
    with connection.cursor() as cursor:
        try:
            cursor.execute(f'''
                ALTER TABLE `Product`
                ADD COLUMN `{column_name}` INTEGER DEFAULT 0;
            ''')
            print(f"✅ Column `{column_name}` added.")
        except Exception as e:
            print(f"⚠️ Column might already exist or failed: {e}")



def update_dynamic_quantity(product_name, date_str, quantity, company_id):
    # Normalize quantity: convert to int safely
    try:
        quantity = int(quantity)
    except (TypeError, ValueError):
        quantity = 0

    column_name = f'quantity_{date_str}'  # e.g. quantity_2025-04-19

    with connection.cursor() as cursor:
        # Step 1: Fetch current value
        cursor.execute(f'''
            SELECT `{column_name}` FROM `Product`
            WHERE product_name = %s AND company_id = %s;
        ''', [product_name, company_id])
        result = cursor.fetchone()
        current_value = result[0] if result else None

        print(f"▶️ {product_name} (company {company_id}): current = {current_value}, incoming = {quantity}")

        # Step 2: Compare and update if value changed
        if current_value != quantity:
            cursor.execute(f'''
                UPDATE `Product`
                SET `{column_name}` = %s, updated_at = NOW()
                WHERE product_name = %s AND company_id = %s;
            ''', [quantity, product_name, company_id])
            print(f"✅ Updated `{product_name}` → {column_name} = {quantity} for company {company_id}")
            return True

    return False



def check_column_exists(date_str):
    column_name = f'quantity_{date_str.replace("-", "-")}'
    with connection.cursor() as cursor:
        cursor.execute(f"SHOW COLUMNS FROM `Product` LIKE %s;", [column_name])
        result = cursor.fetchone()
    return bool(result)  # Returns True if column exists, False otherwise


from rest_framework.permissions import IsAuthenticated
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_product_quantities(request):
    data = request.data.get('data', [])
    date = request.data.get('date')
    company_id = request.data.get('company_id')

    if not date or not data:
        return JsonResponse({"status": "error", "message": "Missing date or data."}, status=400)

    if not company_id:
        return JsonResponse({"status": "error", "message": "Missing company ID."}, status=400)

    try:
        company = Company.objects.get(id=company_id)
    except Company.DoesNotExist:
        return JsonResponse({"status": "error", "message": "Invalid company ID."}, status=400)

    if not check_column_exists(date):
        add_dynamic_column(date)

    total_records = 0
    updated_records = 0
    new_records = 0
    product_details = {}

    # Store the last occurrence of each product
    last_occurrences = {}

    for item in data:
        product_name = (
            item.get('productName') or
            item.get('Product Name') or
            item.get('product_name')
        )
        quantity = (
            item.get('quantity') or
            item.get('Quantity') or
            item.get('qty')
        )

        if not product_name:
            continue

        try:
            quantity = int(quantity)
        except (TypeError, ValueError):
            quantity = 0

        last_occurrences[normalize_product_name(product_name)] = quantity

    for product_name, quantity in last_occurrences.items():
        product, created = get_or_create_normalized_product(
            company,
            product_name,
            created_by=request.user,
        )
        
        if not created and product.created_by is None:
            # Update created_by if missing (be careful with this)
            product.created_by = request.user
            product.save(update_fields=['created_by'])

        if created:
            new_records += 1
        else:
            was_updated = update_dynamic_quantity(product.product_name, date, quantity, company.id)
            if was_updated:
                updated_records += 1

        total_records += 1

        # Add product details to response
        product_details[product_name] = {
            "id": product.id,
            "created_by_id": product.created_by_id,
            "company_id": product.company_id,
            "quantity":quantity
        }

    return JsonResponse({
        "status": "success",
        "message": f"Data for {date} uploaded.",
        "total_records": total_records,
        "updated_records": updated_records,
        "new_records": new_records,
        "products": product_details  # ✅ Include product info with IDs
    })



from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from .models import Product, Company
from django.db import connection

@csrf_exempt
@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def sync_product_quantities(request):
    company_id = request.data.get('company_id')
    date = request.data.get('date')

    if not company_id or not date:
        return JsonResponse({"status": "error", "message": "Missing company ID or date."}, status=400)

    try:
        company = Company.objects.get(id=company_id)
    except Company.DoesNotExist:
        return JsonResponse({"status": "error", "message": "Invalid company ID."}, status=400)

    # Ensure dynamic column exists
    if not check_column_exists(date):
        add_dynamic_column(date)

    # Fetch data from Tally DB
    sql = """
    WITH item_movements AS (
        SELECT 
            vit.itemguid,
            SUM(CAST(REPLACE(vit.quantity, ',', '') AS DECIMAL(18,6))) AS movements_quantity
        FROM voucher_inventory_transaction vit
        JOIN voucher_master vm ON vit.masterid = vm.masterid
        JOIN voucher_type_master vtm ON vm.vouchertypeguid = vtm.guid
        WHERE vtm.name IN (
            'Purchase','DC PURCHASE','Sales Return','Credit Note',
            'Retail Sales','DC SALES','DEBIT NOTES','Tax Sales',
            'Stock Journal','Physical Stock','DC'
        )
        GROUP BY vit.itemguid
    )
    SELECT 
        sim.name AS item_name,
        sim.guid AS itemguid,
        CAST(REPLACE(sim.opbalance, ',', '') AS DECIMAL(18,6)) AS opening_quantity,
        COALESCE(im.movements_quantity,0) AS movements_quantity,
        CAST(REPLACE(sim.opbalance, ',', '') AS DECIMAL(18,6)) + COALESCE(im.movements_quantity,0) AS closing_quantity
    FROM stock_item_master sim
    LEFT JOIN item_movements im ON sim.guid = im.itemguid
    ORDER BY sim.name;
    """

    with connections['tally'].cursor() as cursor:
        cursor.execute(sql)
        rows = cursor.fetchall()
        col_names = [col[0] for col in cursor.description]

    total_records = 0
    new_records = 0
    updated_records = 0
    product_details = {}

    # Update each product
    for row in rows:
        row_data = dict(zip(col_names, row))
        product_name = row_data['item_name']
        closing_quantity = row_data['closing_quantity'] or 0

        if not product_name:
            continue

        # Ensure product exists or create (match by normalized name)
        product, created = get_or_create_normalized_product(
            company,
            product_name,
            created_by=request.user,
        )

        # Ensure created_by is set
        if not created and product.created_by is None:
            product.created_by = request.user
            product.save(update_fields=['created_by'])

        # Update dynamic quantity
        if not created and update_dynamic_quantity(product.product_name, date, closing_quantity, company.id):
            updated_records += 1
        elif created:
            new_records += 1

        total_records += 1

        product_details[product_name] = {
            "id": product.id,
            "created_by_id": product.created_by_id,
            "company_id": product.company_id,
            "closing_quantity": closing_quantity
        }

    return JsonResponse({
        "status": "success",
        "message": f"Stock data synced for {date}.",
        "total_records": total_records,
        "new_records": new_records,
        "updated_records": updated_records,
        "products": product_details
    })



from datetime import datetime
from django.http import JsonResponse
from django.db import connection
from .models import Product  # Adjust the import based on your app structure

def check_column_exists(date_str):
    # Directly use the date_str to form the column name
    column_name = f'quantity_{date_str}'
    print(f"Checking for column: {column_name}")

    with connection.cursor() as cursor:
        query = "SHOW COLUMNS FROM Product LIKE %s;"
        print(f"Executing query: {query} with params: {[column_name]}")
        cursor.execute(query, [column_name])
        result = cursor.fetchone()

    if result:
        print(f"Column {column_name} found!")
    else:
        print(f"Column {column_name} not found.")

    return bool(result)

def check_file_uploaded(request, date):
    print(f"Received date: {date}")

    # Convert the provided date string to a datetime object
    try:
        date_obj = datetime.strptime(date, "%Y-%m-%d")
        print(f"Parsed date: {date_obj}")
    except ValueError:
        return JsonResponse({"status": "error", "message": "Invalid date format."}, status=400)

    # Check if the column exists for the given date
    column_exists = check_column(date)
    print(f"Column exists for {date}: {column_exists}")

    if not column_exists:
        return JsonResponse({"status": "error", "message": f"Column for the date {date} does not exist."}, status=400)

    # Check if the file was uploaded (check the product's created_at date)
    existing_file = Product.objects.filter(created_at__date=date_obj).exists()

    if existing_file:
        return JsonResponse({'status': 'success'})
    else:
        return JsonResponse({'status': 'failure'})



from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .models import ProductStock, Product, Warehouse
from .serializers import ProductStockSerializer
from datetime import date
from datetime import datetime
import pytz

IST = pytz.timezone('Asia/Kolkata')

@api_view(['GET'])
def get_stock_by_warehouse(request):
    warehouse_id = request.GET.get('warehouse_id')

    # Always use current date in IST
    now_ist = datetime.now(IST).date()

    stocks = ProductStock.objects.filter(warehouse_id=warehouse_id, date=now_ist)
    serializer = ProductStockSerializer(stocks, many=True)
    return Response(serializer.data)

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from datetime import datetime
from pytz import timezone
from .models import ProductStock, Product
from .serializers import ProductStockSerializer

IST = timezone('Asia/Kolkata')

@api_view(['POST'])
def update_stock(request):
    data = request.data
    product_id = data.get('product_id')
    warehouse_id = data.get('warehouse_id')
    quantity = data.get('quantity')

    if not (product_id and warehouse_id and quantity is not None):
        return Response({"error": "product_id, warehouse_id, and quantity are required."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        product = Product.objects.get(pk=product_id)
    except Product.DoesNotExist:
        return Response({"error": "Product not found."}, status=status.HTTP_404_NOT_FOUND)

    now_ist = datetime.now(IST).date()  # Use IST date, ignore user date input

    stock, created = ProductStock.objects.update_or_create(
        product_id=product_id,
        warehouse_id=warehouse_id,
        date=now_ist,
        defaults={
            'quantity': quantity,
            'company_id': product.company_id,  # Set company from product
        }
    )
    return Response(ProductStockSerializer(stock).data, status=status.HTTP_200_OK)



from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .models import ProductStock, Product
from datetime import datetime
from django.db.models import Max

@api_view(['GET'])
def get_current_and_previous_stock(request):
    warehouse_id = request.GET.get('warehouse_id')
    stock_date_str = request.GET.get('date')

    if not warehouse_id or not stock_date_str:
        return Response({'error': 'warehouse_id and date are required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        stock_date = datetime.strptime(stock_date_str, '%Y-%m-%d').date()
    except ValueError:
        return Response({'error': 'Invalid date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

    products = Product.objects.filter(
        warehouses__id=warehouse_id,
        is_active=True,
    ).distinct()

    # ✅ Find latest previous date with any stock entry before stock_date
    previous_date = ProductStock.objects.filter(
        warehouse_id=warehouse_id,
        date__lt=stock_date
    ).aggregate(latest=Max('date'))['latest']

    # Build a map of previous stock (if date exists)
    previous_stock_map = {}
    if previous_date:
        prev_stocks = ProductStock.objects.filter(
            warehouse_id=warehouse_id,
            date=previous_date
        )
        previous_stock_map = {ps.product_id: ps.quantity for ps in prev_stocks}

    # Get current stock in a map
    current_stocks = ProductStock.objects.filter(
        warehouse_id=warehouse_id,
        date=stock_date
    )
    current_stock_map = {ps.product_id: ps.quantity for ps in current_stocks}

    response_data = []
    for product in products:
        response_data.append({
            'product_id': product.id,
            'product_name': product.product_name,
            'current_quantity': current_stock_map.get(product.id),
            'previous_quantity': previous_stock_map.get(product.id),
            'previous_date': previous_date
        })

    return Response(response_data, status=status.HTTP_200_OK)




from datetime import datetime
import pytz
from rest_framework.decorators import api_view
from rest_framework.response import Response

@api_view(['GET'])
def get_today_date(request):
    ist = pytz.timezone("Asia/Kolkata")
    now_ist = datetime.now(ist).date()
    return Response({"today": now_ist.isoformat()})


from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Role
from .serializers import RoleSerializer

@api_view(['GET'])
def get_roles(request):
    user = request.user

    # Get all roles
    roles = Role.objects.all().order_by('role')

    # If the user is not a techadmin, exclude the superadmin role
    if user.role.lower() != 'techadmin':
        roles = roles.exclude(role__iexact='superadmin')

    serializer = RoleSerializer(roles, many=True)
    return Response(serializer.data)


from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .models import ShowPrevDateSetting
from .serializers import ShowPrevDateSettingSerializer

class ShowPrevDateSettingView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        settings = ShowPrevDateSetting.objects.all()
        serializer = ShowPrevDateSettingSerializer(settings, many=True)
        return Response(serializer.data)

    def post(self, request):
        user = request.user
        if not hasattr(user, "role") or user.role != "superadmin":
            return Response({"error": "Only superadmin can update settings."}, status=status.HTTP_403_FORBIDDEN)

        name = request.data.get("name")
        show = request.data.get("show")

        if name is None or show is None:
            return Response({"error": "Both 'name' and 'show' fields are required."}, status=status.HTTP_400_BAD_REQUEST)

        def str_to_bool(value):
            return str(value).lower() in ["true", "1", "yes"]

        try:
            setting, created = ShowPrevDateSetting.objects.get_or_create(name=name)
            setting.show = str_to_bool(show)
            setting.save()
            return Response({
                "success": True,
                "created": created,
                "setting": ShowPrevDateSettingSerializer(setting).data
            })
        except Exception as e:
            return Response({"error": f"An error occurred: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



from collections import defaultdict
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
from django.db import connection
from .models import Product, ProductStock
import re

import re
from datetime import datetime
from collections import defaultdict
from django.db import connection
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from api.models import Product, ProductStock, Warehouse

def generate_column_name(date_str):
    return f"quantity_{re.sub(r'[^0-9a-zA-Z]', '-', date_str)}"

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def get_product_stock_overview(request):
    selected_warehouses = request.data.get('warehouse_ids', [])

    if not selected_warehouses:
        return Response({'success': False, 'message': 'No warehouses selected.'}, status=400)

    current_date = timezone.now().date()
    selected_warehouses = [int(w_id) for w_id in selected_warehouses]

    # --- Get latest ProductStock date before today PER WAREHOUSE ---
    warehouse_prev_date_map = {
        w.id: (
            ProductStock.objects
            .filter(warehouse_id=w.id, date__lt=current_date)
            .order_by('-date')
            .values_list('date', flat=True)
            .first()
        )
        for w in Warehouse.objects.filter(id__in=selected_warehouses)
    }

    # --- Build stock_map using per-product-per-warehouse logic ---
    stock_map = defaultdict(lambda: defaultdict(dict))

    for product in Product.objects.filter(is_active=True):
        for warehouse_id in selected_warehouses:
            prev_date = warehouse_prev_date_map.get(warehouse_id)
            for date in [current_date, prev_date]:
                if not date:
                    continue
                stock_entry = ProductStock.objects.filter(
                    product_id=product.id,
                    warehouse_id=warehouse_id,
                    date=date
                ).first()
                if stock_entry:
                    stock_map[product.id][warehouse_id][date] = stock_entry.quantity

    # --- Get available dynamic quantity columns from Product table ---
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT COLUMN_NAME FROM information_schema.columns
            WHERE table_name = 'Product' AND table_schema = DATABASE()
              AND COLUMN_NAME LIKE 'quantity_%'
        """)
        available_columns = [row[0] for row in cursor.fetchall()]

    # Extract and sort the dynamic column dates
    dynamic_column_dates = []
    for col in available_columns:
        match = re.match(r'quantity_(\d{4}-\d{2}-\d{2})', col)
        if match:
            try:
                dynamic_column_dates.append(datetime.strptime(match.group(1), "%Y-%m-%d").date())
            except:
                continue

    dynamic_column_dates = sorted(dynamic_column_dates)
    dynamic_prev_date = None
    for d in reversed(dynamic_column_dates):
        if d < current_date:
            dynamic_prev_date = d
            break

    col_current = generate_column_name(str(current_date))
    col_prev = generate_column_name(str(dynamic_prev_date)) if dynamic_prev_date else None

    dynamic_cols = ['id', 'product_name']
    has_prev_col = col_prev in available_columns
    has_curr_col = col_current in available_columns

    if has_prev_col:
        dynamic_cols.append(col_prev)
    if has_curr_col:
        dynamic_cols.append(col_current)

    # --- Fetch dynamic columns from Product table (active products only) ---
    with connection.cursor() as cursor:
        col_str = ', '.join(f"`{col}`" for col in dynamic_cols)
        cursor.execute(f"SELECT {col_str} FROM `Product` WHERE `is_active` = 1")
        rows = cursor.fetchall()

    # Map product_id → dynamic stock info
    product_data = {}
    for row in rows:
        product_id = row[0]
        product_name = row[1]
        idx = 2

        prev_qty = row[idx] if has_prev_col else 0
        if has_prev_col:
            idx += 1
        curr_qty = row[idx] if has_curr_col else 0

        product_data[product_id] = {
            'product_name': product_name,
            'dynamic_prev_stock': prev_qty,
            'dynamic_current_stock': curr_qty
        }

    # --- Build the response ---
    response_products = []

    for product_id, data in product_data.items():
        total_prev = 0
        total_current = 0
        warehouses_data = {}

        for w_id in selected_warehouses:
            prev_date = warehouse_prev_date_map.get(w_id)

            prev_qty = stock_map[product_id].get(w_id, {}).get(prev_date, 0) if prev_date else 0
            curr_qty = stock_map[product_id].get(w_id, {}).get(current_date, 0)

            total_prev += prev_qty or 0
            total_current += curr_qty or 0

            warehouses_data[str(w_id)] = {
                'prev_stock': prev_qty,
                'current_stock': curr_qty
            }

        response_products.append({
            'product_id': product_id,
            'product_name': data['product_name'],
            'total_prev_stock': total_prev,
            'total_current_stock': total_current,
            'stock_difference': total_current - total_prev,
            'warehouses': warehouses_data,
            'dynamic_column_stock': {
                col_prev if has_prev_col else '': data['dynamic_prev_stock'],
                col_current if has_curr_col else '': data['dynamic_current_stock']
            }
        })

    return Response({
        'success': True,
        'product_stock_prev_date': {
            str(k): str(v) for k, v in warehouse_prev_date_map.items() if v
        },
        'product_table_prev_date': str(dynamic_prev_date) if dynamic_prev_date else None,
        'current_date': str(current_date),
        'products': response_products
    })



from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import connection

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def remove_product_column_or_stock(request):
    date_str = request.data.get('date')
    warehouse_id = request.data.get('warehouse_id')
    action = request.data.get('action')
    company_id = request.data.get('company_id')

    # Validate required fields
    if not date_str or not action:
        return Response({"error": "Both 'date' and 'action' are required."}, status=400)
    if not company_id:
        return Response({"error": "'company_id' is required."}, status=400)

    user = request.user

    # Check if the user is authorized for the company
    if user.role != "superadmin" and int(company_id) not in [c.id for c in user.companies.all()]:
        return Response({"error": "Unauthorized company access."}, status=403)

    if action == "Tally":
        if user.role != "superadmin":
            return Response({"error": "Only superadmins can modify Tally data."}, status=403)

        column_name = f"quantity_{date_str}"

        with connection.cursor() as cursor:
            # Check if the column exists
            cursor.execute("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'Product' AND column_name = %s
            """, [column_name])
            exists = cursor.fetchone()

            if not exists:
                return Response({"error": f"Column '{column_name}' does not exist."}, status=404)

            try:
                # Set values to NULL
                cursor.execute(
                    f"""UPDATE `Product` SET `{column_name}` = NULL WHERE `company_id` = %s""",
                    [company_id]
                )
                affected = cursor.rowcount
            except Exception as e:
                return Response({"error": str(e)}, status=500)

        return Response({"message": f"Reset '{column_name}' to NULL for {affected} products."})

    elif action == "Count":
        if not warehouse_id:
            return Response({"error": "'warehouse_id' is required for 'Count' action."}, status=400)

        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    UPDATE `product_stocks`
                    SET `quantity` = NULL
                    WHERE `warehouse_id` = %s AND `date` = %s AND `company_id` = %s
                """, [warehouse_id, date_str, company_id])
                
                rows_affected = cursor.rowcount

                if rows_affected == 0:
                    return Response({"error": "No data found for the given warehouse, date, and company."}, status=404)

            return Response({"message": f"Data for warehouse ID {warehouse_id} on {date_str} removed successfully."})
        except Exception as e:
            return Response({"error": str(e)}, status=500)

    return Response({"error": "Invalid action or missing parameters."}, status=400)


from django.http import JsonResponse
from django.db import connection

def check_existing_upload(request, date):
    column_name = f'quantity_{date}'

    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'Product'
        """)
        columns = [row[0] for row in cursor.fetchall()]

    column_exists = column_name in columns

    return JsonResponse({'exists': column_exists})





# views.py
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from api.models import User
from rest_framework import status
from django.contrib.auth.hashers import make_password

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_superadmins(request):
    if request.user.role != 'techadmin':
        return Response({'detail': 'Unauthorized'}, status=403)
    
    users = User.objects.filter(role='superadmin')
    data = [{"id": u.id, "username": u.username, "first_name": u.first_name, "last_name": u.last_name} for u in users]
    return Response(data)
from django.contrib.auth import get_user_model

User = get_user_model()

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_superadmin(request):
    if request.user.role != 'techadmin':
        return Response({'detail': 'Unauthorized'}, status=403)

    data = request.data
    if User.objects.filter(username=data['username']).exists():
        return Response({'error': 'Username already exists'}, status=400)

    try:
        user = User.objects.create(
            username=data['username'],
            password=make_password(data['password']),
            first_name=data.get('first_name', ''),
            last_name=data.get('last_name', ''),
            role='superadmin'
        )
        return Response({'message': 'Superadmin created'}, status=status.HTTP_201_CREATED)
    except Exception as e:
        return Response({'error': str(e)}, status=400)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_superadmin(request, user_id):
    if request.user.role != 'techadmin':
        return Response({'detail': 'Unauthorized'}, status=403)

    try:
        user = User.objects.get(id=user_id, role='superadmin')
    except User.DoesNotExist:
        return Response({'error': 'Superadmin not found'}, status=404)

    data = request.data
    user.username = data.get('username', user.username)
    user.first_name = data.get('first_name', user.first_name)
    user.last_name = data.get('last_name', user.last_name)
    if data.get('password'):
        user.password = make_password(data['password'])

    if User.objects.exclude(id=user.id).filter(username=user.username).exists():
        return Response({'error': 'Username already exists'}, status=400)

    user.save()
    return Response({'message': 'Superadmin updated'})



@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_superadmin(request, user_id):
    if request.user.role != 'techadmin':
        return Response({'detail': 'Unauthorized'}, status=403)

    try:
        user = User.objects.get(id=user_id, role='superadmin')
        user.delete()
        return Response({'message': 'Superadmin deleted'})
    except User.DoesNotExist:
        return Response({'error': 'Superadmin not found'}, status=404)
    

    
import re
from collections import defaultdict
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import connection
from api.models import Product, ProductStock, Warehouse


def generate_column_name(date_str):
    return f"quantity_{date_str}"

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def get_selected_prev_date_stock(request):
    try:
        selected_date = request.data.get('selected_date')
        selected_warehouses = request.data.get('warehouse_ids', [])

        if not selected_date:
            return JsonResponse({'success': False, 'message': 'Selected date is required'}, status=400)

        if not selected_warehouses:
            return JsonResponse({'success': False, 'message': 'At least one warehouse must be selected'}, status=400)

        # Ensure warehouse IDs are integers
        selected_warehouses = [int(w_id) for w_id in selected_warehouses]
        formatted_col_name = generate_column_name(selected_date)

        # Check for dynamic column in product table
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT COLUMN_NAME FROM information_schema.columns
                WHERE table_name = 'Product' AND table_schema = DATABASE()
                  AND COLUMN_NAME LIKE 'quantity_%%'
            """)
            available_columns = [row[0] for row in cursor.fetchall()]

        has_prev_col = formatted_col_name in available_columns
        col_prev = formatted_col_name if has_prev_col else ''

        # Fetch product basic data + dynamic column
        dynamic_cols = ['id', 'product_name']
        if has_prev_col:
            dynamic_cols.append(formatted_col_name)

        col_str = ', '.join(f"`{col}`" for col in dynamic_cols)
        with connection.cursor() as cursor:
            cursor.execute(f"SELECT {col_str} FROM Product WHERE `is_active` = 1")
            product_rows = cursor.fetchall()

        product_data = {}
        for row in product_rows:
            product_id = row[0]
            product_name = row[1]
            dynamic_prev_stock = row[2] if has_prev_col else 0
            product_data[product_id] = {
                'product_name': product_name,
                'dynamic_prev_stock': dynamic_prev_stock
            }

        # Fetch product stock entries for selected warehouse(s) + date
        stock_map = defaultdict(lambda: defaultdict(int))
        stock_entries = ProductStock.objects.filter(
            warehouse_id__in=selected_warehouses,
            date=selected_date
        )

        for stock in stock_entries:
            stock_map[stock.product_id][stock.warehouse_id] += stock.quantity

        # Ensure every product has data, even if quantity is 0
        response_products = []
        for product_id, data in product_data.items():
            total_prev = 0
            warehouses_data = {}

            for w_id in selected_warehouses:
                prev_qty = stock_map[product_id].get(w_id, 0)
                total_prev += prev_qty
                warehouses_data[str(w_id)] = {
                    'prev_stock': prev_qty,
                    'selected_stock': prev_qty
                }

            response_products.append({
                'product_id': product_id,
                'product_name': data['product_name'],
                'total_prev_stock': total_prev,
                'stock_difference': -total_prev,
                'warehouses': warehouses_data,
                'dynamic_column_stock': {
                    col_prev: data['dynamic_prev_stock'] if has_prev_col else 0
                }
            })

        return Response({
            'success': True,
            'product_stock_prev_date': {str(w_id): selected_date for w_id in selected_warehouses},
            'product_table_prev_date': str(selected_date),
            'products': response_products
        })

    except Exception as e:
        return Response({'success': False, 'message': str(e)}, status=500)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def change_password(request):
    user = request.user  # Get the currently authenticated user

    current_password = request.data.get('current_password')
    new_password = request.data.get('new_password')

    if not current_password or not new_password:
        return Response({'error': 'Both current and new passwords are required'}, status=400)

    if not user.check_password(current_password):
        return Response({'error': 'Current password is incorrect'}, status=400)

    user.set_password(new_password)
    user.save()
    return Response({'success': 'Password updated successfully'})


from rest_framework import viewsets
from .models import Company
from .serializers import CompanySerializer

class CompanyViewSet(viewsets.ModelViewSet):
    queryset = Company.objects.all()
    serializer_class = CompanySerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context.update({"request": self.request})
        return context




# views.py
from django.http import JsonResponse
from django.http import JsonResponse
from django.db import connections  # ✅ this line is required
from django.views.decorators.http import require_GET

from django.views.decorators.http import require_GET

from django.http import JsonResponse
from django.db import connections
from django.views.decorators.http import require_GET

from django.http import JsonResponse
from django.views.decorators.http import require_GET
from django.db import connections
from django.http import JsonResponse
from django.db import connections
from django.views.decorators.http import require_GET
from collections import defaultdict

from django.http import JsonResponse
from django.views.decorators.http import require_GET
from collections import defaultdict
from django.db import connections

from collections import defaultdict
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from django.db import connections

from datetime import datetime, timedelta
from django.utils.timezone import now
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

@csrf_exempt
@require_http_methods(["GET", "POST"])
def report_dashboard(request, id=None):
    if request.method == "POST":
        try:
            request_data = json.loads(request.body)
        except Exception as e:
            return JsonResponse({"error": "Invalid JSON body"}, status=400)
    else:
        request_data = request.GET
    # Filters
    city = request_data.get("city", [])
    product = request_data.get("product", [])
    sales_person = request_data.get("salesPerson", [])
    vouchertype = request_data.get("vouchertype", [])
    vouchernumber = request_data.get("vouchernumber", [])
    client = request_data.get("client", [])
    duration = request_data.get("duration", "")
    search = request_data.get("search", "")
    duration_period = request_data.get("durationPeriod", "").lower()
    row_header_raw = request_data.get("rowHeader", "").strip().lower()
    column_header_raw = request_data.get("columnHeader", "").strip().lower()
    row_values = request_data.get("rowValues", [])
    col_values = request_data.get("columnValues", [])
    view_type = request_data.get("viewType", "currency").lower()

    


    # Headers for pivot table
    view_type = request_data.get("viewType", "currency").lower()
    value_field = "amount" if view_type == "currency" else "quantity"

    row_header_raw = request_data.get("rowHeader", "").strip().lower()
    column_header_raw = request_data.get("columnHeader", "").strip().lower()


    # Map frontend label to backend field
    FIELD_MAP = {
    "sales person": "salesPerson",
    "city": "city",
    "products": "product",
    "duration": "date",
    "client": "client",
    "voucher type": "vouchertype",
    "voucher": "vouchernumber",
}


    if row_header_raw not in FIELD_MAP or column_header_raw not in FIELD_MAP:
        return JsonResponse({"error": "Invalid row or column header"}, status=400)

    row_field = FIELD_MAP[row_header_raw]
    col_field = FIELD_MAP[column_header_raw]
    row_header_label = request.GET.get("rowHeader", "Row Header")
    col_header_label = request.GET.get("columnHeader", "Column Header")
    # New: Selected dropdown values for filtering (row/col header values)
    row_values = request_data.get("rowValues")
    col_values = request_data.get("columnValues")

    def normalize_value(field, val):
        if field == "city":
            return val.strip().upper()
        return val.strip()

    row_values = [normalize_value(row_field, v) for v in row_values]
    col_values = [normalize_value(col_field, v) for v in col_values]

    def resolve_field(field):
        field_map_sql = {
            "city": "TRIM(SUBSTRING_INDEX(vm.partyledger, '-', -1))",
            "salesPerson": "vm.vchsalesman",
            "product": "sim.name",
            "client": "vm.partyledger",
            "vouchertype": "vm.vouchertype",
            "vouchernumber": "vm.vouchernumber",
            "date": "vm.date"
        }
        resolved = field_map_sql.get(field)
        if not resolved:
            print(f"❌ Unknown field: {field}")
            return None
        return resolved
    
    row_field = FIELD_MAP.get(row_header_raw)
    col_field = FIELD_MAP.get(column_header_raw)

    if not row_field or not col_field:
        return JsonResponse({"error": "Invalid row or column header"}, status=400)

    if not resolve_field(row_field) or not resolve_field(col_field):
        return JsonResponse({"error": "Cannot resolve field mappings"}, status=500)


    # ✅ If no row/col values are passed, fetch all possible values for that header
    with connections['tally'].cursor() as cursor:
        if not row_values:
            try:
                cursor.execute(f"""
                    SELECT DISTINCT {resolve_field(row_field)} 
                    FROM tally_sync_atpl_xihth.voucher_master vm 
                    LEFT JOIN tally_sync_atpl_xihth.voucher_inventory_transaction vit ON vm.guid = vit.guid 
                    LEFT JOIN tally_sync_atpl_xihth.stock_item_master sim ON TRIM(vit.itemname) = TRIM(sim.name)
                    WHERE {resolve_field(row_field)} IS NOT NULL
                """)
                row_values = [normalize_value(row_field, r[0]) for r in cursor.fetchall() if r[0]]
            except Exception as e:
                print("⚠️ Error auto-fetching rowValues:", e)



        if not col_values:
            try:
                cursor.execute(f"""
                    SELECT DISTINCT {resolve_field(col_field)} 
                    FROM tally_sync_atpl_xihth.voucher_master vm 
                    LEFT JOIN tally_sync_atpl_xihth.voucher_inventory_transaction vit ON vm.guid = vit.guid 
                    LEFT JOIN tally_sync_atpl_xihth.stock_item_master sim ON TRIM(vit.itemname) = TRIM(sim.name)
                    WHERE {resolve_field(col_field)} IS NOT NULL
                """)
                col_values = [normalize_value(col_field, r[0]) for r in cursor.fetchall() if r[0]]
            except Exception as e:
                print("⚠️ Error auto-fetching columnValues:", e)


    # Decide query based on whether voucher-specific fields are selected
    if row_field in ["client", "vouchertype", "vouchernumber"] or col_field in ["client", "vouchertype", "vouchernumber"]:
        query = """
    SELECT 
       cm.name AS company,
       vm.vouchernumber,
       vm.date,
       vm.vouchertype,
       vm.partyledger AS client,
       vm.vchsalesman AS salesPerson,
       vit.itemname AS product,
       vit.quantity,
       vit.rate,
       vit.amount AS amount,
       '' AS uom
   FROM tally_sync_atpl_xihth.voucher_master vm
   JOIN tally_sync_atpl_xihth.company_master cm 
       ON cm.cmpguid = vm.cmpguid
   JOIN tally_sync_atpl_xihth.voucher_inventory_transaction vit 
       ON vit.masterid = vm.masterid
   WHERE vit.itemname IS NOT NULL


        """
    
    
    else:
        query = """
        SELECT 
            TRIM(SUBSTRING_INDEX(vm.partyledger, '-', -1)) AS city,
            vm.vchsalesman AS salesPerson,
            sim.name AS product,
            sim.uom AS uom,
            vit.quantity,
            vit.amount,
            vm.date
        FROM 
            tally_sync_atpl_xihth.voucher_master vm
        JOIN 
            tally_sync_atpl_xihth.voucher_inventory_transaction vit 
            ON vm.guid = vit.guid
        JOIN 
            tally_sync_atpl_xihth.stock_item_master sim 
            ON TRIM(vit.itemname) = TRIM(sim.name)
        WHERE 
            vm.vchsalesman IS NOT NULL
            AND vm.partyledger LIKE '%%-%%'
            AND sim.name IS NOT NULL"""
        
     # Make sure row_field and col_field are in the SELECT list
    # Force row_field and col_field into SELECT if not present
   # Force row_field and col_field into SELECT if not present
    needed_fields = {row_field, col_field}
    for field in needed_fields:
        resolved = resolve_field(field)
        alias_clause = f"{resolved} AS {field}"
        if alias_clause not in query:
            query = query.replace("SELECT", f"SELECT {alias_clause},", 1)

# ✅ Always add vm.date as `date`
    if "vm.date AS date" not in query:
        query = query.replace("SELECT", "SELECT vm.date AS date,", 1)


    
    filters = []
    params = []

    if row_values:
        placeholders = ','.join(['%s'] * len(row_values))
        filters.append(f"AND {resolve_field(row_field)} IN ({placeholders})")
        params.extend(row_values)

    if col_values:
        placeholders = ','.join(['%s'] * len(col_values))
        filters.append(f"AND {resolve_field(col_field)} IN ({placeholders})")
        params.extend(col_values)


    if city:
            placeholders = ','.join(['%s'] * len(city))
            filters.append(f"AND TRIM(SUBSTRING_INDEX(vm.partyledger, '-', -1)) IN ({placeholders})")
            params.extend(city)

    if product:
            placeholders = ','.join(['%s'] * len(product))
            filters.append(f"AND sim.name IN ({placeholders})")
            params.extend(product)

    if sales_person:
            placeholders = ','.join(['%s'] * len(sales_person))
            filters.append(f"AND vm.vchsalesman IN ({placeholders})")
            params.extend(sales_person)

    if vouchertype:
            placeholders = ','.join(['%s'] * len(vouchertype))
            filters.append(f"AND vm.vouchertype IN ({placeholders})")
            params.extend(vouchertype)

    if vouchernumber:
            placeholders = ','.join(['%s'] * len(vouchernumber))
            filters.append(f"AND vm.vouchernumber IN ({placeholders})")
            params.extend(vouchernumber)

    if client:
            placeholders = ','.join(['%s'] * len(client))
            filters.append(f"AND vm.partyledger IN ({placeholders})")
            params.extend(client)

    if duration and duration.strip():
        duration = duration.strip()

        today = now().date()

        if duration == "today":
                filters.append("AND vm.date = %s")
                params.append(str(today))

        elif duration == "yesterday":
                filters.append("AND vm.date = %s")
                params.append(str(today - timedelta(days=1)))

        elif duration == "this_week":
                start = today - timedelta(days=today.weekday())
                end = start + timedelta(days=6)
                filters.append("AND vm.date BETWEEN %s AND %s")
                params.extend([str(start), str(end)])

        elif duration == "last_week":
                start = today - timedelta(days=today.weekday() + 7)
                end = start + timedelta(days=6)
                filters.append("AND vm.date BETWEEN %s AND %s")
                params.extend([str(start), str(end)])

        elif duration == "last_7_days":
                start = today - timedelta(days=6)
                filters.append("AND vm.date BETWEEN %s AND %s")
                params.extend([str(start), str(today)])

        elif duration == "this_month":
                start = today.replace(day=1)
                end = (start + timedelta(days=32)).replace(day=1) - timedelta(days=1)
                filters.append("AND vm.date BETWEEN %s AND %s")
                params.extend([str(start), str(end)])

        elif duration == "last_month":
                this_month_start = today.replace(day=1)
                end = this_month_start - timedelta(days=1)
                start = end.replace(day=1)
                filters.append("AND vm.date BETWEEN %s AND %s")
                params.extend([str(start), str(end)])

        elif duration == "last_30_days":
                start = today - timedelta(days=29)
                filters.append("AND vm.date BETWEEN %s AND %s")
                params.extend([str(start), str(today)])

        elif duration == "this_year":
                start = today.replace(month=1, day=1)
                end = today.replace(month=12, day=31)
                filters.append("AND vm.date BETWEEN %s AND %s")
                params.extend([str(start), str(end)])

        elif duration == "last_365_days":
                start = today - timedelta(days=364)
                filters.append("AND vm.date BETWEEN %s AND %s")
                params.extend([str(start), str(today)])

        elif "to" in duration:
                # Optional manual range support
                try:
                    start, end = [d.strip() for d in duration.split("to")]
                    filters.append("AND vm.date BETWEEN %s AND %s")
                    params.extend([start, end])
                except Exception as e:
                    print("Manual date parse error:", e)


    if search:
        filters.append("""
            AND (
                vm.vchsalesman LIKE %s OR
                vm.partyledger LIKE %s OR
                sim.name LIKE %s OR
                vm.vouchertype LIKE %s OR
                vm.vouchernumber LIKE %s
            )
        """)
        params.extend([f"%{search}%"] * 5)




    final_query = query + " " + " ".join(filters) 

    with connections['tally'].cursor() as cursor:
            cursor.execute(final_query, params)
            columns = [col[0] for col in cursor.description]
            raw_data = [dict(zip(columns, row)) for row in cursor.fetchall()]

            pivot = defaultdict(dict)
            row_keys = set()
            col_keys = set()
            uom_map = {}

            for row in raw_data:
                def group_date(date_val, period):
                    try:
                        if isinstance(date_val, datetime):
                            dt = date_val
                        elif isinstance(date_val, date):
                            dt = datetime.combine(date_val, datetime.min.time())
                        else:
                            try:
                                dt = datetime.strptime(str(date_val), "%Y-%m-%d")
                            except Exception as e:
                                print("❌ Date parse failed:", date_val, "|", e)
                                return str(date_val)
                    except Exception as e:
                        print("❌ Grouping error:", date_val, "|", e)
                        return str(date_val)

                    if period == "daily":
                        return dt.strftime("%Y-%m-%d")
                    elif period == "weekly":
                        return f"Week {dt.strftime('%U')} ({dt.year})"
                    elif period == "monthly":
                        return dt.strftime("%B %Y")
                    elif period == "yearly":
                        return str(dt.year)
                    elif period == "all":
                        return "All Time"
                    return str(date_val)

                row_val = row.get(row_field)
                col_val = row.get(col_field)


                if row_header_raw == "duration" and duration_period:
                    row_val = group_date(row.get("date", ""), duration_period)

                if column_header_raw == "duration" and duration_period:
                    col_val = group_date(row.get("date", ""), duration_period)


                val = row.get(value_field, 0) or 0
                uom = row.get("uom", "").strip() if row.get("uom") else ""

                if col_val:
                    if view_type == "quantity":
                        uom_map[col_val] = uom
                    pivot[row_val][col_val] = pivot[row_val].get(col_val, 0) + float(val)
                    row_keys.add(row_val)
                    col_keys.add(col_val)

            # Column headers
            final_columns = [{"headerName": row_header_label, "field": "row_key", "type": "text"}]
            for col in sorted(col_keys):
                uom_suffix = f" ({uom_map.get(col, '')})" if view_type == "quantity" else ""
                final_columns.append({
                    "headerName": f"{col}{uom_suffix}",
                    "field": col,
                    "type": "currency" if view_type == "currency" else "number"
                })

            # Table data
            final_data = []
           # ✅ If grouped by duration, ignore row/col filtering
            if row_header_raw == "duration":
                row_keys_final = row_keys
            else:
                row_keys_final = (
                    set([normalize_value(row_field, v) for v in row_values])
                    if row_values else row_keys
                )

            if column_header_raw == "duration":
                col_keys_final = col_keys
            else:
                col_keys_final = (
                    set([normalize_value(col_field, v) for v in col_values])
                    if col_values else col_keys
                )


            
        
            # Ensure all selected combinations are present
            for r in sorted(row_keys_final):
                row_data = {"row_key": r}
                for c in sorted(col_keys_final):
                    val = pivot.get(r, {}).get(c, 0)
                    if view_type == "quantity":
                        unit = uom_map.get(c, "")
                        row_data[c] = f"{int(val)} {unit}" if unit else int(val)
                    else:
                        row_data[c] = round(val, 2)
                final_data.append(row_data)

            # Column headers
            final_columns = [{"headerName": row_header_label, "field": "row_key", "type": "text"}]
            for col in sorted(col_keys_final):
                uom_suffix = f" ({uom_map.get(col, '')})" if view_type == "quantity" else ""
                final_columns.append({
                    "headerName": f"{col}{uom_suffix}",
                    "field": col,
                    "type": "currency" if view_type == "currency" else "number"
                })


            # Fetch dropdown filters
            # Return only selected filters if provided, else fetch all from DB
            def get_selected_or_all(query, selected_list):
                if selected_list:
                    return selected_list
                cursor.execute(query)
                return [row[0] for row in cursor.fetchall() if row[0]]

            # Fetch dropdown filters (selected or all)
            cities = get_selected_or_all(
                "SELECT DISTINCT TRIM(SUBSTRING_INDEX(partyledger, '-', -1)) FROM tally_sync_atpl_xihth.voucher_master WHERE partyledger LIKE '%-%'",
                city
            )
            products = get_selected_or_all(
                "SELECT DISTINCT name FROM tally_sync_atpl_xihth.stock_item_master WHERE name IS NOT NULL",
                product
            )
            salesPersons = get_selected_or_all(
                "SELECT DISTINCT vchsalesman FROM tally_sync_atpl_xihth.voucher_master WHERE vchsalesman IS NOT NULL",
                sales_person
            )
            voucherTypes = get_selected_or_all(
                "SELECT DISTINCT vouchertype FROM tally_sync_atpl_xihth.voucher_master WHERE vouchertype IS NOT NULL",
                vouchertype
            )
            voucherNumbers = get_selected_or_all(
                "SELECT DISTINCT vouchernumber FROM tally_sync_atpl_xihth.voucher_master WHERE vouchernumber IS NOT NULL",
                vouchernumber
            )
            clients = get_selected_or_all(
                "SELECT DISTINCT partyledger FROM tally_sync_atpl_xihth.voucher_master WHERE partyledger IS NOT NULL",
                client
            )

            # Duration is not from DB but based on selected dates
            durations = [duration] if duration else []




    return JsonResponse({
    "columns": final_columns,
    "data": final_data,
    "filters": {
        "cities": cities,
        "products": products,
        "salesPersons": salesPersons,
        "voucherTypes": voucherTypes,
        "vouchers": voucherNumbers,
        "vouchernumber": voucherNumbers,  # for compatibility
        "clients": clients,
        "durations": durations,
    "durationPeriods": ["daily", "weekly", "monthly", "yearly", "all"],
        "rowValues": row_values,
        "columnValues": col_values,
        
    }
}, safe=False)





@require_GET
def report_filters(request):
    with connections['tally'].cursor() as cursor:
        cursor.execute("SELECT DISTINCT TRIM(SUBSTRING_INDEX(partyledger, '-', -1)) FROM tally_sync_atpl_xihth.voucher_master WHERE partyledger LIKE '%-%'")
        cities = [row[0] for row in cursor.fetchall()]

        cursor.execute("SELECT DISTINCT name FROM tally_sync_atpl_xihth.stock_item_master WHERE name IS NOT NULL")
        products = [row[0] for row in cursor.fetchall()]

        cursor.execute("SELECT DISTINCT vchsalesman FROM tally_sync_atpl_xihth.voucher_master WHERE vchsalesman IS NOT NULL")
        sales_persons = [row[0] for row in cursor.fetchall()]

        cursor.execute("SELECT DISTINCT partyledger FROM tally_sync_atpl_xihth.voucher_master WHERE partyledger IS NOT NULL")
        clients = [row[0] for row in cursor.fetchall()]

        cursor.execute("SELECT DISTINCT vouchernumber FROM tally_sync_atpl_xihth.voucher_master WHERE vouchernumber IS NOT NULL")
        vouchers = [row[0] for row in cursor.fetchall()]

        cursor.execute("SELECT DISTINCT vouchertype FROM tally_sync_atpl_xihth.voucher_master WHERE vouchertype IS NOT NULL")
        voucher_types = [row[0] for row in cursor.fetchall()]



        # ✅ Get distinct dates from DB as duration options
        cursor.execute("""
            SELECT DISTINCT DATE(vm.date) 
            FROM tally_sync_atpl_xihth.voucher_master vm 
            WHERE vm.date IS NOT NULL 
            ORDER BY vm.date DESC
        """)
        durations = [row[0].strftime("%Y-%m-%d") for row in cursor.fetchall() if row[0]]


    return JsonResponse({
        "cities": cities,
        "products": products,
        "salesPersons": sales_persons,
        "durations": durations,
        "voucherTypes": voucher_types,
        "clients": clients,
        "vouchers": vouchers,

    })



# views.py
from django.db import connections
from rest_framework.views import APIView
from rest_framework.response import Response

class StateSalesSummaryAPIView(APIView):
    def get(self, request):
        with connections['tally'].cursor() as cursor:
            cursor.execute("""
                SELECT 
                  vm.partystate AS state,
                  SUM(vit.amount) AS total_sales
                FROM 
                  tally_sync_atpl_xihth.voucher_master vm
                JOIN 
                  tally_sync_atpl_xihth.voucher_inventory_transaction vit 
                    ON vm.guid = vit.guid
                JOIN 
                  tally_sync_atpl_xihth.stock_item_master sim 
                    ON TRIM(vit.itemname) = TRIM(sim.name)
                WHERE 
                  vm.vchsalesman IS NOT NULL
                  AND vm.partyledger LIKE '%-%'
                  AND sim.name IS NOT NULL
                GROUP BY vm.partystate
            """)
            columns = [col[0] for col in cursor.description]
            rows = cursor.fetchall()
            data = [dict(zip(columns, row)) for row in rows]
        return Response(data)



from django.db import connections
from rest_framework.views import APIView
from rest_framework.response import Response
from collections import defaultdict


class AllTablesAPIView(APIView):
    def get(self, request):
        result = {"tables": {}, "relations": []}
        cursor = connections['tally'].cursor()

        # Get all tables
        cursor.execute("SHOW TABLES")
        tables = [row[0] for row in cursor.fetchall()]

        for table in tables:
            # Get columns
            cursor.execute(f"SHOW COLUMNS FROM `{table}`")
            columns = [{"field": col[0], "headerName": col[0]} for col in cursor.fetchall()]

            # Get first 50 rows as preview
            cursor.execute(f"SELECT * FROM `{table}` LIMIT 50")
            rows = [dict(zip([col["field"] for col in columns], row)) for row in cursor.fetchall()]

            result["tables"][table] = {
                "columns": columns,
                "data": rows,
            }

        # Get foreign key relationships
        cursor.execute("""
            SELECT
                TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
            FROM
                INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE
                REFERENCED_TABLE_NAME IS NOT NULL
                AND TABLE_SCHEMA = DATABASE()
        """)
        for row in cursor.fetchall():
            result["relations"].append({
                "from": f"{row[0]}.{row[1]}",
                "to": f"{row[2]}.{row[3]}"
            })

        return Response(result)
    

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from .models import SavedReport
from .serializers import SavedReportSerializer

@method_decorator(csrf_exempt, name='dispatch')
class SavedReportListCreateAPIView(APIView):
    def get(self, request):
        reports = SavedReport.objects.all().order_by('-created_at')
        serializer = SavedReportSerializer(reports, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = SavedReportSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@method_decorator(csrf_exempt, name='dispatch')
class SavedReportDetailAPIView(APIView):
    def get_object(self, pk):
        try:
            return SavedReport.objects.get(pk=pk)
        except SavedReport.DoesNotExist:
            return None

    def get(self, request, pk):
        report = self.get_object(pk)
        if not report:
            return Response({'error': 'Not found'}, status=404)
        serializer = SavedReportSerializer(report)
        return Response(serializer.data)

    def put(self, request, pk):
        report = self.get_object(pk)
        if not report:
            return Response({'error': 'Not found'}, status=404)
        serializer = SavedReportSerializer(report, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    def delete(self, request, pk):
        report = self.get_object(pk)
        if not report:
            return Response({'error': 'Not found'}, status=404)
        report.delete()
        return Response(status=204)





from django.http import JsonResponse
from django.views.decorators.http import require_GET

@require_GET
def report_dropdowns(request):
    return JsonResponse({
        "cities": ["Mumbai", "Delhi", "Bangalore"],
        "products": ["Oil", "Ghee", "Soap"],
        "salesPersons": ["Amit", "Raj", "Priya"],
        "clients": ["Client A", "Client B", "Client C"],
        "vouchers": ["VCH123", "VCH456"],
        "voucherTypes": ["Type A", "Type B"],
        "durations": ["Q1", "Q2", "Q3", "Q4"]
    })




from django.http import JsonResponse
from django.db import connections
from django.db.utils import OperationalError

def static_reorder_report(request):
    # Get dynamic months from frontend
    try:
        avg_months = int(request.GET.get("avg_months", 3))
        projection_months = int(request.GET.get("projection_months", 5))
    except (TypeError, ValueError):
        return JsonResponse({"error": "Invalid filter values"}, status=400)

    if not (1 <= avg_months <= 12 and 1 <= projection_months <= 12):
        return JsonResponse({"error": "Months must be between 1 and 12"}, status=400)
    query = f"""
SELECT
    ROW_NUMBER() OVER () AS `Sr No`,
    sim.name AS `Item Name`,
    asm.suppliername AS `Supplier Name`,
    IFNULL(stk.current_stock, 0) AS `Stock`,
    IFNULL(p.pending_qty, 0) AS `Pending Purchase Order`,
    (IFNULL(stk.current_stock, 0) + IFNULL(p.pending_qty, 0)) AS `Total Stock`,
    IFNULL(s.avg_monthly_qty, 0) AS `Avg. Sale`,
    {projection_months} AS `Months`,
    ({projection_months} * IFNULL(s.avg_monthly_qty, 0)) AS `Total Required`,
    (({projection_months} * IFNULL(s.avg_monthly_qty, 0))
      - (IFNULL(stk.current_stock, 0) + IFNULL(p.pending_qty, 0))) AS `Need to Order`,
    (({projection_months} * IFNULL(s.avg_monthly_qty, 0))
      - (IFNULL(stk.current_stock, 0) + IFNULL(p.pending_qty, 0))) AS `Final Order`,
    asm.stkrmb AS `RMB Value`,
    asm.stkusd AS `USD Value`
FROM
(
    SELECT 
        po.itemguid,
        SUM(po.ordered_qty) - IFNULL(SUM(rcvd.received_qty), 0) AS pending_qty,
        SUM(po.ordered_qty) AS ordered_qty
    FROM (
        SELECT 
            vbat.itemguid,
            SUM(CAST(vbat.qty AS DECIMAL(18,2))) AS ordered_qty
        FROM voucher_master vm
        JOIN voucher_batch_allocation_transaction vbat 
            ON vm.guid = vbat.guid
        WHERE vm.vouchertype = 'Purchase Order'
        GROUP BY vbat.itemguid
    ) po
    LEFT JOIN (
        SELECT 
            vbat.itemguid,
            SUM(CAST(vbat.qty AS DECIMAL(18,2))) AS received_qty
        FROM voucher_master vm
        JOIN voucher_batch_allocation_transaction vbat 
            ON vm.guid = vbat.guid
        WHERE vm.vouchertype = 'Purchase'
        GROUP BY vbat.itemguid
    ) rcvd
      ON po.itemguid = rcvd.itemguid
    WHERE (po.ordered_qty - IFNULL(rcvd.received_qty, 0)) > 0
    GROUP BY po.itemguid
) p
LEFT JOIN stock_item_master sim
    ON p.itemguid = sim.guid
LEFT JOIN audit_stock_item_master asm
    ON p.itemguid = asm.guid
LEFT JOIN (
    SELECT 
        vit.itemguid,
        ROUND(SUM(ABS(CAST(vit.quantity AS DECIMAL(18,2)))) / {avg_months}) AS avg_monthly_qty
    FROM voucher_master vm
    JOIN voucher_inventory_transaction vit
        ON vm.guid = vit.guid
    JOIN voucher_accounting_transaction vat
        ON vm.guid = vat.guid
    WHERE vat.ledger = 'Sales'
      AND STR_TO_DATE(vm.date, '%Y-%m-%d') >= CURDATE() - INTERVAL {avg_months} MONTH
    GROUP BY vit.itemguid
) s 
    ON p.itemguid = s.itemguid
LEFT JOIN (
    SELECT 
        vit.itemguid,
        ROUND(SUM(CAST(vit.quantity AS DECIMAL(18,2)))) AS current_stock
    FROM voucher_inventory_transaction vit
    GROUP BY vit.itemguid
) stk
    ON p.itemguid = stk.itemguid;
"""

    try:
        with connections['tally'].cursor() as cursor:
            cursor.execute(query)
            columns = [col[0] for col in cursor.description]
            data = []
            for row in cursor.fetchall():
                row_dict = {}
                for col, val in zip(columns, row):
                    if col in [
                        "Stock", "Pending Purchase Order", "Total Stock", "Avg. Sale",
                        "Months", "Total Required", "Need to Order", "Final Order",
                        "RMB Value", "USD Value"
                    ]:
                        try:
                            row_dict[col] = float(val) if '.' in str(val) else int(val)
                        except (ValueError, TypeError):
                            row_dict[col] = 0
                    else:
                        row_dict[col] = val
                data.append(row_dict)
    except OperationalError as exc:
        logger.error("Tally database connection failed for static reorder report: %s", exc)
        return JsonResponse(
            {
                "error": (
                    "Unable to connect to the Tally database. "
                    "Check network/VPN access to db.sky9.ai and try again."
                )
            },
            status=503,
        )
    except Exception as exc:
        logger.exception("Static reorder report query failed")
        return JsonResponse({"error": "Failed to load reorder report"}, status=500)

    formatted_columns = []
    for col in columns:
        col_type = "currency" if "Value" in col else (
            "number" if col not in ["Item Name", "Supplier Name"] else "text"
        )
        formatted_columns.append({
            "field": col,
            "headerName": col,
            "type": col_type
        })

    return JsonResponse({
        "columns": formatted_columns,
        "rows": data
    })


