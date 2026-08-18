import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import BASE_URL from "./config";
import { toast } from "react-toastify";
import { FaArrowUp, FaEdit, FaEye, FaFilter, FaPhoneAlt, FaPlus, FaRedo, FaSave, FaSearch, FaTimes, FaTrash, FaMapMarkerAlt } from "react-icons/fa";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { divIcon } from "leaflet";

const blankCreateForm = {
  name: "",
  description: "",
  start_date: "",
};

const blankLeadFilters = {
  status: "",
  clientStatus: "All",
  city: "",
  state: "",
  courier: "",
  expectedDate: "",
  fileName: "",
};

const blankCustomerFilters = {
  city: "",
  state: "",
  fileName: "",
  uploadedDate: "",
};

const leadStatusOrder = {
  Pending: 0,
  Dispatched: 1,
  Delivered: 2,
  Failed: 3,
  Returned: 4,
};

const leadTableColumns = [
  { key: "name", label: "Name" },
  { key: "phone", label: "Phone" },
  { key: "docat", label: "Docat" },
  { key: "address_line1", label: "Address" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "courier_name", label: "Courier Name" },
  { key: "products", label: "Products" },
  { key: "client_status", label: "Client Status" },
  { key: "dispatch_date", label: "Dispatch Date", className: "min-w-[120px] whitespace-nowrap" },
  { key: "expected_delivery_date", label: "Expected Delivery", className: "min-w-[140px] whitespace-nowrap" },
  { key: "actual_delivery_date", label: "Actual Delivery", className: "min-w-[120px] whitespace-nowrap" },
  { key: "client_review", label: "Client Review / Reviews" },
  { key: "status", label: "Status" },
];

const rowsPerPageOptions = [5, 10, 20, 50, 100, 500];

const getAuthHeaders = () => {
  const token = localStorage.getItem("authToken");
  return token ? { Authorization: `Token ${token}` } : {};
};

const normalizeDateValue = (value) => {
  if (!value) return "";
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text.slice(0, 10);
  return date.toISOString().slice(0, 10);
};

const normalizeApiDateInput = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const dayFirstMatch = text.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (dayFirstMatch) {
    const [, day, month, year] = dayFirstMatch;
    return `${year}-${month}-${day}`;
  }

  const normalized = normalizeDateValue(text);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
};

const getApiErrorMessage = (error, fallbackMessage) => {
  const data = error?.response?.data;

  if (typeof data === "string" && data.trim()) return data;
  if (typeof data?.error === "string" && data.error.trim()) return data.error;
  if (typeof data?.detail === "string" && data.detail.trim()) return data.detail;
  if (typeof data?.message === "string" && data.message.trim()) return data.message;

  if (data && typeof data === "object") {
    for (const [field, value] of Object.entries(data)) {
      if (Array.isArray(value) && value.length) {
        const firstValue = value.find((item) => String(item || "").trim());
        if (firstValue) return `${formatLabel(field)}: ${String(firstValue)}`;
      }
      if (typeof value === "string" && value.trim()) {
        return `${formatLabel(field)}: ${value}`;
      }
    }
  }

  if (typeof error?.message === "string" && error.message.trim()) return error.message;
  return fallbackMessage;
};

const formatLabel = (value) =>
  String(value || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const buildFullName = (item) => {
  const firstName = String(item?.first_name ?? "").trim();
  const lastName = String(item?.last_name ?? "").trim();
  const companyName = String(item?.company_upload_name ?? item?.company_name ?? item?.customer_company_name ?? "").trim();
  return [firstName, lastName].filter(Boolean).join(" ") || companyName || `Customer ${item?.id ?? "-"}`;
};

const buildLeadName = (lead) => {
  const firstName = String(lead?.first_name ?? "").trim();
  const lastName = String(lead?.last_name ?? "").trim();
  const companyName = String(lead?.company_upload_name ?? lead?.company_name ?? lead?.customer_company_name ?? "").trim();
  return [firstName, lastName].filter(Boolean).join(" ") || companyName || `Lead ${lead?.id ?? "-"}`;
};

const buildAddressLabel = (item) => {
  const line1 = String(item?.address_line1 ?? item?.address ?? "").trim();
  const line2 = String(item?.address_line2 ?? "").trim();
  return [line1, line2].filter(Boolean).join(", ") || "-";
};

const getLeadStatusLabel = (lead) => {
  const status = String(lead?.courier_status ?? lead?.status ?? "").trim();
  return status || "Pending";
};

const getLeadClientReviewValue = (lead) =>
  String(lead?.client_review ?? lead?.customer_reviews ?? lead?.reviews ?? lead?.customer?.reviews ?? "").trim();

const formatProductsValue = (raw) => {
  if (raw === null || raw === undefined) return "-";
  if (Array.isArray(raw)) return raw.join(", ");
  const text = String(raw).trim();
  if (!text) return "-";
  // Try parse JSON array
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map((p) => String(p).trim()).filter(Boolean).join(", ");
  } catch (e) {
    // ignore
  }
  // Remove surrounding brackets if present and split
  if ((text.startsWith("[") && text.endsWith("]")) || (text.startsWith("(") && text.endsWith(")"))) {
    const inner = text.slice(1, -1);
    return inner.split(",").map((p) => p.replace(/^['"]|['"]$/g, "").trim()).filter(Boolean).join(", ") || text;
  }
  return text;
};

const getLeadSortText = (lead, key) => {
  switch (key) {
    case "name":
      return buildLeadName(lead);
    case "phone":
      return String(lead?.phone ?? "");
    case "docat":
      return String(lead?.docat ?? lead?.customer_docat ?? "");
    case "client_status":
      return String(lead?.client_status ?? "");
    case "dispatch_date":
      return normalizeDateValue(lead?.dispatch_date);
    case "expected_delivery_date":
      return normalizeDateValue(lead?.expected_delivery_date);
    case "actual_delivery_date":
      return normalizeDateValue(lead?.actual_delivery_date);
    case "client_review":
      return getLeadClientReviewValue(lead);
    case "products":
      return String(lead?.products ?? "");
    case "status":
      return getLeadStatusLabel(lead);
    default:
      return String(lead?.[key] ?? "");
  }
};

const buildLeadSortValue = (lead, key) => {
  const textValue = getLeadSortText(lead, key);

  switch (key) {
    case "status":
      return leadStatusOrder[getLeadStatusLabel(lead)] ?? 99;
    default:
      return textValue;
  }
};


const isDateBefore = (left, right) => {
  if (!left || !right) return false;
  return left < right;
};

const leadStatusColors = {
  Pending: "#dc2626",
  Dispatched: "#2563eb",
  Delivered: "#16a34a",
  Failed: "#f97316",
  Returned: "#7c3aed",
};

const getLeadMapIcon = (color) =>
  divIcon({
    className: "courier-map-pin",
    html: `
      <div style="position:relative;width:28px;height:28px;transform:translate(-50%,-100%);">
        <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
          <path fill="${color}" d="M12 2C8.14 2 5 5.14 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.86-3.14-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/>
          <circle cx="12" cy="9" r="2.2" fill="#ffffff" opacity="0.95" />
        </svg>
      </div>
    `,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -32],
  });

const cityCoordinates = {
  ahmedabad: [23.0225, 72.5714],
  bangalore: [12.9716, 77.5946],
  bengaluru: [12.9716, 77.5946],
  bhopal: [23.2599, 77.4126],
  chennai: [13.0827, 80.2707],
  coimbatore: [11.0168, 76.9558],
  delhi: [28.6139, 77.209],
  gurgaon: [28.4595, 77.0266],
  hyderabad: [17.385, 78.4867],
  indore: [22.7196, 75.8577],
  jaipur: [26.9124, 75.7873],
  kanpur: [26.4499, 80.3319],
  kochi: [9.9312, 76.2673],
  kolkata: [22.5726, 88.3639],
  lucknow: [26.8467, 80.9462],
  ludhiana: [30.901, 75.8573],
  madurai: [9.9252, 78.1198],
  mumbai: [19.076, 72.8777],
  mysore: [12.2958, 76.6394],
  nagpur: [21.1458, 79.0882],
  nashik: [19.9975, 73.7898],
  patna: [25.5941, 85.1376],
  pune: [18.5204, 73.8567],
  surat: [21.1702, 72.8311],
  vijayawada: [16.5062, 80.648],
  visakhapatnam: [17.6868, 83.2185],
};

const getCityCoordinates = (city) => {
  const normalizedCity = String(city || "").trim().toLowerCase();
  if (!normalizedCity) return [22.8, 78.9];

  if (cityCoordinates[normalizedCity]) {
    return cityCoordinates[normalizedCity];
  }

  let hash = 0;
  for (let index = 0; index < normalizedCity.length; index += 1) {
    hash = (hash * 31 + normalizedCity.charCodeAt(index)) >>> 0;
  }

  const lat = 10 + ((hash % 1700) / 100);
  const lng = 68 + (((Math.floor(hash / 1700)) % 1900) / 100);
  return [Math.min(lat, 35), Math.min(lng, 97)];
};

const getCityStatusOffset = (status, bucketIndex) => {
  const offsets = [
    [0, 0],
    [0.18, 0],
    [0, 0.18],
    [-0.18, 0],
  ];
  const normalizedIndex = bucketIndex % offsets.length;
  const [latOffset, lngOffset] = offsets[normalizedIndex];
  const statusShift = (String(status || "").toLowerCase().charCodeAt(0) || 0) % 3;
  return [latOffset + statusShift * 0.03, lngOffset - statusShift * 0.02];
};

const getLeadAreaLabel = (lead) => {
  const address = String(lead?.address_line1 ?? lead?.address ?? "").trim();
  const city = String(lead?.city ?? "").trim();
  const pincode = String(lead?.pincode ?? "").trim();

  if (pincode) return pincode;

  if (address) {
    const firstPart = address.split(",")[0].trim();
    if (firstPart && firstPart.length >= 3) {
      return firstPart;
    }

    const tokens = address.split(/\s+/).filter(Boolean);
    if (tokens.length >= 2) {
      return tokens.slice(0, 2).join(" ");
    }
  }

  if (city && pincode) return `${city}-${pincode}`;
  if (city) return city;
  return "Unknown Area";
};

const collectSearchableText = (value, collected = []) => {
  if (value === null || value === undefined) {
    return collected;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    collected.push(String(value));
    return collected;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectSearchableText(item, collected));
    return collected;
  }

  if (typeof value === "object") {
    Object.values(value).forEach((item) => collectSearchableText(item, collected));
  }

  return collected;
};

export default function CourierTracking({ initialCampaignId = null, showOnlyActive = false, onlyShowCampaignList = false, showHeaderWhenList = false, onLoadChange = () => {}, renderActiveHeaderExtras = null } = {}) {
  const [campaigns, setCampaigns] = useState([]);
  const [activeCampaign, setActiveCampaign] = useState(null);
  const [leads, setLeads] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [campaignFormMode, setCampaignFormMode] = useState("create");
  const [editingCampaignId, setEditingCampaignId] = useState(null);
  const [showCampaignEditModal, setShowCampaignEditModal] = useState(false);
  const [createForm, setCreateForm] = useState(blankCreateForm);
  const [campaignSearch, setCampaignSearch] = useState("");
  const [showAddLeadsModal, setShowAddLeadsModal] = useState(false);
  const [showAddSingleLeadModal, setShowAddSingleLeadModal] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [customerFilters, setCustomerFilters] = useState(blankCustomerFilters);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerIds, setSelectedCustomerIds] = useState([]);
  const [companyCourierNames, setCompanyCourierNames] = useState([]);
  const [leadSearch, setLeadSearch] = useState("");
  const [leadFilters, setLeadFilters] = useState(blankLeadFilters);
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [bulkLeadForm, setBulkLeadForm] = useState({
    courier_name: "",
    client_status: "",
    dispatch_date: "",
    expected_delivery_date: "",
    actual_delivery_date: "",
    status: "",
    products: "",
  });
  const [bulkCourierDropdownOpen, setBulkCourierDropdownOpen] = useState(false);
  const [inlineEditLeadId, setInlineEditLeadId] = useState(null);
  const [inlineEditMode, setInlineEditMode] = useState(null);
  const [courierDropdownOpen, setCourierDropdownOpen] = useState(false);
  const [productsDropdownOpen, setProductsDropdownOpen] = useState(false);
  const [inlineEditForm, setInlineEditForm] = useState({
    dispatch_date: "",
    expected_delivery_date: "",
    actual_delivery_date: "",
    courier_name: "",
    docat: "",
    client_status: "",
    courier_status: "",
    courier_description: "",
    client_review: "",
    notes: "",
    products: "",
  });
  
  const [leadAttempts, setLeadAttempts] = useState([]);
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [newAttemptNumber, setNewAttemptNumber] = useState(null);

  // Helper to append an attempt object into the local attempts list (useful for pasting/testing)
  const appendAttemptFromObject = (obj = {}) => {
    const nextAttemptNumber = obj.attempt_number ?? ((Array.isArray(leadAttempts) && leadAttempts.length) ? (Number(leadAttempts[leadAttempts.length - 1].attempt_number || 0) + 1) : 1);
    const sanitized = {
      id: obj.id ?? `tmp-${Date.now()}`,
      attempt_number: nextAttemptNumber,
      dispatch_date: obj.dispatch_date || obj.dispatch || "",
      expected_delivery_date: obj.expected_delivery_date || obj.expected || "",
      actual_delivery_date: obj.actual_delivery_date || obj.actual || "",
      courier_name: obj.courier_name || obj.courier || "",
      courier_status: obj.courier_status || obj.status || "",
      courier_description: obj.courier_description || obj.description || "",
      notes: obj.notes || "",
      _isNew: true,
    };
    setLeadAttempts((prev) => [...(Array.isArray(prev) ? prev : []), sanitized]);
    setSelectedAttempt(sanitized);
    setInlineEditForm((prev) => ({
      ...prev,
      dispatch_date: sanitized.dispatch_date,
      expected_delivery_date: sanitized.expected_delivery_date,
      actual_delivery_date: sanitized.actual_delivery_date,
      courier_name: sanitized.courier_name,
      courier_status: sanitized.courier_status,
      courier_description: sanitized.courier_description,
      notes: sanitized.notes,
    }));
  };

  // Expose helper for quick manual testing in browser console
  useEffect(() => {
    window.__appendAttempt = appendAttemptFromObject;
    return () => { try { delete window.__appendAttempt; } catch (e) {} };
  }, [leadAttempts]);
  const [leadPage, setLeadPage] = useState(1);
  const [leadRowsPerPage, setLeadRowsPerPage] = useState(10);
  const [leadSortKey, setLeadSortKey] = useState("id");
  const [leadSortDirection, setLeadSortDirection] = useState("desc");
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [savingLead, setSavingLead] = useState(false);
  const [savingAddLeads, setSavingAddLeads] = useState(false);
  const [savingSingleLead, setSavingSingleLead] = useState(false);
  const [showTrackMap, setShowTrackMap] = useState(false);
  const navigate = useNavigate();
  const [allCampaignLeads, setAllCampaignLeads] = useState([]);
  const [loadingTrackMap, setLoadingTrackMap] = useState(false);
  const [campaignMapLeads, setCampaignMapLeads] = useState([]);
  const [selectedCampaignForMap, setSelectedCampaignForMap] = useState(null);
  const [loadingCampaignMap, setLoadingCampaignMap] = useState(false);
  const [showAllCampaignsMapSidebar, setShowAllCampaignsMapSidebar] = useState(false);
  const [showLeadFilters, setShowLeadFilters] = useState(false);
  const [showBulkEditPanel, setShowBulkEditPanel] = useState(false);

  const todayIso = new Date().toISOString().slice(0, 10);

  const resetLeadEditor = () => {
    setInlineEditLeadId(null);
    setInlineEditMode(null);
    setCourierDropdownOpen(false);
    setInlineEditForm({
      dispatch_date: "",
      expected_delivery_date: "",
      actual_delivery_date: "",
      courier_name: "",
      docat: "",
      client_status: "",
      courier_status: "",
      courier_description: "",
      client_review: "",
      notes: "",
      products: "",
    });
  };

  const resetBulkLeadActions = () => {
    setSelectedLeadIds([]);
    setBulkLeadForm({
      courier_name: "",
      client_status: "",
      dispatch_date: "",
      expected_delivery_date: "",
      actual_delivery_date: "",
      status: "",
    });
    setBulkCourierDropdownOpen(false);
  };

  const blankSingleLeadForm = {
    first_name: "",
    last_name: "",
    phone: "",
    pincode: "",
    address_line1: "",
    address_line2: "",
    country: "",
    city: "",
    state: "",
  };

  const [singleLeadForm, setSingleLeadForm] = useState(blankSingleLeadForm);

  const openAddSingleLeadModal = () => {
    setSingleLeadForm(blankSingleLeadForm);
    setShowAddSingleLeadModal(true);
  };

  const closeAddSingleLeadModal = () => {
    setShowAddSingleLeadModal(false);
    setSingleLeadForm(blankSingleLeadForm);
  };

  const handleAddSingleLeadSubmit = async (event) => {
    event?.preventDefault?.();
    if (!singleLeadForm.first_name.trim() || !singleLeadForm.phone.trim()) {
      toast.error("First name and phone are required.");
      return;
    }

    const phoneDigits = String(singleLeadForm.phone || "").replace(/\D/g, "");
    const indianMobileRegex = /^(?:91)?[0-9]{10}$/; // allows plain 10 digits or '91' + 10 digits
    if (!indianMobileRegex.test(phoneDigits)) {
      toast.error("Invalid phone number. Enter 10 digits (optionally prefixed with '91').");
      return;
    }

    setSavingSingleLead(true);
    try {
      const payload = {
        first_name: singleLeadForm.first_name.trim(),
        last_name: singleLeadForm.last_name.trim(),
        phone: phoneDigits,
        pincode: singleLeadForm.pincode.trim(),
        address_line1: singleLeadForm.address_line1.trim(),
        address_line2: singleLeadForm.address_line2.trim(),
        country: singleLeadForm.country.trim(),
        city: singleLeadForm.city.trim(),
        state: singleLeadForm.state.trim(),
      };

      const res = await axios.post(`${BASE_URL}/api/customers/`, payload, { headers: getAuthHeaders() });
      const createdCustomer = res?.data || {};
      const createdCustomerId = createdCustomer?.id ?? createdCustomer?.customer?.id ?? createdCustomer?.customer_id ?? createdCustomer?.pk;

      if (activeCampaign?.id && createdCustomerId) {
        try {
          const attachRes = await axios.post(
            `${BASE_URL}/api/campaigns/${activeCampaign.id}/leads/`,
            { customer_ids: [createdCustomerId] },
            { headers: getAuthHeaders() }
          );
          prependCreatedLeads(attachRes?.data?.leads);
          toast.success("Lead added to campaign.");
          closeAddSingleLeadModal();
        } catch (attachError) {
          toast.error(getApiErrorMessage(attachError, "Customer created but failed to add to campaign. Try adding them via Bulk Upload."));
        }
      } else {
        toast.success("Customer saved.");
        closeAddSingleLeadModal();
      }
    } catch (error) {
      console.error(error);
      toast.error(getApiErrorMessage(error, "Failed to add customer."));
    } finally {
      setSavingSingleLead(false);
    }
  };

  const toggleLeadFilters = () => {
    setShowLeadFilters((prev) => {
      const next = !prev;
      if (next) {
        setShowBulkEditPanel(false);
      }
      return next;
    });
  };

  const toggleBulkEditPanel = () => {
    setShowBulkEditPanel((prev) => {
      const next = !prev;
      if (next) {
        setShowLeadFilters(false);
      }
      return next;
    });
  };

  const fetchCampaigns = async () => {
    setLoadingCampaigns(true);
    try {
      const res = await axios.get(`${BASE_URL}/api/campaigns/`, {
        headers: getAuthHeaders(),
      });
      const data = Array.isArray(res?.data) ? res.data : Array.isArray(res?.data?.campaigns) ? res.data.campaigns : [];
      setCampaigns(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load campaigns.");
      setCampaigns([]);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const fetchLeads = async (campaignId) => {
    if (!campaignId) {
      setLeads([]);
      return;
    }

    setLoadingLeads(true);
    try {
      const res = await axios.get(`${BASE_URL}/api/campaigns/${campaignId}/leads/`, {
        headers: getAuthHeaders(),
      });
      const data = Array.isArray(res?.data) ? res.data : Array.isArray(res?.data?.leads) ? res.data.leads : [];
      setLeads(data);
      setLeadPage(1);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load campaign leads.");
      setLeads([]);
    } finally {
      setLoadingLeads(false);
    }
  };

  const fetchLeadsForMap = async (campaignId) => {
    if (!campaignId) {
      setCampaignMapLeads([]);
      return;
    }

    setLoadingCampaignMap(true);
    try {
      const res = await axios.get(`${BASE_URL}/api/campaigns/${campaignId}/leads/`, {
        headers: getAuthHeaders(),
      });
      const data = Array.isArray(res?.data) ? res.data : Array.isArray(res?.data?.leads) ? res.data.leads : [];
      setCampaignMapLeads(data.map((lead) => ({ ...lead, campaign_id: campaignId })));
    } catch (error) {
      console.error(error);
      toast.error("Failed to load campaign map leads.");
      setCampaignMapLeads([]);
    } finally {
      setLoadingCampaignMap(false);
    }
  };

  const fetchCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const res = await axios.get(`${BASE_URL}/api/customers/`, {
        headers: getAuthHeaders(),
      });
      const data = Array.isArray(res?.data?.customers)
        ? res.data.customers
        : Array.isArray(res?.data)
          ? res.data
          : [];
      setCustomers(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load customers.");
      setCustomers([]);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const fetchCourierNames = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/courier-names/`, {
        headers: getAuthHeaders(),
      });
      const data = Array.isArray(res?.data?.couriers) ? res.data.couriers : [];
      setCompanyCourierNames(data);
    } catch (error) {
      console.error(error);
      setCompanyCourierNames([]);
    }
  };

  const fetchAllCampaignLeads = async () => {
    if (!campaigns.length) {
      setAllCampaignLeads([]);
      return;
    }

    setLoadingTrackMap(true);
    try {
      const responses = await Promise.all(
        campaigns.map(async (campaign) => {
          try {
            const res = await axios.get(`${BASE_URL}/api/campaigns/${campaign.id}/leads/`, {
              headers: getAuthHeaders(),
            });
            const data = Array.isArray(res?.data) ? res.data : Array.isArray(res?.data?.leads) ? res.data.leads : [];
            return data.map((lead) => ({
              ...lead,
              campaign_id: campaign.id,
              campaign_name: campaign.name,
            }));
          } catch (error) {
            console.error(error);
            return [];
          }
        })
      );

      setAllCampaignLeads(responses.flat());
    } finally {
      setLoadingTrackMap(false);
    }
  };

  useEffect(() => {
    setShowAddLeadsModal(false);
    setSelectedCustomerIds([]);
    setCustomers([]);
    setCompanyCourierNames([]);
    setCustomerFilters(blankCustomerFilters);
    setShowTrackMap(false);
    setActiveCampaign(null);
    setLeads([]);
    resetLeadEditor();
    setLoadingLeads(false);
    fetchCampaigns();
    fetchCourierNames();
  }, []);

  // useEffect(() => {
  //   if (!campaigns.length) return;

  //   // If an initialCampaignId was provided (CampaignView), prefer that
  //   const preferredId = initialCampaignId ? Number(initialCampaignId) : Number(localStorage.getItem("selectedCampaignId") || 0);
  //   if (!preferredId) return;

  //   const savedCampaign = campaigns.find((campaign) => campaign.id === preferredId);
  //   if (savedCampaign && activeCampaign?.id !== savedCampaign.id) {
  //     // keep localStorage in sync
  //     try {
  //       localStorage.setItem("selectedCampaignId", String(savedCampaign.id));
  //     } catch (e) {}
  //     setActiveCampaign(savedCampaign);
  //   }
  // }, [campaigns, initialCampaignId]);


useEffect(() => {
  if (!campaigns.length) return;
  if (activeCampaign) return;

  const first = campaigns[0];
  localStorage.setItem("selectedCampaignId", String(first.id));
  setActiveCampaign(first);
}, [campaigns]);

  useEffect(() => {
    if (activeCampaign?.id) {
      fetchLeads(activeCampaign.id);
    } else {
      setLeads([]);
      resetLeadEditor();
      resetBulkLeadActions();
    }
  }, [activeCampaign?.id]);

  useEffect(() => {
    const loading = Boolean(loadingCampaigns || loadingLeads);
    try {
      onLoadChange(Boolean(loading));
    } catch (e) {}
  }, [loadingCampaigns, loadingLeads, onLoadChange]);

  useEffect(() => {
    setLeadPage(1);
  }, [leadSearch, leadFilters.status, leadFilters.city, leadFilters.state, leadFilters.expectedDate, leadSortKey, leadSortDirection]);

  useEffect(() => {
    resetBulkLeadActions();
  }, [leadSearch, leadFilters.status, leadFilters.city, leadFilters.state, leadFilters.courier, leadFilters.expectedDate, activeCampaign?.id]);

  useEffect(() => {
    if (showAddLeadsModal) {
      fetchCustomers();
      setSelectedCustomerIds([]);
      setCustomerSearch("");
    }
  }, [showAddLeadsModal]);

  const handleCreateCampaignSubmit = async (event) => {
    event.preventDefault();

    if (!createForm.name.trim() || !createForm.start_date) {
      toast.error("Campaign name and start date are required.");
      return;
    }

    setSavingCampaign(true);
    try {
      const payload = {
        name: createForm.name.trim(),
        description: createForm.description.trim(),
        start_date: createForm.start_date,
      };

      let response;
      if (campaignFormMode === "edit" && editingCampaignId) {
        response = await axios.patch(
          `${BASE_URL}/api/campaigns/${editingCampaignId}/`,
          payload,
          {
            headers: getAuthHeaders(),
          }
        );
        toast.success("Campaign updated successfully.");
      } else {
        response = await axios.post(
          `${BASE_URL}/api/campaigns/`,
          {
            ...payload,
          },
          {
            headers: getAuthHeaders(),
          }
        );
        toast.success("Campaign created successfully.");
      }

      setCreateForm(blankCreateForm);
      setShowCreateForm(false);
      setCampaignFormMode("create");
      setEditingCampaignId(null);
      setShowCampaignEditModal(false);
      await fetchCampaigns();
      if (activeCampaign?.id && response?.data?.id === activeCampaign.id) {
        setActiveCampaign(response.data);
      }
    } catch (error) {
      console.error(error);
      toast.error(getApiErrorMessage(error, campaignFormMode === "edit" ? "Failed to update campaign." : "Failed to create campaign."));
    } finally {
      setSavingCampaign(false);
    }
  };

  const openCreateCampaignForm = () => {
    setCampaignFormMode("create");
    setEditingCampaignId(null);
    setShowCampaignEditModal(false);
    setCreateForm(blankCreateForm);
    setShowCreateForm((prev) => !prev);
  };

  const openEditCampaignForm = (campaign) => {
    setCampaignFormMode("edit");
    setEditingCampaignId(campaign.id);
    setShowCreateForm(false);
    setCreateForm({
      name: String(campaign?.name ?? ""),
      description: String(campaign?.description ?? ""),
      start_date: normalizeDateValue(campaign?.start_date),
    });
    setShowCampaignEditModal(true);
  };

  const closeCampaignForm = () => {
    setShowCreateForm(false);
    setCampaignFormMode("create");
    setEditingCampaignId(null);
    setCreateForm(blankCreateForm);
  };

  const closeCampaignEditModal = () => {
    setShowCampaignEditModal(false);
    setCampaignFormMode("create");
    setEditingCampaignId(null);
    setCreateForm(blankCreateForm);
  };

  const deleteCampaign = async (campaign) => {
    const confirmed = window.confirm(`Delete campaign \"${campaign?.name || "this campaign"}\"?`);
    if (!confirmed) return;

    try {
      await axios.delete(`${BASE_URL}/api/campaigns/${campaign.id}/`, {
        headers: getAuthHeaders(),
      });

      toast.success("Campaign deleted successfully.");
      if (activeCampaign?.id === campaign.id) {
        closeCampaign();
      }
      await fetchCampaigns();
    } catch (error) {
      console.error(error);
      toast.error(getApiErrorMessage(error, "Failed to delete campaign."));
    }
  };

  const openCampaign = (campaign) => {
    if (activeCampaign?.id === campaign?.id) {
      closeCampaign();
      return;
    }

    localStorage.setItem("selectedCampaignId", String(campaign.id));
    setActiveCampaign(campaign);
    resetLeadEditor();
  };

  const handleCampaignSelectionChange = (event) => {
    const campaignId = event.target.value;
    const nextCampaign = campaigns.find((campaign) => String(campaign.id) === campaignId);

    if (!nextCampaign) return;

    openCampaign(nextCampaign);

    if (showOnlyActive) {
      navigate(`/campaigns/${nextCampaign.id}`);
    }
  };

  const openTrackMap = () => {
    if (!campaigns.length) {
      toast.error("No campaigns available to show on the map.");
      return;
    }

    setShowTrackMap(true);
    fetchAllCampaignLeads();
  };

  const closeCampaign = () => {
    localStorage.removeItem("selectedCampaignId");
    setActiveCampaign(null);
    setLeads([]);
    setLeadSearch("");
    setLeadFilters(blankLeadFilters);
    setLeadSortKey("id");
    setLeadSortDirection("desc");
    resetLeadEditor();
  };

  const clearLeadFilters = () => {
    setLeadSearch("");
    setLeadFilters(blankLeadFilters);
    setLeadSortKey("id");
    setLeadSortDirection("desc");
    setLeadPage(1);
    resetBulkLeadActions();
  };

  const openAddLeadsModal = () => {
    if (!activeCampaign?.id) {
      toast.error("Select a campaign first.");
      return;
    }

    setCustomerFilters(blankCustomerFilters);
    setCustomerSearch("");
    setSelectedCustomerIds([]);
    setShowAddLeadsModal(true);
  };

  const closeAddLeadsModal = () => {
    setShowAddLeadsModal(false);
    setSelectedCustomerIds([]);
    setCustomerFilters(blankCustomerFilters);
    setCustomerSearch("");
  };

  const filteredCustomers = useMemo(() => {
    const searchTerm = customerSearch.trim().toLowerCase();
    const cityTerm = customerFilters.city.trim().toLowerCase();
    const stateTerm = customerFilters.state.trim().toLowerCase();
    const fileNameTerm = customerFilters.fileName.trim().toLowerCase();
    const uploadedDateTerm = customerFilters.uploadedDate.trim();

    return customers.filter((customer) => {
      const fullName = `${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.toLowerCase();
      const customerCity = String(customer?.city ?? "").toLowerCase();
      const customerState = String(customer?.state ?? "").toLowerCase();
      const customerPhone = String(customer?.phone ?? "").toLowerCase();
      const customerFileName = String(customer?.excel_name ?? "").toLowerCase();
      const customerUploadedDate = normalizeDateValue(customer?.file_uploaded_at);

      const searchMatch =
        !searchTerm ||
        fullName.includes(searchTerm) ||
        customerPhone.includes(searchTerm) ||
        customerCity.includes(searchTerm) ||
        customerState.includes(searchTerm);
      const cityMatch = !cityTerm || customerCity === cityTerm;
      const stateMatch = !stateTerm || customerState === stateTerm;
      const fileNameMatch = !fileNameTerm || customerFileName.includes(fileNameTerm);
      const uploadedDateMatch = !uploadedDateTerm || customerUploadedDate === uploadedDateTerm;

      return searchMatch && cityMatch && stateMatch && fileNameMatch && uploadedDateMatch;
    });
  }, [customers, customerSearch, customerFilters.city, customerFilters.state, customerFilters.fileName, customerFilters.uploadedDate]);

  const customerCityOptions = useMemo(() => {
    const optionMap = new Map();
    customers.forEach((customer) => {
      const rawValue = String(customer?.city ?? "").trim();
      if (!rawValue) return;
      const normalizedValue = rawValue.toLowerCase();
      if (!optionMap.has(normalizedValue)) {
        optionMap.set(normalizedValue, rawValue);
      }
    });

    return [...optionMap.entries()]
      .sort((left, right) => left[1].localeCompare(right[1], undefined, { sensitivity: "base" }))
      .map(([value, label]) => ({ value, label }));
  }, [customers]);

  const customerStateOptions = useMemo(() => {
    const optionMap = new Map();
    customers.forEach((customer) => {
      const rawValue = String(customer?.state ?? "").trim();
      if (!rawValue) return;
      const normalizedValue = rawValue.toLowerCase();
      if (!optionMap.has(normalizedValue)) {
        optionMap.set(normalizedValue, rawValue);
      }
    });

    return [...optionMap.entries()]
      .sort((left, right) => left[1].localeCompare(right[1], undefined, { sensitivity: "base" }))
      .map(([value, label]) => ({ value, label }));
  }, [customers]);

  const customerFileNameOptions = useMemo(() => {
    const optionMap = new Map();
    customers.forEach((customer) => {
      const rawValue = String(customer?.excel_name ?? "").trim();
      if (!rawValue) return;
      const normalizedValue = rawValue.toLowerCase();
      if (!optionMap.has(normalizedValue)) {
        optionMap.set(normalizedValue, rawValue);
      }
    });

    return [...optionMap.entries()]
      .sort((left, right) => left[1].localeCompare(right[1], undefined, { sensitivity: "base" }))
      .map(([value, label]) => ({ value, label }));
  }, [customers]);

  const customerUploadedDateOptions = useMemo(() => {
    const optionMap = new Map();
    customers.forEach((customer) => {
      const rawValue = normalizeDateValue(customer?.file_uploaded_at);
      if (!rawValue) return;
      if (!optionMap.has(rawValue)) {
        optionMap.set(rawValue, rawValue);
      }
    });

    return [...optionMap.entries()]
      .sort((left, right) => right[1].localeCompare(left[1]))
      .map(([value, label]) => ({ value, label }));
  }, [customers]);

  const filteredCampaigns = useMemo(() => {
    const term = campaignSearch.trim().toLowerCase();
    if (!term) return campaigns;

    return campaigns.filter((campaign) =>
      collectSearchableText(campaign).some((value) => String(value).toLowerCase().includes(term))
    );
  }, [campaigns, campaignSearch]);

  const campaignOptions = useMemo(
    () =>
      [...campaigns].sort((left, right) => {
        const leftName = String(left?.name ?? "");
        const rightName = String(right?.name ?? "");
        return leftName.localeCompare(rightName, undefined, { sensitivity: "base" });
      }),
    [campaigns]
  );

  const leadCityOptions = useMemo(() => {
    const optionMap = new Map();
    leads.forEach((lead) => {
      const rawValue = String(lead?.city ?? "").trim();
      if (!rawValue) return;
      const normalizedValue = rawValue.toLowerCase();
      if (!optionMap.has(normalizedValue)) {
        optionMap.set(normalizedValue, rawValue);
      }
    });

    return [...optionMap.entries()]
      .sort((left, right) => left[1].localeCompare(right[1], undefined, { sensitivity: "base" }))
      .map(([value, label]) => ({ value, label }));
  }, [leads]);

  const leadFileOptions = useMemo(() => {
    const optionMap = new Map();
    leads.forEach((lead) => {
      const rawValue = String(lead?.customer_excel_name ?? (lead?.customer?.excel_name ?? "")).trim();
      if (!rawValue) return;
      const normalizedValue = rawValue.toLowerCase();
      if (!optionMap.has(normalizedValue)) {
        optionMap.set(normalizedValue, rawValue);
      }
    });

    return [...optionMap.entries()]
      .sort((left, right) => left[1].localeCompare(right[1], undefined, { sensitivity: "base" }))
      .map(([value, label]) => ({ value, label }));
  }, [leads]);

  const leadStateOptions = useMemo(() => {
    const optionMap = new Map();
    leads.forEach((lead) => {
      const rawValue = String(lead?.state ?? "").trim();
      if (!rawValue) return;
      const normalizedValue = rawValue.toLowerCase();
      if (!optionMap.has(normalizedValue)) {
        optionMap.set(normalizedValue, rawValue);
      }
    });

    return [...optionMap.entries()]
      .sort((left, right) => left[1].localeCompare(right[1], undefined, { sensitivity: "base" }))
      .map(([value, label]) => ({ value, label }));
  }, [leads]);

  const leadClientStatusOptions = useMemo(() => {
    // Always include these client status options, then add any values present in leads
    const base = ["Pending", "Approved", "Rejected"];
    const optionMap = new Map();
    base.forEach((v) => optionMap.set(String(v).toLowerCase(), String(v)));

    leads.forEach((lead) => {
      const rawValue = String(lead?.client_status ?? "").trim();
      if (!rawValue) return;
      const normalizedValue = rawValue.toLowerCase();
      if (!optionMap.has(normalizedValue)) {
        optionMap.set(normalizedValue, rawValue);
      }
    });

    return [...optionMap.values()]
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
      .map((label) => ({ value: label, label }));
  }, [leads]);

  const courierNameOptions = useMemo(() => {
    const optionMap = new Map();
    companyCourierNames.forEach((rawValue) => {
      const value = String(rawValue ?? "").trim();
      if (!value) return;
      const normalizedValue = value.toLowerCase();
      if (!optionMap.has(normalizedValue)) {
        optionMap.set(normalizedValue, value);
      }
    });
    leads.forEach((lead) => {
      const rawValue = String(lead?.courier_name ?? "").trim();
      if (!rawValue) return;
      const normalizedValue = rawValue.toLowerCase();
      if (!optionMap.has(normalizedValue)) {
        optionMap.set(normalizedValue, rawValue);
      }
    });

    return [...optionMap.entries()]
      .sort((left, right) => left[1].localeCompare(right[1], undefined, { sensitivity: "base" }))
      .map(([value, label]) => ({ value, label }));
  }, [leads, companyCourierNames]);

  const mergedProductOptions = useMemo(() => {
    const fromLeads = (leads || []).flatMap((lead) => {
      const raw = String(lead?.products ?? "").trim();
      if (!raw) return [];
      return raw.split(",").map((p) => p.trim()).filter(Boolean);
    });

    return Array.from(new Set(fromLeads)).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
  }, [leads]);

  const filteredCourierNameOptions = useMemo(() => {
    const term = inlineEditForm.courier_name.trim().toLowerCase();
    return courierNameOptions
      .filter((option) => !term || option.label.toLowerCase().includes(term))
      .slice(0, 8);
  }, [courierNameOptions, inlineEditForm.courier_name]);

  const selectCourierSuggestion = (name) => {
    setInlineEditForm((prev) => ({ ...prev, courier_name: name }));
    setCourierDropdownOpen(false);
  };

  const selectBulkCourierSuggestion = (name) => {
    setBulkLeadForm((prev) => ({ ...prev, courier_name: name }));
    setBulkCourierDropdownOpen(false);
  };

  const ensureCourierNameInSuggestions = (name) => {
    const cleanedName = String(name ?? "").trim();
    if (!cleanedName) return;

    setCompanyCourierNames((prev) => {
      const normalized = cleanedName.toLowerCase();
      if (prev.some((value) => String(value ?? "").trim().toLowerCase() === normalized)) {
        return prev;
      }

      return [...prev, cleanedName].sort((left, right) => String(left).localeCompare(String(right), undefined, { sensitivity: "base" }));
    });
  };

  const commitBulkCourierName = () => {
    const name = bulkLeadForm.courier_name.trim();
    if (!name) return;
    ensureCourierNameInSuggestions(name);
    setBulkCourierDropdownOpen(false);
  };

  const filteredLeads = useMemo(() => {
    const searchTerm = leadSearch.trim().toLowerCase();
    const cityTerm = leadFilters.city.trim().toLowerCase();
    const stateTerm = leadFilters.state.trim().toLowerCase();
    const courierTerm = String(leadFilters.courier ?? "").trim().toLowerCase();
    const expectedDate = leadFilters.expectedDate.trim();
    const fileNameTerm = String(leadFilters.fileName ?? "").trim().toLowerCase();
    const statusFilter = leadFilters.status;
    const clientStatusFilter = leadFilters.clientStatus;

    return leads.filter((lead) => {
      const leadStatus = getLeadStatusLabel(lead);
      const leadClientStatus = String(lead?.client_status ?? "");
      const leadCity = String(lead?.city ?? "").toLowerCase();
      const leadState = String(lead?.state ?? "").toLowerCase();
      const leadExpectedDate = normalizeDateValue(lead?.expected_delivery_date);
      const searchableText = collectSearchableText(lead).join(" ").toLowerCase();

      const searchMatch =
        !searchTerm || searchableText.includes(searchTerm);
      const statusMatch = !statusFilter || leadStatus.toLowerCase() === String(statusFilter ?? "").toLowerCase();
      const clientStatusMatch = clientStatusFilter === "All" || String(leadClientStatus ?? "").toLowerCase() === String(clientStatusFilter ?? "").toLowerCase();
      const cityMatch = !cityTerm || leadCity === cityTerm;
      const stateMatch = !stateTerm || leadState === stateTerm;
      const courierMatch = !courierTerm || String(lead?.courier_name ?? "").toLowerCase() === courierTerm;
      const expectedMatch = !expectedDate || leadExpectedDate === expectedDate;
      const fileMatch = !fileNameTerm || String(lead?.customer_excel_name ?? (lead?.customer?.excel_name ?? "")).toLowerCase().includes(fileNameTerm);

      return searchMatch && statusMatch && clientStatusMatch && cityMatch && stateMatch && courierMatch && expectedMatch && fileMatch;
    });
  }, [leads, leadSearch, leadFilters.status, leadFilters.clientStatus, leadFilters.city, leadFilters.state, leadFilters.courier, leadFilters.expectedDate, leadFilters.fileName]);

  const mapLeadMarkers = useMemo(() => {
    return allCampaignLeads.map((lead, index) => {
      const city = String(lead?.city ?? "").trim() || "Unknown";
      const [baseLat, baseLng] = getCityCoordinates(city);
      const jitterLat = ((index * 0.07) % 0.4) - 0.2;
      const jitterLng = ((index * 0.11) % 0.4) - 0.2;
      return { ...lead, lat: baseLat + jitterLat, lng: baseLng + jitterLng };
    });
  }, [allCampaignLeads]);

  const sortedLeads = useMemo(() => {
    const cloned = [...filteredLeads];

    cloned.sort((left, right) => {
      const leftValue = buildLeadSortValue(left, leadSortKey);
      const rightValue = buildLeadSortValue(right, leadSortKey);

      let comparison = 0;
      if (typeof leftValue === "number" && typeof rightValue === "number") {
        comparison = leftValue - rightValue;
      } else {
        comparison = String(leftValue).localeCompare(String(rightValue), undefined, {
          numeric: true,
          sensitivity: "base",
        });
      }

      return leadSortDirection === "asc" ? comparison : -comparison;
    });

    return cloned;
  }, [filteredLeads, leadSortKey, leadSortDirection]);

  const leadTotalPages = Math.max(1, Math.ceil(sortedLeads.length / leadRowsPerPage));
  const safeLeadPage = Math.min(leadPage, leadTotalPages);
  const leadStartIndex = (safeLeadPage - 1) * leadRowsPerPage;
  const paginatedLeads = sortedLeads.slice(leadStartIndex, leadStartIndex + leadRowsPerPage);
  const visibleLeadIds = paginatedLeads.map((lead) => lead.id);
  const selectedVisibleLeadIds = selectedLeadIds.filter((leadId) => visibleLeadIds.includes(leadId));
  const allVisibleLeadsSelected = paginatedLeads.length > 0 && paginatedLeads.every((lead) => selectedLeadIds.includes(lead.id));
  const allFilteredLeadsSelected = filteredLeads.length > 0 && filteredLeads.every((lead) => selectedLeadIds.includes(lead.id));
  const selectedLeadCount = selectedLeadIds.length;

  const allFilteredCustomersSelected = filteredCustomers.length > 0 && filteredCustomers.every((customer) => selectedCustomerIds.includes(customer.id));

  const leadStatusKpiCards = useMemo(() => {
    const statusOrder = ["Pending", "Dispatched", "Delivered", "Failed", "Returned"];
    const statusCounts = leads.reduce((accumulator, lead) => {
      const status = getLeadStatusLabel(lead);
      accumulator[status] = (accumulator[status] || 0) + 1;
      return accumulator;
    }, {});

    return statusOrder.map((status) => ({
      label: status,
      value: status,
      count: status === "All" ? leads.length : (statusCounts[status] || 0),
    }));
  }, [leads]);

  const applyLeadStatusFilter = (status) => {
    setLeadFilters((prev) => ({
      ...prev,
      status: prev.status === status ? "" : status,
    }));
    setLeadPage(1);
    if (!showLeadFilters) {
      setShowLeadFilters(true);
    }
  };

  const toggleSelectAllCustomers = () => {
    setSelectedCustomerIds((prev) => {
      if (allFilteredCustomersSelected) {
        const filteredIds = new Set(filteredCustomers.map((customer) => customer.id));
        return prev.filter((id) => !filteredIds.has(id));
      }

      const merged = new Set(prev);
      filteredCustomers.forEach((customer) => merged.add(customer.id));
      return [...merged];
    });
  };

  const toggleCustomerSelection = (customerId) => {
    setSelectedCustomerIds((prev) =>
      prev.includes(customerId) ? prev.filter((id) => id !== customerId) : [...prev, customerId]
    );
  };

  const prependCreatedLeads = (createdLeads) => {
    if (!Array.isArray(createdLeads) || !createdLeads.length) return;

    setLeads((prev) => [...createdLeads, ...prev]);
    setLeadPage(1);
  };

  const handleAddSelectedCustomers = async () => {
    if (!activeCampaign?.id) {
      toast.error("Select a campaign first.");
      return;
    }

    if (!selectedCustomerIds.length) {
      toast.error("Select at least one customer.");
      return;
    }

    setSavingAddLeads(true);
    try {
      const res = await axios.post(
        `${BASE_URL}/api/campaigns/${activeCampaign.id}/leads/`,
        {
          customer_ids: selectedCustomerIds,
        },
        {
          headers: getAuthHeaders(),
        }
      );

      prependCreatedLeads(res?.data?.leads);
      toast.success("Selected customers added as leads.");
      closeAddLeadsModal();
    } catch (error) {
      console.error(error);
      toast.error(getApiErrorMessage(error, "Failed to add leads."));
    } finally {
      setSavingAddLeads(false);
    }
  };

  const handleLeadSort = (key) => {
    if (leadSortKey === key) {
      setLeadSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setLeadSortKey(key);
      setLeadSortDirection("asc");
    }
  };

  const toggleLeadSelection = (leadId) => {
    setSelectedLeadIds((prev) => (prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId]));
  };

  const toggleSelectAllVisibleLeads = () => {
    setSelectedLeadIds((prev) => {
      const visibleIds = paginatedLeads.map((lead) => lead.id);
      if (allVisibleLeadsSelected) {
        return prev.filter((leadId) => !visibleIds.includes(leadId));
      }

      return [...new Set([...prev, ...visibleIds])];
    });
  };

  const toggleSelectAllLeads = () => {
    setSelectedLeadIds((prev) => {
      const filteredIds = filteredLeads.map((lead) => lead.id);
      if (allFilteredLeadsSelected) {
        return prev.filter((leadId) => !filteredIds.includes(leadId));
      }

      return [...new Set([...prev, ...filteredIds])];
    });
  };

  const updateBulkLeadField = (field, value) => {
    setBulkLeadForm((prev) => ({ ...prev, [field]: value }));
  };

  const validateBulkLeadForm = () => {
    const courierName = String(bulkLeadForm.courier_name ?? "").trim();
    const rawDispatchDate = String(bulkLeadForm.dispatch_date ?? "").trim();
    const rawExpectedDate = String(bulkLeadForm.expected_delivery_date ?? "").trim();
    const rawActualDate = String(bulkLeadForm.actual_delivery_date ?? "").trim();
    const dispatchDate = normalizeApiDateInput(rawDispatchDate);
    const expectedDate = normalizeApiDateInput(rawExpectedDate);
    const actualDate = normalizeApiDateInput(rawActualDate);
    const status = String(bulkLeadForm.status ?? "").trim();
    const clientStatus = String(bulkLeadForm.client_status ?? "").trim();
    const normalizedStatus = status.toLowerCase();
    const willSetDispatchedStatus = normalizedStatus === "dispatched";
    const willSetDeliveredStatus = normalizedStatus === "delivered";

    if (!selectedLeadIds.length) {
      toast.error("Select at least one lead.");
      return false;
    }

    const clientStatusRaw = String(bulkLeadForm.client_status ?? "").trim();

    if (!courierName && !rawDispatchDate && !rawExpectedDate && !rawActualDate && !status && !clientStatusRaw) {
      toast.error("Choose a courier, date, status, or client status to apply.");
      return false;
    }

    if (rawDispatchDate && !dispatchDate) {
      toast.error("Dispatch date format is invalid. Use YYYY-MM-DD.");
      return false;
    }

    if (rawExpectedDate && !expectedDate) {
      toast.error("Expected delivery date format is invalid. Use YYYY-MM-DD.");
      return false;
    }

    if (rawActualDate && !actualDate) {
      toast.error("Actual delivery date format is invalid. Use YYYY-MM-DD.");
      return false;
    }


    if (willSetDispatchedStatus && (!dispatchDate || !expectedDate)) {
      toast.error("Dispatch date and expected delivery date are required for Dispatched status.");
      return false;
    }

    if (willSetDeliveredStatus && !actualDate) {
      toast.error("Actual delivery date is required for Delivered status.");
      return false;
    }

    return true;
  };

  const applyBulkLeadUpdates = async () => {
    if (!activeCampaign?.id) return;
    if (!validateBulkLeadForm()) return;

    const payload = {};
    const courierName = bulkLeadForm.courier_name.trim();
    const dispatchDate = normalizeApiDateInput(String(bulkLeadForm.dispatch_date ?? "").trim());
    const expectedDate = normalizeApiDateInput(String(bulkLeadForm.expected_delivery_date ?? "").trim());
    const actualDate = normalizeApiDateInput(String(bulkLeadForm.actual_delivery_date ?? "").trim());
    const status = String(bulkLeadForm.status ?? "").trim();
    const clientStatus = String(bulkLeadForm.client_status ?? "").trim();

    if (courierName) payload.courier_name = courierName;
    if (dispatchDate) payload.dispatch_date = dispatchDate;
    if (expectedDate) payload.expected_delivery_date = expectedDate;
    if (actualDate) payload.actual_delivery_date = actualDate;
    if (status) {
      payload.status = status;
      payload.courier_status = status;
    }
    if (clientStatus) {
      payload.client_status = clientStatus;
    }

    setSavingLead(true);
    try {
      await axios.post(
        `${BASE_URL}/api/campaigns/${activeCampaign.id}/leads/bulk/`,
        {
          action: "update",
          lead_ids: selectedLeadIds,
          update: payload,
        },
        {
          headers: getAuthHeaders(),
        }
      );

      toast.success(`Updated ${selectedLeadIds.length} lead(s) successfully.`);
      resetBulkLeadActions();
      await fetchLeads(activeCampaign.id);
      await fetchCourierNames();
    } catch (error) {
      console.error(error);
      toast.error(getApiErrorMessage(error, "Failed to update selected leads."));
    } finally {
      setSavingLead(false);
    }
  };

  const deleteSelectedLeads = async () => {
    if (!activeCampaign?.id) return;

    if (!selectedLeadIds.length) {
      toast.error("Select at least one lead.");
      return;
    }

    const confirmed = window.confirm(`Delete ${selectedLeadIds.length} selected lead(s) from this campaign?`);
    if (!confirmed) return;

    setSavingLead(true);
    try {
      await axios.post(
        `${BASE_URL}/api/campaigns/${activeCampaign.id}/leads/bulk/`,
        {
          action: "delete",
          lead_ids: selectedLeadIds,
        },
        {
          headers: getAuthHeaders(),
        }
      );

      toast.success(`Deleted ${selectedLeadIds.length} lead(s) successfully.`);
      resetBulkLeadActions();
      await fetchLeads(activeCampaign.id);
      await fetchCourierNames();
    } catch (error) {
      console.error(error);
      toast.error(getApiErrorMessage(error, "Failed to delete selected leads."));
    } finally {
      setSavingLead(false);
    }
  };

  const openInlineEditor = (lead, mode) => {
    // Toggle: if same lead and mode clicked again, close the editor
    if (inlineEditLeadId === lead.id && inlineEditMode === mode) {
      resetLeadEditor();
      return;
    }

    setInlineEditLeadId(lead.id);
    setInlineEditMode(mode);
    setInlineEditForm({
      dispatch_date: normalizeDateValue(lead?.dispatch_date),
      expected_delivery_date: normalizeDateValue(lead?.expected_delivery_date),
      actual_delivery_date: normalizeDateValue(lead?.actual_delivery_date),
      courier_name: String(lead?.courier_name ?? ""),
      products: String(lead?.products ?? ""),
      docat: String(lead?.docat ?? lead?.customer_docat ?? lead?.customer?.docat ?? ""),
      client_status: String(lead?.client_status ?? ""),
      courier_status: String(lead?.courier_status ?? ""),
      courier_description: String(lead?.courier_description ?? ""),
      client_review: String(lead?.client_review ?? lead?.customer_reviews ?? lead?.reviews ?? lead?.customer?.reviews ?? "").trim(),
      notes: String(lead?.notes ?? ""),
    });
    // fetch attempts for this lead when opening dispatch modal
    if (mode === "dispatch") {
      (async () => {
        if (!activeCampaign?.id) return;
        setAttemptsLoading(true);
        try {
          const resp = await axios.get(`${BASE_URL}/api/campaigns/${activeCampaign.id}/leads/${lead.id}/attempts/`, { headers: getAuthHeaders() });
          const existing = Array.isArray(resp.data) ? resp.data : [];
          // Build synthetic attempt 1 from the lead's original dispatch data.
          const syntheticAttempt1 = {
            id: `lead-original-${lead.id}`,
            attempt_number: 1,
            dispatch_date: lead.dispatch_date || null,
            expected_delivery_date: lead.expected_delivery_date || null,
            actual_delivery_date: lead.actual_delivery_date || null,
            courier_name: lead.courier_name || "",
            courier_status: lead.courier_status || lead.status || "",
            courier_description: lead.courier_description || "",
            notes: lead.notes || "",
            _isFromLead: true,
          };

          const renumberedExisting = existing.map((attempt, index) => ({
            ...attempt,
            attempt_number: index + 2,
          }));

          const allAttempts = [syntheticAttempt1, ...renumberedExisting];
          setLeadAttempts(allAttempts);

          // Next new attempt is always one after the current visible history.
          const nextNumber = allAttempts.length + 1;
          setNewAttemptNumber(nextNumber);
          setSelectedAttempt(null);
          // Dispatch (resend): always start fresh so user fills in new details
          setInlineEditForm({
            dispatch_date: "",
            expected_delivery_date: "",
            actual_delivery_date: "",
            courier_name: "",
            docat: String(lead?.docat ?? lead?.customer_docat ?? lead?.customer?.docat ?? ""),
            client_status: String(lead?.client_status ?? ""),
            courier_status: "Dispatched",
            courier_description: "",
            client_review: String(lead?.client_review ?? lead?.customer_reviews ?? lead?.reviews ?? lead?.customer?.reviews ?? "").trim(),
            notes: "",
          });
        } catch (error) {
          console.error(error);
          toast.error(getApiErrorMessage(error, 'Failed to load attempts.'));
          setLeadAttempts([]);
          setNewAttemptNumber(null);
          setSelectedAttempt(null);
        } finally {
          setAttemptsLoading(false);
        }
      })();
    } else {
      setLeadAttempts([]);
      setNewAttemptNumber(null);
      setSelectedAttempt(null);
    }
  };

  const saveInlineLead = async (lead) => {
    if (!activeCampaign?.id) return;

    const payload = {};
    const rawDispatchDate = inlineEditForm.dispatch_date.trim();
    const rawExpectedDeliveryDate = inlineEditForm.expected_delivery_date.trim();
    const rawActualDeliveryDate = inlineEditForm.actual_delivery_date.trim();
    const dispatchDate = normalizeApiDateInput(rawDispatchDate);
    const expectedDeliveryDate = normalizeApiDateInput(rawExpectedDeliveryDate);
    const actualDeliveryDate = normalizeApiDateInput(rawActualDeliveryDate);

    if (rawDispatchDate && !dispatchDate) {
      toast.error("Dispatch date format is invalid. Use YYYY-MM-DD.");
      return;
    }

    if (rawExpectedDeliveryDate && !expectedDeliveryDate) {
      toast.error("Expected delivery date format is invalid. Use YYYY-MM-DD.");
      return;
    }

    if (rawActualDeliveryDate && !actualDeliveryDate) {
      toast.error("Actual delivery date format is invalid. Use YYYY-MM-DD.");
      return;
    }



    if (inlineEditMode === "dispatch") {
      if (!dispatchDate || !expectedDeliveryDate) {
        toast.error("Dispatch date and expected delivery date are required.");
        return;
      }

      payload.dispatch_date = dispatchDate;
      payload.expected_delivery_date = expectedDeliveryDate;
      if (actualDeliveryDate) payload.actual_delivery_date = actualDeliveryDate;
      payload.courier_name = inlineEditForm.courier_name.trim();
      if (inlineEditForm.products.trim()) payload.products = inlineEditForm.products.trim();
      payload.courier_status = inlineEditForm.courier_status.trim() || "Dispatched";
      if ((inlineEditForm.courier_description || '').trim()) payload.courier_description = inlineEditForm.courier_description.trim();
      if ((inlineEditForm.notes || '').trim()) payload.notes = inlineEditForm.notes.trim();
    }

    if (inlineEditMode === "edit") {
      const updatedStatus = inlineEditForm.courier_status.trim();

      if (updatedStatus === "Dispatched" && (!dispatchDate || !expectedDeliveryDate)) {
        toast.error("Dispatch date and expected delivery date are required for Dispatched status.");
        return;
      }

      if (updatedStatus === "Delivered" && !actualDeliveryDate) {
        toast.error("Actual delivery date is required for Delivered status.");
        return;
      }

      if (dispatchDate) payload.dispatch_date = dispatchDate;
      if (expectedDeliveryDate) payload.expected_delivery_date = expectedDeliveryDate;
      if (actualDeliveryDate) payload.actual_delivery_date = actualDeliveryDate;
      payload.courier_name = inlineEditForm.courier_name.trim();
      if (inlineEditForm.products.trim()) payload.products = inlineEditForm.products.trim();
      if (inlineEditForm.docat.trim()) payload.docat = inlineEditForm.docat.trim();
      const clientStatus = inlineEditForm.client_status.trim();
      const courierStatus = updatedStatus;
      if (clientStatus) payload.client_status = clientStatus;
      if (courierStatus) payload.courier_status = courierStatus;
      if ((inlineEditForm.courier_description || '').trim()) payload.courier_description = inlineEditForm.courier_description.trim();
      if ((inlineEditForm.client_review || '').trim()) payload.client_review = inlineEditForm.client_review.trim();
      payload.notes = inlineEditForm.notes.trim();
    }

    if (inlineEditMode === "failed") {
      const clientStatus = inlineEditForm.client_status.trim();
      if (clientStatus) payload.client_status = clientStatus;
      payload.courier_status = inlineEditForm.courier_status.trim() || "Failed";
      if (inlineEditForm.docat.trim()) payload.docat = inlineEditForm.docat.trim();
      if ((inlineEditForm.client_review || '').trim()) payload.client_review = inlineEditForm.client_review.trim();
      payload.status = "Failed";
      payload.notes = inlineEditForm.notes.trim();
    }

    setSavingLead(true);
    try {
      if (inlineEditMode === "dispatch") {
        // Create a new attempt record.
        await axios.post(
          `${BASE_URL}/api/campaigns/${activeCampaign.id}/leads/${lead.id}/attempts/`,
          payload,
          { headers: getAuthHeaders() }
        );

        const leadPatchPayload = {};
        if (inlineEditForm.docat.trim()) leadPatchPayload.docat = inlineEditForm.docat.trim();
        if (inlineEditForm.client_status.trim()) leadPatchPayload.client_status = inlineEditForm.client_status.trim();
        if ((inlineEditForm.client_review || '').trim()) leadPatchPayload.client_review = inlineEditForm.client_review.trim();
        if (Object.keys(leadPatchPayload).length > 0) {
          await axios.patch(
            `${BASE_URL}/api/campaigns/${activeCampaign.id}/leads/${lead.id}/`,
            leadPatchPayload,
            { headers: getAuthHeaders() }
          );
        }

        toast.success("Dispatch attempt created successfully.");
      } else {
        await axios.patch(
          `${BASE_URL}/api/campaigns/${activeCampaign.id}/leads/${lead.id}/`,
          payload,
          {
            headers: getAuthHeaders(),
          }
        );
        toast.success("Lead updated successfully.");
      }

      resetLeadEditor();
      await fetchLeads(activeCampaign.id);
      await fetchCourierNames();
    } catch (error) {
      console.error(error);
      toast.error(getApiErrorMessage(error, "Failed to update lead."));
    } finally {
      setSavingLead(false);
    }
  };

  const markLeadDelivered = async (lead) => {
    if (!activeCampaign?.id) return;

    setSavingLead(true);
    try {
      await axios.patch(
        `${BASE_URL}/api/campaigns/${activeCampaign.id}/leads/${lead.id}/`,
        {
          status: "Delivered",
          actual_delivery_date: todayIso,
          courier_status: "Delivered",
        },
        {
          headers: getAuthHeaders(),
        }
      );

      toast.success("Lead marked as delivered.");
      resetLeadEditor();
      await fetchLeads(activeCampaign.id);
      await fetchCourierNames();
    } catch (error) {
      console.error(error);
      toast.error(getApiErrorMessage(error, "Failed to mark delivered."));
    } finally {
      setSavingLead(false);
    }
  };

  const activeCampaignLabel = activeCampaign ? activeCampaign.name : "No campaign selected";
  const inlineEditingLead = useMemo(
    () => leads.find((item) => item.id === inlineEditLeadId) || null,
    [leads, inlineEditLeadId]
  );

  // Use the last non-synthetic attempt for preview, fallback to the lead.
  const latestSavedAttempt = Array.isArray(leadAttempts) && leadAttempts.length
    ? [...leadAttempts].reverse().find((attempt) => !attempt._isFromLead) || leadAttempts[leadAttempts.length - 1]
    : null;
  const resendPreviewLead = latestSavedAttempt || inlineEditingLead;

  const displayedAttempt = useMemo(() => {
    if (!selectedAttempt) return null;
    return selectedAttempt;
  }, [selectedAttempt, inlineEditForm]);

  const previewStatusValue = inlineEditMode === "dispatch"
    ? (resendPreviewLead?.courier_status || getLeadStatusLabel(resendPreviewLead) || "-")
    : (inlineEditingLead?.courier_status || getLeadStatusLabel(inlineEditingLead) || "-");

  const campaignMapMarkers = useMemo(() => {
    return (campaignMapLeads || []).map((lead, index) => {
      const city = String(lead?.city ?? "").trim() || "Unknown";
      const [baseLat, baseLng] = getCityCoordinates(city);
      const jitterLat = ((index * 0.07) % 0.4) - 0.2;
      const jitterLng = ((index * 0.11) % 0.4) - 0.2;
      return { ...lead, lat: baseLat + jitterLat, lng: baseLng + jitterLng };
    });
  }, [campaignMapLeads]);

  const getLeadDisplayStatus = (lead) => {
    return getLeadStatusLabel(lead);
  };

  const formatExportDate = () => {
    const now = new Date();
    return now.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getFileDateStamp = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}${mm}${dd}`;
  };

  const getLeadExportCellValue = (lead, key) => {
    switch (key) {
      case "name":
        return buildLeadName(lead);
      case "phone":
        return String(lead?.phone ?? "");
      case "docat":
        return String(lead?.docat ?? lead?.customer_docat ?? lead?.customer?.docat ?? "");
      case "address_line1":
        return buildAddressLabel(lead);
      case "city":
        return String(lead?.city ?? "");
      case "state":
        return String(lead?.state ?? "");
      case "courier_name":
        return String(lead?.courier_name ?? "");
      case "client_status":
        return String(lead?.client_status ?? "");
      case "dispatch_date":
        return normalizeDateValue(lead?.dispatch_date);
      case "expected_delivery_date":
        return normalizeDateValue(lead?.expected_delivery_date);
      case "actual_delivery_date":
        return normalizeDateValue(lead?.actual_delivery_date);
      case "client_review":
        return getLeadClientReviewValue(lead);
      case "products":
        return String(lead?.products ?? "");
      case "status":
        return getLeadDisplayStatus(lead);
      default:
        return String(lead?.[key] ?? "");
    }
  };

  const buildLeadExportTable = () => {
    const rowsSource = selectedLeadIds.length
      ? sortedLeads.filter((lead) => selectedLeadIds.includes(lead.id))
      : sortedLeads;
    const headers = leadTableColumns.map((column) => column.label);
    const rows = rowsSource.map((lead) =>
      leadTableColumns.map((column) => String(getLeadExportCellValue(lead, column.key) ?? ""))
    );
    return { headers, rows, count: rowsSource.length };
  };

  const exportLeadsExcel = () => {
    const { headers, rows, count } = buildLeadExportTable();
    if (!count) {
      toast.info("No leads available to export.");
      return;
    }

    const generatedOnExcel = new Date().toLocaleString("en-IN", {
      weekday: "short",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });

    const headersWithIndex = ["Sr No", ...headers];
    const rowsWithIndex = rows.map((row, index) => [String(index + 1), ...row]);
    const headerRowIndex = 5;

    const worksheet = XLSX.utils.aoa_to_sheet([
      ["Courier Tracking Report"],
      [`Campaign: ${activeCampaignLabel}`],
      [`Generated On: ${generatedOnExcel}`],
      [`Total Leads: ${count}`],
      [],
      headersWithIndex,
      ...rowsWithIndex,
    ]);

    const lastColumnIndex = headersWithIndex.length - 1;
    worksheet["!merges"] = [0, 1, 2, 3].map((rowIndex) => ({
      s: { r: rowIndex, c: 0 },
      e: { r: rowIndex, c: lastColumnIndex },
    }));

    worksheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: headerRowIndex, c: 0 },
        e: { r: headerRowIndex, c: lastColumnIndex },
      }),
    };

    worksheet["!rows"] = [
      { hpt: 26 },
      { hpt: 20 },
      { hpt: 20 },
      { hpt: 20 },
      { hpt: 8 },
      { hpt: 18 },
    ];

    worksheet["!cols"] = headersWithIndex.map((header, index) => {
      const maxDataLength = rowsWithIndex.reduce((max, row) => Math.max(max, String(row[index] ?? "").length), 0);
      const minWidth = index === 0 ? 8 : 12;
      return { wch: Math.min(Math.max(header.length, maxDataLength, minWidth), 40) };
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
    XLSX.writeFile(workbook, `courier_tracking_${getFileDateStamp()}.xlsx`);
  };

  const exportLeadsCsv = () => {
    const { headers, rows, count } = buildLeadExportTable();
    if (!count) {
      toast.info("No leads available to export.");
      return;
    }

    const headersWithIndex = ["Sr No", ...headers];
    const rowsWithIndex = rows.map((row, index) => [String(index + 1), ...row]);
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["Courier Tracking Report"],
      [`Campaign: ${activeCampaignLabel}`],
      [`Generated On: ${formatExportDate()}`],
      [`Total Leads: ${count}`],
      [],
      headersWithIndex,
      ...rowsWithIndex,
    ]);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `courier_tracking_${getFileDateStamp()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportLeadsPdf = () => {
    const { headers, rows, count } = buildLeadExportTable();
    if (!count) {
      toast.info("No leads available to export.");
      return;
    }

    const headersWithIndex = ["Sr No", ...headers];
    const rowsWithIndex = rows.map((row, index) => [String(index + 1), ...row]);

    const tableStartY = 84;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a3" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageMargins = { left: 8, right: 8 };
    const availableTableWidth = pageWidth - pageMargins.left - pageMargins.right;
    const normalizedHeaders = headersWithIndex.map((header) => String(header ?? "").toLowerCase());

    const baseWidths = headersWithIndex.map((header, index) => {
      const normalized = normalizedHeaders[index];
      const isNumberColumn = /phone|mobile|contact|number/.test(normalized);
      const isNameColumn = /name/.test(normalized);
      const isAddressColumn = /address|addr/.test(normalized);
      const minWidth = index === 0 ? 34 : 44;
      const maxWidth = index === 0 ? 40 : isAddressColumn ? 130 : 110;
      const estimated = String(header ?? "").length * 5 + 18;
      const priorityBoost = isAddressColumn ? 16 : isNameColumn ? 10 : isNumberColumn ? 8 : 0;
      return Math.max(minWidth, Math.min(maxWidth, estimated + priorityBoost));
    });
    const totalBaseWidth = baseWidths.reduce((sum, width) => sum + width, 0);
    const widthScale = totalBaseWidth > 0 ? availableTableWidth / totalBaseWidth : 1;
    const scaledWidths = baseWidths.map((width) => Math.max(28, Math.floor(width * widthScale)));
    const columnStyles = Object.fromEntries(
      scaledWidths.map((width, index) => {
        const normalized = normalizedHeaders[index];
        const isAddressColumn = /address|addr/.test(normalized);
        return [
          index,
          {
            cellWidth: width,
            overflow: isAddressColumn ? "linebreak" : "ellipsize",
            valign: isAddressColumn ? "top" : "middle",
          },
        ];
      })
    );
    doc.setFontSize(14);
    doc.text("Courier Tracking Report", pageMargins.left, 28);
    doc.setFontSize(10);
    doc.text(`Campaign: ${activeCampaignLabel}`, pageMargins.left, 44);
    doc.text(`Generated On: ${formatExportDate()}`, pageMargins.left, 58);
    doc.text(`Total Leads: ${count}`, pageMargins.left, 72);

    autoTable(doc, {
      startY: tableStartY,
      head: [headersWithIndex],
      body: rowsWithIndex,
      tableWidth: availableTableWidth,
      styles: {
        fontSize: 7,
        cellPadding: 3,
        lineColor: [230, 230, 230],
        lineWidth: 0.1,
        overflow: "ellipsize",
      },
      headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: pageMargins,
      columnStyles,
    });

    doc.save(`courier_tracking_${getFileDateStamp()}.pdf`);
  };

  if (onlyShowCampaignList) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        {showHeaderWhenList && (
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">Operations</p>
              <h1 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">Campaign Tracking</h1>
              <p className="mt-2 max-w-3xl text-sm text-gray-500 dark:text-gray-400">Create campaigns, assign customer leads, and manage dispatch, delivery, and failure tracking from one page.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={openCreateCampaignForm}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-blue-700 hover:shadow-md dark:bg-blue-500 dark:hover:bg-blue-600"
                title={showCreateForm ? "Close campaign form" : "Create campaign"}
                aria-label={showCreateForm ? "Close campaign form" : "Create campaign"}
              >
                <FaPlus className={`text-base transition-transform duration-200 ${showCreateForm ? "rotate-45" : ""}`} />
                <span>{showCreateForm ? "Close Form" : "Create Campaign"}</span>
              </button>
            </div>
          </div>
        )}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Campaign List</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Open a campaign to load and manage its leads.</p>
            </div>
            <div className="flex flex-col gap-2 md:min-w-[280px]">
              <label className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                <FaSearch className="text-gray-400" />
                <input
                  type="text"
                  value={campaignSearch}
                  onChange={(event) => setCampaignSearch(event.target.value)}
                  placeholder="Search campaigns"
                  className="w-full bg-transparent outline-none"
                />
              </label>
              {loadingCampaigns && <span className="text-sm text-gray-500 dark:text-gray-400">Loading campaigns...</span>}
            </div>
          </div>

          <div className="overflow-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-200">Name</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-200">Description</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-200">Start Date</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-200">Status</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-200">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCampaigns.map((campaign) => {
                  const isActive = activeCampaign?.id === campaign.id;
                  return (
                    <tr
                      key={campaign.id}
                      className={`border-t border-gray-200 dark:border-gray-700 ${isActive ? "bg-blue-50 dark:bg-blue-950/30" : ""}`}
                    >
                      <td className="px-3 py-3 font-medium text-gray-900 dark:text-white">{campaign.name}</td>
                      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{campaign.description || "-"}</td>
                      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{normalizeDateValue(campaign.start_date) || "-"}</td>
                      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                          {campaign.status || "Draft"}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => window.open(`/campaigns/${campaign.id}`, "_blank")}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-blue-600 transition-all duration-200 hover:scale-105 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            title="Open campaign in new page"
                            aria-label="Open campaign in new page"
                          >
                            <FaEye className="text-sm" />
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/track-map?campaign=${campaign.id}`)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-teal-600 transition-all duration-200 hover:scale-105 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300"
                            title="Open campaign map"
                            aria-label="Open campaign map"
                          >
                            <FaMapMarkerAlt className="text-sm" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditCampaignForm(campaign)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-amber-500 transition-all duration-200 hover:scale-105 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300"
                            title="Edit campaign"
                            aria-label="Edit campaign"
                          >
                            <FaEdit className="text-sm" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteCampaign(campaign)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-red-600 transition-all duration-200 hover:scale-105 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                            title="Delete campaign"
                            aria-label="Delete campaign"
                          >
                            <FaTrash className="text-sm" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {!filteredCampaigns.length && !loadingCampaigns && (
                  <tr className="border-t border-gray-200 dark:border-gray-700">
                    <td colSpan={5} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      No campaigns found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {showCampaignEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/50" onClick={closeCampaignEditModal} />
            <section className="relative z-10 w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-900">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Edit Campaign</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Update the campaign details in a modal instead of inline editing.</p>
                </div>
                <button
                  type="button"
                  onClick={closeCampaignEditModal}
                  className="rounded-full bg-gray-100 p-2 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  title="Close"
                  aria-label="Close"
                >
                  <FaTimes />
                </button>
              </div>

              <form onSubmit={handleCreateCampaignSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <input
                  value={createForm.name}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Campaign Name"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
                <input
                  type="date"
                  value={createForm.start_date}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, start_date: event.target.value }))}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
                <textarea
                  value={createForm.description}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Description"
                  rows={4}
                  className="md:col-span-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
                <div className="md:col-span-2 flex justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={closeCampaignEditModal}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-all duration-200"
                    title="Cancel"
                    aria-label="Cancel"
                  >
                    <FaTimes className="text-sm" />
                    <span>Cancel</span>
                  </button>
                  <button
                    type="submit"
                    disabled={savingCampaign}
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-all duration-200 ${savingCampaign ? 'bg-green-400/60 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 hover:shadow-md'}`}
                    title="Update campaign"
                    aria-label="Update campaign"
                  >
                    <FaSave className={savingCampaign ? "animate-pulse text-sm" : "text-sm"} />
                    <span>{savingCampaign ? "Updating..." : "Update"}</span>
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        {showCreateForm && (
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {campaignFormMode === "edit" ? "Edit Campaign" : "Create Campaign"}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Set up or update a campaign before adding customers as leads.</p>
              </div>
            </div>

            <form onSubmit={handleCreateCampaignSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <input
                value={createForm.name}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Campaign Name"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
              <input
                type="date"
                value={createForm.start_date}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, start_date: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
              <textarea
                value={createForm.description}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Description"
                rows={4}
                className="md:col-span-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
              <div className="md:col-span-2 flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeCampaignForm}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-all duration-200"
                  title="Cancel"
                  aria-label="Cancel"
                >
                  <FaTimes className="text-sm" />
                  <span>Cancel</span>
                </button>
                <button
                  type="submit"
                  disabled={savingCampaign}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-all duration-200 ${savingCampaign ? 'bg-green-400/60 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 hover:shadow-md'}`}
                  title={campaignFormMode === "edit" ? "Update campaign" : "Save campaign"}
                  aria-label={campaignFormMode === "edit" ? "Update campaign" : "Save campaign"}
                >
                  <FaSave className={savingCampaign ? "animate-pulse text-sm" : "text-sm"} />
                  <span>{savingCampaign ? (campaignFormMode === "edit" ? 'Updating...' : 'Saving...') : (campaignFormMode === "edit" ? 'Update' : 'Save')}</span>
                </button>
              </div>
            </form>
          </section>
        )}
        
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between w-full">
  <div>
    <p className="text-sm font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">Operations</p>
    <h1 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">Campaign Tracking</h1>
    <p className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">
      Create campaigns, assign customer leads, and manage dispatch, delivery, and failure tracking from one page.
    </p>
  </div>

 {activeCampaign && (
  <div className="grid grid-cols-5 gap-3 xl:min-w-[560px]">
    {leadStatusKpiCards.map((card) => {
      const isActive = String(leadFilters.status ?? "") === card.value;
      return (
        <button
          key={card.value}
          type="button"
          onClick={() => applyLeadStatusFilter(card.value)}
          className={`group relative overflow-hidden rounded-2xl border px-3 py-3 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
            isActive
              ? "border-blue-500 bg-blue-600 text-white"
              : "border-gray-200 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          }`}
          title={`Filter by ${card.label}`}
        >
          <span className={`absolute left-0 top-0 h-full w-1.5 rounded-r-full ${isActive ? "bg-white/90" : "bg-blue-500"}`} />
          <div className="pl-2">
            <div className={`text-[18px] font-bold uppercase tracking-wide ${isActive ? "text-white/80" : "text-gray-500 dark:text-gray-400"}`}>
              {card.label}
            </div>
            <div className="mt-1.5 flex items-end gap-2">
              <span className={`text-3xl font-semibold leading-none ${isActive ? "text-white" : "text-gray-900 dark:text-white"}`}>
                {card.count}
              </span>
              <span className={`mb-0.5 text-[10px] font-semibold uppercase tracking-wide ${isActive ? "text-white/70" : "text-gray-400 dark:text-gray-500"} group-hover:opacity-90`}>
                {isActive ? "Active" : ""}
              </span>
            </div>
          </div>
        </button>
      );
    })}
  </div>
)}
</div>
        
        </div>

      

      {!showOnlyActive && (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Campaign List</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Open a campaign to load and manage its leads.</p>
          </div>
          <div className="flex flex-col gap-2 md:min-w-[280px]">
            <label className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
              <FaSearch className="text-gray-400" />
              <input
                type="text"
                value={campaignSearch}
                onChange={(event) => setCampaignSearch(event.target.value)}
                placeholder="Search campaigns"
                className="w-full bg-transparent outline-none"
              />
            </label>
            {loadingCampaigns && <span className="text-sm text-gray-500 dark:text-gray-400">Loading campaigns...</span>}
          </div>
        </div>

        <div className="overflow-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-200">Name</th>
                <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-200">Description</th>
                <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-200">Start Date</th>
                <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-200">Status</th>
                <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-200">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCampaigns.map((campaign) => {
                const isActive = activeCampaign?.id === campaign.id;
                return (
                  <tr
                    key={campaign.id}
                    className={`border-t border-gray-200 dark:border-gray-700 ${isActive ? "bg-blue-50 dark:bg-blue-950/30" : ""}`}
                  >
                    <td className="px-3 py-3 font-medium text-gray-900 dark:text-white">{campaign.name}</td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{campaign.description || "-"}</td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{normalizeDateValue(campaign.start_date) || "-"}</td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                        {campaign.status || "Draft"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => window.open(`/campaigns/${campaign.id}`, "_blank")}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-blue-600 transition-all duration-200 hover:scale-105 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                          title="Open campaign in new page"
                          aria-label="Open campaign in new page"
                        >
                          <FaEye className="text-sm" />
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/track-map?campaign=${campaign.id}`)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-teal-600 transition-all duration-200 hover:scale-105 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300"
                          title="Open campaign map"
                          aria-label="Open campaign map"
                        >
                          <FaMapMarkerAlt className="text-sm" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditCampaignForm(campaign)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-amber-500 transition-all duration-200 hover:scale-105 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300"
                          title="Edit campaign"
                          aria-label="Edit campaign"
                        >
                          <FaEdit className="text-sm" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCampaign(campaign)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-red-600 transition-all duration-200 hover:scale-105 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          title="Delete campaign"
                          aria-label="Delete campaign"
                        >
                          <FaTrash className="text-sm" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!filteredCampaigns.length && !loadingCampaigns && (
                <tr className="border-t border-gray-200 dark:border-gray-700">
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    No campaigns found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </section>
      )}

      {activeCampaign && (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              {renderActiveHeaderExtras}
              <p className="text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400">Active Campaign</p>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{activeCampaignLabel}</h2>
              <div className="mt-3 max-w-sm">
                <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                  Campaign
                  <select
                    value={activeCampaign?.id || ""}
                    onChange={handleCampaignSelectionChange}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    {campaignOptions.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.name || `Campaign ${campaign.id}`}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:items-end">
              <div className="grid w-full max-w-[520px] grid-cols-5 gap-2">
                {/* {leadStatusKpiCards.map((card) => {
                  const isActive = String(leadFilters.status ?? "") === card.value;
                  return (
                    <button
                      key={card.value}
                      type="button"
                      onClick={() => applyLeadStatusFilter(card.value)}
                      className={`group relative overflow-hidden rounded-xl border px-2.5 py-2 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
                        isActive
                          ? "border-blue-500 bg-blue-600 text-white"
                          : "border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                      }`}
                      title={`Filter by ${card.label}`}
                      aria-label={`Filter by ${card.label}`}
                    >
                      <span className={`absolute left-0 top-0 h-full w-1 rounded-r-full ${isActive ? "bg-white/90" : "bg-blue-500/70 opacity-70"}`} />
                      <div className="pl-1">
                        <div className="text-[10px] uppercase tracking-wide opacity-70">{card.label}</div>
                        <div className="mt-1 flex items-end gap-2">
                          <span className="text-lg font-semibold leading-none">{card.count}</span>
                          <span className="text-[10px] uppercase tracking-wide opacity-60 group-hover:opacity-90">
                            {isActive ? "Active" : "Click"}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })} */}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={toggleLeadFilters}
                  className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 hover:shadow-sm ${
                    showLeadFilters
                      ? "text-slate-800 dark:text-white"
                      : "text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200"
                  }`}
                  title="Toggle filters"
                  aria-label="Toggle filters"
                >
                  <FaFilter className="text-base" />
                  <span>Filters</span>
                </button>
                <button
                  type="button"
                  onClick={toggleBulkEditPanel}
                  className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 hover:shadow-sm ${
                    showBulkEditPanel
                      ? "text-indigo-700 dark:text-white"
                      : "text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-200"
                  }`}
                  title="Toggle bulk edit"
                  aria-label="Toggle bulk edit"
                >
                  <FaEdit className="text-base" />
                  <span>Bulk Edit</span>
                </button>
                <button
                  type="button"
                  onClick={clearLeadFilters}
                  className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition-all duration-200 hover:shadow-sm hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  title="Clear all filters"
                  aria-label="Clear all filters"
                >
                  <FaRedo className="text-base" />
                  <span>Clear Filters</span>
                </button>
                <button
                  type="button"
                  onClick={openAddLeadsModal}
                  className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-green-600 transition-all duration-200 hover:shadow-sm hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                  title="Bulk upload"
                  aria-label="Bulk upload"
                >
                  <FaPlus className="text-base" />
                  <span>Bulk Upload</span>
                </button>
                <button
                  type="button"
                  onClick={openAddSingleLeadModal}
                  className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-blue-600 transition-all duration-200 hover:shadow-sm hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  title="Add lead"
                  aria-label="Add lead"
                >
                  <FaPlus className="text-base" />
                  <span>Add Lead</span>
                </button>
                <button
                  type="button"
                  onClick={toggleSelectAllLeads}
                  className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-indigo-700 hover:shadow-md"
                  title="Select all table leads"
                  aria-label="Select all table leads"
                >
                  <span>Select All</span>
                </button>
                <button
                  type="button"
                  onClick={exportLeadsCsv}
                  className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-sky-700 hover:shadow-md"
                  title="Export CSV"
                  aria-label="Export CSV"
                >
                  <span>CSV</span>
                </button>
                <button
                  type="button"
                  onClick={exportLeadsExcel}
                  className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-emerald-700 hover:shadow-md"
                  title="Export Excel"
                  aria-label="Export Excel"
                >
                  <span>Excel</span>
                </button>
                <button
                  type="button"
                  onClick={exportLeadsPdf}
                  className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-rose-700 hover:shadow-md"
                  title="Export PDF"
                  aria-label="Export PDF"
                >
                  <span>PDF</span>
                </button>
              </div>
            </div>
          </div>

          {showLeadFilters && (
            <div className="mb-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-950/40">
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-7">
                <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                  Search leads
                  <input
                    value={leadSearch}
                    onChange={(event) => setLeadSearch(event.target.value)}
                    placeholder="Search by name, phone, address, city, state, courier"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                  Status
                  <select
                    value={leadFilters.status}
                    onChange={(event) => setLeadFilters((prev) => ({ ...prev, status: event.target.value }))}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Dispatched">Dispatched</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Failed">Failed</option>
                    <option value="Returned">Returned</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                  Client Status
                  <select
                    value={leadFilters.clientStatus}
                    onChange={(event) => setLeadFilters((prev) => ({ ...prev, clientStatus: event.target.value }))}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="All">All Client Statuses</option>
                    {leadClientStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                  Courier Name
                  <select
                    value={leadFilters.courier}
                    onChange={(event) => setLeadFilters((prev) => ({ ...prev, courier: event.target.value }))}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="">All Couriers</option>
                    {courierNameOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                  Uploaded File
                  <select
                    value={leadFilters.fileName}
                    onChange={(event) => setLeadFilters((prev) => ({ ...prev, fileName: event.target.value }))}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="">All Files</option>
                    {leadFileOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                  Expected Delivery Date
                  <input
                    value={leadFilters.expectedDate}
                    onChange={(event) => setLeadFilters((prev) => ({ ...prev, expectedDate: event.target.value }))}
                    type="date"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                  State
                  <select
                    value={leadFilters.state}
                    onChange={(event) => setLeadFilters((prev) => ({ ...prev, state: event.target.value }))}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="">All States</option>
                    {leadStateOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                  City
                  <select
                    value={leadFilters.city}
                    onChange={(event) => setLeadFilters((prev) => ({ ...prev, city: event.target.value }))}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="">All Cities</option>
                    {leadCityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

            </div>
          )}

          {showBulkEditPanel && (
            <div className="mb-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-950/40">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Bulk Edit</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Select multiple leads, then update courier, date, or status together.
                  </p>
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">Selected leads: {selectedLeadCount}</p>
                </div>

                <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-6 lg:max-w-7xl">
                  <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                    Courier Status
                    <select
                      value={bulkLeadForm.status}
                      onChange={(event) => updateBulkLeadField("status", event.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="">No Change</option>
                      <option value="Pending">Pending</option>
                      <option value="Dispatched">Dispatched</option>
                      <option value="Delivered">Delivered</option>
                      <option value="Failed">Failed</option>
                      <option value="Returned">Returned</option>
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                    Client Status
                    <select
                      value={bulkLeadForm.client_status}
                      onChange={(event) => updateBulkLeadField("client_status", event.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="">No Change</option>
                      {leadClientStatusOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                    Courier Name
                    <div className="relative">
                      <input
                        type="text"
                        value={bulkLeadForm.courier_name}
                        onFocus={() => setBulkCourierDropdownOpen(true)}
                        onChange={(event) => {
                          updateBulkLeadField("courier_name", event.target.value);
                          setBulkCourierDropdownOpen(true);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            commitBulkCourierName();
                          }
                        }}
                        onBlur={() => {
                          window.setTimeout(() => setBulkCourierDropdownOpen(false), 150);
                        }}
                        placeholder="Type or choose a courier"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />

                      {bulkCourierDropdownOpen && filteredCourierNameOptions.length > 0 && (
                        <div className="absolute left-0 top-full z-50 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
                          {filteredCourierNameOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onMouseDown={(event) => {
                                event.preventDefault();
                                selectBulkCourierSuggestion(option.label);
                              }}
                              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-gray-700 hover:bg-blue-50 dark:text-gray-200 dark:hover:bg-blue-950/40"
                            >
                              <span>{option.label}</span>
                              <span className="text-xs text-gray-400">Use</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </label>

                  <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                    Dispatch Date
                    <input
                      type="date"
                      value={bulkLeadForm.dispatch_date}
                      onChange={(event) => updateBulkLeadField("dispatch_date", event.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                    Expected Delivery Date
                    <input
                      type="date"
                      value={bulkLeadForm.expected_delivery_date}
                      onChange={(event) => updateBulkLeadField("expected_delivery_date", event.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                    Actual Delivery Date
                    <input
                      type="date"
                      value={bulkLeadForm.actual_delivery_date}
                      onChange={(event) => updateBulkLeadField("actual_delivery_date", event.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </label>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <button
                      type="button"
                      onClick={applyBulkLeadUpdates}
                      disabled={savingLead || !selectedLeadIds.length}
                      className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {savingLead ? "Saving..." : "Update"}
                    </button>
                    <button
                      type="button"
                      onClick={deleteSelectedLeads}
                      disabled={savingLead || !selectedLeadIds.length}
                      className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Delete
                    </button>
                   
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="min-w-[1500px] text-sm">
              <thead className="bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-200">
                    <input
                      type="checkbox"
                      checked={allVisibleLeadsSelected}
                      onChange={toggleSelectAllVisibleLeads}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  {leadTableColumns.map((column) => (
                    <th key={column.key} className={`px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-200 ${column.className || ""}`}>
                      <button
                        type="button"
                        onClick={() => handleLeadSort(column.key)}
                        className="flex items-center gap-1 text-left hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        <span>{column.label}</span>
                        {leadSortKey === column.key && (
                          <span className="text-xs">{leadSortDirection === "asc" ? "▲" : "▼"}</span>
                        )}
                      </button>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-200">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingLeads && (
                  <tr className="border-t border-gray-200 dark:border-gray-700">
                    <td colSpan={leadTableColumns.length + 2} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      Loading leads...
                    </td>
                  </tr>
                )}

                {!loadingLeads && paginatedLeads.map((lead) => {
                  const callToday = normalizeDateValue(lead?.expected_delivery_date) === todayIso;
                  const status = getLeadDisplayStatus(lead);
                  const rowBackground = inlineEditLeadId === lead.id
                    ? "bg-blue-50 dark:bg-blue-950/30"
                    : callToday && status === "Pending"
                      ? "bg-yellow-50 dark:bg-yellow-950/30"
                      : "";

                  return (
                    <React.Fragment key={lead.id}>
                      <tr className={`border-t border-gray-200 dark:border-gray-700 ${rowBackground}`}>
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={selectedLeadIds.includes(lead.id)}
                            onChange={() => toggleLeadSelection(lead.id)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-3 py-3 text-gray-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{buildLeadName(lead)}</span>
                            {callToday && (
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full text-yellow-600 dark:text-yellow-400" title="Call today" aria-label="Call today">
                                <FaPhoneAlt className="text-[10px]" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{lead.phone || "-"}</td>
                        <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{lead.customer_docat || lead.customer?.docat || "-"}</td>
                        <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{buildAddressLabel(lead)}</td>
                        <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{lead.city || "-"}</td>
                        <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{lead.state || "-"}</td>
                        <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{lead.courier_name || "-"}</td>
                        <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{formatProductsValue(lead?.products)}</td>
                        <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{lead.client_status || "-"}</td>
                        <td className="px-3 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[120px]">{normalizeDateValue(lead.dispatch_date) || "-"}</td>
                        <td className="px-3 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[140px]">{normalizeDateValue(lead.expected_delivery_date) || "-"}</td>
                        <td className="px-3 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[120px]">{normalizeDateValue(lead.actual_delivery_date) || "-"}</td>
                        <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{getLeadClientReviewValue(lead) || "-"}</td>
                        <td className={`px-3 py-3 font-medium ${
                          status === "Pending"
                            ? "text-amber-600 dark:text-amber-300"
                            : status === "Dispatched"
                              ? "text-blue-600 dark:text-blue-300"
                              : status === "Delivered"
                                ? "text-green-600 dark:text-green-300"
                                : status === "Failed"
                                  ? "text-red-600 dark:text-red-300"
                                  : "text-violet-600 dark:text-violet-300"
                        }`}>
                          {status}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-nowrap items-center gap-2">
                            {(["Delivered", "Failed", "Returned"].includes(status)) && (
                              <button
                                type="button"
                                onClick={() => openInlineEditor(lead, "dispatch")}
                                className="inline-flex h-8 items-center justify-center rounded-full border border-violet-200 bg-violet-50 px-3 text-xs font-medium text-violet-700 transition-all duration-200 hover:scale-105 hover:bg-violet-100 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-200 dark:hover:bg-violet-900/60"
                                title="Resend lead"
                                aria-label="Resend lead"
                              >
                                <FaRedo className="text-sm" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openInlineEditor(lead, "edit")}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-blue-600 transition-all duration-200 hover:scale-105 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                              title="Edit lead"
                              aria-label="Edit lead"
                            >
                              <FaEdit className="text-sm" />
                            </button>
                          </div>
                        </td>
                      </tr>

                    </React.Fragment>
                  );
                })}

                {!loadingLeads && !paginatedLeads.length && (
                  <tr className="border-t border-gray-200 dark:border-gray-700">
                    <td colSpan={leadTableColumns.length + 2} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      No leads found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 text-sm text-gray-600 dark:text-gray-300 sm:flex-row sm:items-center sm:gap-4">
              <span>
                Showing {sortedLeads.length ? leadStartIndex + 1 : 0}-{Math.min(leadStartIndex + leadRowsPerPage, sortedLeads.length)} of {sortedLeads.length}
              </span>
              <span>
                Page {safeLeadPage} of {leadTotalPages}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setLeadPage((prev) => Math.max(1, prev - 1))}
                disabled={safeLeadPage <= 1}
                className="rounded-lg bg-gray-200 px-3 py-2 text-sm text-gray-800 hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
              >
                Prev
              </button>

              <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
                <label className="text-sm text-gray-600 dark:text-gray-300">Rows per page</label>
                <select
                  value={leadRowsPerPage}
                  onChange={(event) => {
                    setLeadRowsPerPage(Number(event.target.value));
                    setLeadPage(1);
                  }}
                  className="bg-transparent text-sm text-gray-900 outline-none dark:text-white"
                >
                  {rowsPerPageOptions.map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => setLeadPage((prev) => Math.min(leadTotalPages, prev + 1))}
                disabled={safeLeadPage >= leadTotalPages}
                className="rounded-lg bg-gray-200 px-3 py-2 text-sm text-gray-800 hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      )}

      {inlineEditLeadId && inlineEditingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={resetLeadEditor}>
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-gray-900" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-5 dark:border-gray-700">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {inlineEditMode === "dispatch" ? (
                    `Resend — Attempt ${newAttemptNumber ?? (leadAttempts.length + 1)}`
                  ) : inlineEditMode === "failed" ? "Mark as Failed" : "Edit Lead"}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Update the lead details below and save.</p>
                {/* {inlineEditMode === "dispatch" && (
                  <div className="mt-3">
                    <div className="overflow-auto rounded-md border border-gray-200 bg-gray-50 p-2 text-sm">
                      <table className="w-full table-fixed text-sm">
                        <tbody>
                          <tr>
                            <td className="font-medium pr-3">Attempt #</td>
                            <td>{newAttemptNumber ?? (leadAttempts.length + 1)}</td>
                          </tr>
                          <tr>
                            <td className="font-medium pr-3">Dispatch Date</td>
                            <td>{resendPreviewLead?.dispatch_date || '-'}</td>
                          </tr>
                          <tr>
                            <td className="font-medium pr-3">Expected Delivery</td>
                            <td>{resendPreviewLead?.expected_delivery_date || '-'}</td>
                          </tr>
                          <tr>
                            <td className="font-medium pr-3">Actual Delivery</td>
                            <td>{resendPreviewLead?.actual_delivery_date || '-'}</td>
                          </tr>
                          <tr>
                            <td className="font-medium pr-3">Courier Name</td>
                            <td>{resendPreviewLead?.courier_name || '-'}</td>
                          </tr>
                          <tr>
                            <td className="font-medium pr-3">Prev Status</td>
                            <td>{previewStatusValue}</td>
                          </tr>
                          <tr>
                            <td className="font-medium pr-3">Description</td>
                            <td>{resendPreviewLead?.courier_description || '-'}</td>
                          </tr>
                          <tr>
                            <td className="font-medium pr-3">Notes</td>
                            <td>{resendPreviewLead?.notes || '-'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )} */}
              </div>
            </div>

            <div className="overflow-y-auto p-5">
              {inlineEditMode === "failed" ? (
                <div className="grid grid-cols-1 gap-4">
                  <textarea
                    value={inlineEditForm.notes}
                    onChange={(event) => setInlineEditForm((prev) => ({ ...prev, notes: event.target.value }))}
                    rows={4}
                    placeholder="Notes"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {(inlineEditMode === "dispatch" || inlineEditMode === "edit") && (
                    <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                      Dispatch Date
                      <input
                        type="date"
                        value={inlineEditForm.dispatch_date}
                        onChange={(event) => setInlineEditForm((prev) => ({ ...prev, dispatch_date: event.target.value }))}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    </label>
                  )}

                  {(inlineEditMode === "dispatch" || inlineEditMode === "edit") && (
                    <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                      Expected Delivery Date
                      <input
                        type="date"
                        value={inlineEditForm.expected_delivery_date}
                        onChange={(event) => setInlineEditForm((prev) => ({ ...prev, expected_delivery_date: event.target.value }))}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    </label>
                  )}

                  {(inlineEditMode === "dispatch" || inlineEditMode === "edit") && (
                    <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                      Actual Delivery Date
                      <input
                        type="date"
                        value={inlineEditForm.actual_delivery_date}
                        onChange={(event) => setInlineEditForm((prev) => ({ ...prev, actual_delivery_date: event.target.value }))}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    </label>
                  )}

                  {(inlineEditMode === "dispatch" || inlineEditMode === "edit") && (
                    <div className="md:col-span-2 xl:col-span-3">
                      <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                        Products
                        <div className="relative">
                          <input
                            value={inlineEditForm.products}
                            onFocus={() => setProductsDropdownOpen(true)}
                            onChange={(event) => {
                              const v = event.target.value;
                              setInlineEditForm((prev) => ({ ...prev, products: v }));
                              setProductsDropdownOpen(Boolean(v.trim()));
                            }}
                            onBlur={() => window.setTimeout(() => setProductsDropdownOpen(false), 150)}
                            placeholder="Type products, comma separated (e.g. Product A, Product B)"
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                          />

                          {productsDropdownOpen && mergedProductOptions.length > 0 && (
                            <div className="absolute left-0 top-full z-50 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
                              {mergedProductOptions
                                .filter((p) => {
                                  const lastTerm = inlineEditForm.products.split(",").pop().trim().toLowerCase();
                                  return !lastTerm || p.toLowerCase().includes(lastTerm);
                                })
                                .slice(0, 8)
                                .map((product) => (
                                  <button
                                    key={product}
                                    type="button"
                                    onMouseDown={(event) => {
                                      event.preventDefault();
                                      const existing = inlineEditForm.products.split(",").slice(0, -1).map(p => p.trim()).filter(Boolean);
                                      const next = [...existing, product].join(", ");
                                      setInlineEditForm((prev) => ({ ...prev, products: next + ", " }));
                                      setProductsDropdownOpen(false);
                                    }}
                                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-gray-700 hover:bg-blue-50 dark:text-gray-200 dark:hover:bg-blue-950/40"
                                  >
                                    <span>{product}</span>
                                    <span className="text-xs text-gray-400">Add</span>
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                      </label>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Enter multiple products separated by commas. Existing products from leads will appear as suggestions.</p>
                    </div>
                  )}

                  {(inlineEditMode === "dispatch" || inlineEditMode === "edit") && (
                    <div className="md:col-span-2 xl:col-span-3">
                      <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                        Courier Name
                        <div className="relative">
                          <input
                            value={inlineEditForm.courier_name}
                            onFocus={() => setCourierDropdownOpen(true)}
                            onChange={(event) => {
                              setInlineEditForm((prev) => ({ ...prev, courier_name: event.target.value }));
                              setCourierDropdownOpen(true);
                            }}
                            onBlur={() => {
                              window.setTimeout(() => setCourierDropdownOpen(false), 150);
                            }}
                            placeholder="Select an existing courier or type a new name"
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                          />

                          {courierDropdownOpen && filteredCourierNameOptions.length > 0 && (
                            <div className="absolute left-0 top-full z-50 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
                              {filteredCourierNameOptions.map((option) => (
                                <button
                                  key={option.value}
                                  type="button"
                                  onMouseDown={(event) => {
                                    event.preventDefault();
                                    selectCourierSuggestion(option.label);
                                  }}
                                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-gray-700 hover:bg-blue-50 dark:text-gray-200 dark:hover:bg-blue-950/40"
                                >
                                  <span>{option.label}</span>
                                  <span className="text-xs text-gray-400">Use</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </label>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Choose from existing courier names or type a new one to save it on this lead.</p>
                    </div>
                  )}

                  <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                    Docat
                    <input
                      type="text"
                      value={inlineEditForm.docat}
                      onChange={(event) => setInlineEditForm((prev) => ({ ...prev, docat: event.target.value }))}
                      placeholder="Enter docat"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                    Client Status
                    <select
                      value={inlineEditForm.client_status}
                      onChange={(event) => setInlineEditForm((prev) => ({ ...prev, client_status: event.target.value }))}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="">No Change</option>
                      <option value="Pending">Pending</option>
                      <option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                    Courier Status
                    <select
                      value={inlineEditForm.courier_status}
                      onChange={(event) => setInlineEditForm((prev) => ({ ...prev, courier_status: event.target.value }))}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="">No Change</option>
                      <option value="Pending">Pending</option>
                      <option value="Dispatched">Dispatched</option>
                      <option value="Delivered">Delivered</option>
                      <option value="Failed">Failed</option>
                      <option value="Returned">Returned</option>
                    </select>
                  </label>

                  {(inlineEditMode === "dispatch" || inlineEditMode === "edit") && (
                    <label className="md:col-span-2 xl:col-span-3 flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                      Courier Description
                      <textarea
                        value={inlineEditForm.courier_description}
                        onChange={(event) => setInlineEditForm((prev) => ({ ...prev, courier_description: event.target.value }))}
                        rows={2}
                        placeholder="Short description or notes for the courier"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    </label>
                  )}

                  {inlineEditMode === "dispatch" && (
                    <div className="md:col-span-2 xl:col-span-3">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Attempts</label>
                      <div className="mt-2">
                        {attemptsLoading ? (
                          <div className="text-sm text-gray-500">Loading attempts...</div>
                        ) : (
                          <>
                            {/* Past attempts table */}
                            {Array.isArray(leadAttempts) && leadAttempts.length > 0 ? (
                              <div className="overflow-auto rounded-lg border border-gray-200 bg-white">
                                <table className="w-full table-auto text-sm">
                                  <thead>
                                    <tr className="bg-gray-50">
                                      <th className="px-3 py-2 text-left">Attempt #</th>
                                      <th className="px-3 py-2 text-left">Dispatch Date</th>
                                      <th className="px-3 py-2 text-left">Expected Delivery</th>
                                      <th className="px-3 py-2 text-left">Actual Delivery</th>
                                      <th className="px-3 py-2 text-left">Courier Name</th>
                                      <th className="px-3 py-2 text-left">Courier Status</th>
                                      <th className="px-3 py-2 text-left">Description</th>
                                      <th className="px-3 py-2 text-left">Notes</th>
                                      <th className="px-3 py-2 text-left">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {leadAttempts.map((a, idx) => (
                                      <tr
                                        key={a.id}
                                        className={`border-t ${selectedAttempt?.id === a.id ? "bg-blue-50" : ""}`}
                                      >
                                        <td className="px-3 py-2 font-medium">{a.attempt_number ?? idx + 1}</td>
                                        <td className="px-3 py-2">{a.dispatch_date || '-'}</td>
                                        <td className="px-3 py-2">{a.expected_delivery_date || '-'}</td>
                                        <td className="px-3 py-2">{a.actual_delivery_date || '-'}</td>
                                        <td className="px-3 py-2">{a.courier_name || '-'}</td>
                                        <td className="px-3 py-2">{a.courier_status || '-'}</td>
                                        <td className="px-3 py-2">{a.courier_description || '-'}</td>
                                        <td className="px-3 py-2">{a.notes || '-'}</td>
                                        <td className="px-3 py-2">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setInlineEditForm((prev) => ({
                                                ...prev,
                                                dispatch_date: normalizeDateValue(a.dispatch_date) || prev.dispatch_date,
                                                expected_delivery_date: normalizeDateValue(a.expected_delivery_date) || prev.expected_delivery_date,
                                                actual_delivery_date: normalizeDateValue(a.actual_delivery_date) || prev.actual_delivery_date,
                                                courier_name: String(a.courier_name || prev.courier_name),
                                                courier_status: String(a.courier_status || prev.courier_status),
                                                courier_description: String(a.courier_description || prev.courier_description),
                                                notes: String(a.notes || prev.notes),
                                              }));
                                              setSelectedAttempt(a);
                                            }}
                                            className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
                                          >
                                            Load
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="text-sm text-gray-500">No previous attempts for this lead.</div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Preview table removed — form fields above already show attempt details. */}
                    </div>
                  )}

                  <label className="md:col-span-2 xl:col-span-3 flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                    Client Review / Reviews
                    <textarea
                      value={inlineEditForm.client_review}
                      onChange={(event) => setInlineEditForm((prev) => ({ ...prev, client_review: event.target.value }))}
                      rows={2}
                      placeholder={String(inlineEditingLead?.reviews ?? inlineEditingLead?.customer?.reviews ?? inlineEditingLead?.customer_reviews ?? "").trim()
                        ? `Existing review: ${String(inlineEditingLead?.reviews ?? inlineEditingLead?.customer?.reviews ?? inlineEditingLead?.customer_reviews ?? "").trim()}`
                        : "Enter client review"}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </label>

                  {inlineEditMode === "edit" && (
                    <textarea
                      value={inlineEditForm.notes}
                      onChange={(event) => setInlineEditForm((prev) => ({ ...prev, notes: event.target.value }))}
                      rows={3}
                      placeholder="Notes"
                      className="md:col-span-2 xl:col-span-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-200 p-5 dark:border-gray-700">
              <button
                type="button"
                onClick={resetLeadEditor}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-all duration-200 hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => saveInlineLead(inlineEditingLead)}
                disabled={savingLead}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${
                  inlineEditMode === "dispatch"
                    ? "bg-green-600 hover:bg-green-700 hover:shadow-md"
                    : inlineEditMode === "failed"
                      ? "bg-red-600 hover:bg-red-700 hover:shadow-md"
                      : "bg-amber-500 hover:bg-amber-600 hover:shadow-md"
                }`}
              >
                {savingLead ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTrackMap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="flex h-[95vh] w-full max-w-7xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-4 dark:border-gray-700">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">All Campaigns City Status Map</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Marker color shows lead status, and the popup shows courier names for that city and campaign.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTrackMap(false)}
                className="rounded-lg bg-gray-200 px-4 py-2 text-sm text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
              >
                Close
              </button>
            </div>

            <div className="flex flex-wrap gap-3 border-b border-gray-200 px-4 py-3 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300">
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-green-500" /> Delivered
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-blue-500" /> Dispatched
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500" /> Pending
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-orange-500" /> Failed
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-violet-500" /> Returned
              </span>
            </div>

            <div className="flex-1 overflow-hidden rounded-b-2xl">
              {loadingTrackMap ? (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  Loading campaign map data...
                </div>
              ) : mapLeadMarkers.length ? (
                <MapContainer center={[22.8, 78.9]} zoom={5} zoomControl scrollWheelZoom style={{ height: "100%", width: "100%" }}>
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap contributors'
                  />
                  {mapLeadMarkers.map((lead, index) => {
                    const status = String(lead?.status ?? "Pending");
                    const color = leadStatusColors[status] || "#6b7280";
                    return (
                      <Marker key={`lead-${lead.id ?? index}`} position={[lead.lat, lead.lng]} icon={getLeadMapIcon(color)}>
                        <Popup minWidth={220}>
                          <div style={{ fontFamily: "system-ui", fontSize: 13 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{buildLeadName(lead)}</div>
                            <span style={{ background: (leadStatusColors[status] || "#6b7280") + "22", color: leadStatusColors[status] || "#6b7280", padding: "2px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, display: "inline-block", marginBottom: 8 }}>{status}</span>
                            <table style={{ fontSize: 12, borderCollapse: "collapse", width: "100%" }}>
                              <tbody>
                                {[
                                  ["Campaign", lead?.campaign_name],
                                  ["Courier",  lead?.courier_name],
                                  ["Address",  buildAddressLabel(lead)],
                                  ["Area",     getLeadAreaLabel(lead)],
                                  ["City",     lead?.city],
                                  ["State",    lead?.state],
                                  ["Pincode",  lead?.pincode],
                                  ["Phone",    lead?.phone],
                                ].map(([label, value]) => (
                                  <tr key={label}>
                                    <td style={{ color: "#6b7280", paddingBottom: 3, width: 75 }}>{label}</td>
                                    <td style={{ fontWeight: 500 }}>{value || "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  No city data available for this campaign yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showAddSingleLeadModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={closeAddSingleLeadModal}
        >
          <div
            className="flex w-full max-w-3xl flex-col rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Add Lead</h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Fill the lead details and save to customers.</p>
              </div>
              <button type="button" onClick={closeAddSingleLeadModal} className="text-gray-500 hover:text-gray-700 dark:text-gray-300">
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleAddSingleLeadSubmit} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <input value={singleLeadForm.first_name} onChange={(e) => setSingleLeadForm((p) => ({ ...p, first_name: e.target.value }))} placeholder="First Name" className="w-full rounded-lg border px-3 py-2" />
              <input value={singleLeadForm.last_name} onChange={(e) => setSingleLeadForm((p) => ({ ...p, last_name: e.target.value }))} placeholder="Last Name" className="w-full rounded-lg border px-3 py-2" />
              <input
                value={singleLeadForm.phone}
                onChange={(e) => setSingleLeadForm((p) => ({ ...p, phone: String(e.target.value || "").replace(/\D/g, "") }))}
                placeholder="Phone Number"
                inputMode="numeric"
                pattern="(?:91)?[0-9]{10}"
                maxLength={12}
                className="w-full rounded-lg border px-3 py-2"
              />
              <input value={singleLeadForm.pincode} onChange={(e) => setSingleLeadForm((p) => ({ ...p, pincode: e.target.value }))} placeholder="Pincode" className="w-full rounded-lg border px-3 py-2" />
              <input value={singleLeadForm.address_line1} onChange={(e) => setSingleLeadForm((p) => ({ ...p, address_line1: e.target.value }))} placeholder="Address Line 1" className="col-span-1 md:col-span-2 w-full rounded-lg border px-3 py-2" />
              <input value={singleLeadForm.address_line2} onChange={(e) => setSingleLeadForm((p) => ({ ...p, address_line2: e.target.value }))} placeholder="Address Line 2" className="col-span-1 md:col-span-2 w-full rounded-lg border px-3 py-2" />
              <input value={singleLeadForm.country} onChange={(e) => setSingleLeadForm((p) => ({ ...p, country: e.target.value }))} placeholder="Country" className="w-full rounded-lg border px-3 py-2" />
              <input value={singleLeadForm.city} onChange={(e) => setSingleLeadForm((p) => ({ ...p, city: e.target.value }))} placeholder="City" className="w-full rounded-lg border px-3 py-2" />
              <input value={singleLeadForm.state} onChange={(e) => setSingleLeadForm((p) => ({ ...p, state: e.target.value }))} placeholder="State" className="w-full rounded-lg border px-3 py-2" />

              <div className="col-span-1 md:col-span-2 mt-2 flex justify-end gap-3">
                <button type="button" onClick={closeAddSingleLeadModal} className="rounded-lg bg-gray-100 px-4 py-2 text-sm">Cancel</button>
                <button type="submit" disabled={savingSingleLead} className={`inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white ${savingSingleLead ? "opacity-70 cursor-not-allowed" : "hover:bg-green-700"}`}>
                  <FaSave className="text-sm" />
                  <span>{savingSingleLead ? "Adding..." : "Add Lead"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddLeadsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={closeAddLeadsModal}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-6xl flex-col rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Bulk Upload</h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Choose customers to bulk upload to {activeCampaign?.name || "this campaign"}.</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <input
                value={customerSearch}
                onChange={(event) => setCustomerSearch(event.target.value)}
                placeholder="Search customers"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
              <select
                value={customerFilters.fileName}
                onChange={(event) => setCustomerFilters((prev) => ({ ...prev, fileName: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="">All File Names</option>
                {customerFileNameOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={customerFilters.uploadedDate}
                onChange={(event) => setCustomerFilters((prev) => ({ ...prev, uploadedDate: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
              <select
                value={customerFilters.city}
                onChange={(event) => setCustomerFilters((prev) => ({ ...prev, city: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="">All Cities</option>
                {customerCityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={customerFilters.state}
                onChange={(event) => setCustomerFilters((prev) => ({ ...prev, state: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="">All States</option>
                {customerStateOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 flex-1 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="max-h-[52vh] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 dark:bg-gray-800">
                  <tr>
                    <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-200">
                      <input
                        type="checkbox"
                        checked={allFilteredCustomersSelected}
                        onChange={toggleSelectAllCustomers}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-200">Name</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-200">Phone</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-200">Address</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-200">City</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-200">State</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingCustomers && (
                    <tr className="border-t border-gray-200 dark:border-gray-700">
                      <td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        Loading customers...
                      </td>
                    </tr>
                  )}

                  {!loadingCustomers && filteredCustomers.map((customer) => {
                    const checked = selectedCustomerIds.includes(customer.id);
                    return (
                      <tr key={customer.id} className={`border-t border-gray-200 dark:border-gray-700 ${checked ? "bg-blue-50 dark:bg-blue-950/30" : ""}`}>
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCustomerSelection(customer.id)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-3 py-3 text-gray-900 dark:text-white">{buildFullName(customer)}</td>
                        <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{customer.phone || "-"}</td>
                        <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{buildAddressLabel(customer)}</td>
                        <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{customer.city || "-"}</td>
                        <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{customer.state || "-"}</td>
                      </tr>
                    );
                  })}

                  {!loadingCustomers && !filteredCustomers.length && (
                    <tr className="border-t border-gray-200 dark:border-gray-700">
                      <td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        No customers found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Selected customers: {selectedCustomerIds.length}
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleAddSelectedCustomers}
                  disabled={savingAddLeads || !selectedCustomerIds.length}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-all duration-200 ${savingAddLeads || !selectedCustomerIds.length ? 'bg-green-400/60 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 hover:shadow-md'}`}
                  title="Bulk upload selected"
                  aria-label="Bulk upload selected"
                >
                  <FaPlus className={`text-sm ${savingAddLeads ? "animate-pulse" : ""}`} />
                  <span>{savingAddLeads ? 'Uploading...' : 'Bulk Upload Selected'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="fixed bottom-6 right-6 z-40 rounded-full bg-indigo-600 p-3 text-white shadow-lg transition-colors hover:bg-indigo-700"
        title="Back to top"
        aria-label="Back to top"
      >
        <FaArrowUp />
      </button>
    </div>
  );
}
