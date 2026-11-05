import React, { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { toast } from "react-toastify";
import {
  FaUserFriends, FaPlus, FaUpload, FaSyncAlt, FaSearch,
  FaCheck, FaTimes, FaEdit, FaEye, FaUserCheck, FaFileExcel,
  FaPhone, FaEnvelope, FaMapMarkerAlt, FaBuilding,
  FaHistory, FaExclamationTriangle, FaRegEdit, FaRegTrashAlt
} from "react-icons/fa";
import BASE_URL from "./config";
import axiosInstance from "./axiosconfig";
import UserAssignedLeads from "./UserAssignedLeads";

function UserMultiSelectDropdown({
  users = [],
  selectedIds = [],
  onChange,
  placeholder = "Search and assign users...",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef(null);

  const selectedSet = new Set((selectedIds || []).map(Number));

  const filteredUsers = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.role && u.role.toLowerCase().includes(q))
    );
  });

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const toggleUser = (userId) => {
    const idNum = Number(userId);
    let next;
    if (selectedSet.has(idNum)) {
      next = (selectedIds || []).map(Number).filter((id) => id !== idNum);
    } else {
      next = [...(selectedIds || []).map(Number), idNum];
    }
    onChange(next);
  };

  const removeUser = (userId, e) => {
    e?.stopPropagation();
    const idNum = Number(userId);
    onChange((selectedIds || []).map(Number).filter((id) => id !== idNum));
  };

  const handleSelectAll = (e) => {
    e?.stopPropagation();
    onChange(users.map((u) => Number(u.id)));
  };

  const handleClearAll = (e) => {
    e?.stopPropagation();
    onChange([]);
  };

  const selectedUserObjs = users.filter((u) => selectedSet.has(Number(u.id)));

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Selected Users Chips Container */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`min-h-[42px] w-full p-2 text-sm bg-gray-50 dark:bg-gray-900 border ${
          isOpen ? "border-blue-500 ring-1 ring-blue-500" : "border-gray-300 dark:border-gray-600"
        } rounded-lg cursor-pointer flex flex-wrap items-center gap-1.5 transition`}
      >
        {selectedUserObjs.length > 0 ? (
          selectedUserObjs.map((u) => (
            <span
              key={u.id}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200 shadow-2xs border border-purple-200 dark:border-purple-800"
            >
              <FaUserCheck className="text-[10px]" />
              <span>{u.name || u.username}</span>
              {u.role && <span className="opacity-75 text-[10px]">({u.role})</span>}
              <button
                type="button"
                onClick={(e) => removeUser(u.id, e)}
                className="hover:text-red-500 focus:outline-none p-0.5 rounded-full ml-0.5"
                title={`Remove ${u.name || u.username}`}
              >
                <FaTimes className="text-[10px]" />
              </button>
            </span>
          ))
        ) : (
          <span className="text-gray-400 dark:text-gray-500 text-xs italic px-1">
            -- Unassigned (Click to assign users) --
          </span>
        )}

        <div className="ml-auto flex items-center gap-1.5 text-gray-400 pl-2">
          <span className="text-2xs font-medium">({selectedSet.size} selected)</span>
          <span className="text-xs">{isOpen ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Searchable Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-64 animate-fadeIn">
          <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 space-y-1.5">
            <div className="relative">
              <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={placeholder}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-between text-2xs px-1 text-gray-500 dark:text-gray-400">
              <span>{filteredUsers.length} user{filteredUsers.length === 1 ? "" : "s"} found</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  Select All
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-red-500 hover:underline font-medium"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-y-auto p-1 divide-y divide-gray-100 dark:divide-gray-700/50">
            {filteredUsers.length === 0 ? (
              <div className="p-3 text-center text-xs text-gray-400 italic">
                No active users match "{search}"
              </div>
            ) : (
              filteredUsers.map((u) => {
                const isChecked = selectedSet.has(Number(u.id));
                return (
                  <div
                    key={u.id}
                    onClick={() => toggleUser(u.id)}
                    className={`flex items-center justify-between px-3 py-2 text-xs rounded-lg cursor-pointer transition ${
                      isChecked
                        ? "bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 font-semibold"
                        : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="rounded text-purple-600 focus:ring-purple-500 cursor-pointer pointer-events-none"
                      />
                      <span className="truncate">{u.name || u.username}</span>
                      {u.role && (
                        <span className="text-2xs font-normal opacity-70 px-1.5 py-0.5 rounded bg-gray-200/60 dark:bg-gray-700">
                          {u.role}
                        </span>
                      )}
                    </div>
                    {isChecked && <FaCheck className="text-purple-600 text-2xs" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LeadGeneration({ user: propUser }) {
  const [currentUser, setCurrentUser] = useState(propUser || null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalLeads, setTotalLeads] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [counts, setCounts] = useState({ all: 0, lead: 0, hostlead: 0, converted: 0, unassigned: 0 });

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedSegment, setSelectedSegment] = useState("all");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [isUnassignedOnly, setIsUnassignedOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Dropdown options
  const [filterOptions, setFilterOptions] = useState({
    cities: [],
    statuses: ["Lead", "HostLead", "Converted"],
    excel_files: [],
    assignable_users: [],
    segments: []
  });

  // Selection state for Bulk Actions
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState("Lead");
  const [bulkStatusNotes, setBulkStatusNotes] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showImportResultModal, setShowImportResultModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [activeLead, setActiveLead] = useState(null);
  const [excelSearchTerm, setExcelSearchTerm] = useState("");
  const [leadToDelete, setLeadToDelete] = useState(null);

  // Upload & Mapping State
  const [uploadStep, setUploadStep] = useState(1); // 1: file, 2: mapping, 3: importing
  const [uploadViewMode, setUploadViewMode] = useState("mapping"); // "mapping" | "preview"
  const [, setUploadedFile] = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [fileHeaders, setFileHeaders] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [rawParsedRows, setRawParsedRows] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [uploadDefaultStatus, setUploadDefaultStatus] = useState("Lead");
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);

  // Helper to format source column names with clean, meaningful labels
  const formatColumnLabel = (col) => {
    if (!col) return "";
    const cleanKey = col.toLowerCase().replace(/[^a-z0-9]/g, "");
    const labelMap = {
      fname: "First Name",
      lname: "Last Name",
      address1: "Address Line 1",
      address2: "Address Line 2",
      mobile1: "Mobile 1",
      mobile1name: "Mobile 1 Name",
      mobile2: "Mobile 2",
      mobile2name: "Mobile 2 Name",
      mobile3: "Mobile 3",
      mobile3name: "Mobile 3 Name",
      phone1: "Phone 1",
      phone2: "Phone 2",
      email1: "Email 1",
      email2: "Email 2",
      email3: "Email 3",
      wstatus1: "WhatsApp Status 1",
      wstatus2: "WhatsApp Status 2",
      wstatus3: "WhatsApp Status 3",
      savecontact1: "Save Contact 1",
      savecontact2: "Save Contact 2",
      savecontact3: "Save Contact 3",
      areacode: "Area Code",
      pincode: "Pincode / ZIP",
      compname: "Company Name",
      company: "Company Name",
      datetime: "Date & Time",
      notes: "Notes / Remarks",
    };
    if (labelMap[cleanKey]) return labelMap[cleanKey];
    return col
      .replace(/_/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  // Form State for Add / Edit
  const initialForm = {
    company_name: "",
    first_name: "",
    last_name: "",
    phone: "",
    secondary_phone: "",
    mobile: "",
    secondary_mobile: "",
    email: "",
    secondary_email: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    country: "India",
    pincode: "",
    website: "",
    segment: "",
    category: "",
    rating: "",
    notes: "",
    status: "Lead",
    assigned_to: []
  };
  const [leadForm, setLeadForm] = useState(initialForm);

  // Bulk Assign Form
  const [bulkAssigneeIds, setBulkAssigneeIds] = useState([]);
  const [bulkIsUnassign, setBulkIsUnassign] = useState(false);
  const [bulkAssignNotes, setBulkAssignNotes] = useState("");

  // Target system fields for mapping with clear, meaningful labels
  const systemFields = [
    { key: "skip", label: "-- Skip (Saved in raw source data) --" },
    { key: "company_name", label: "Company Name" },
    { key: "contact_person", label: "Contact Person (Full Name)" },
    { key: "first_name", label: "First Name" },
    { key: "last_name", label: "Last Name" },
    { key: "phone", label: "Primary Phone / Landline" },
    { key: "secondary_phone", label: "Secondary Phone" },
    { key: "mobile", label: "Mobile" },
    { key: "secondary_mobile", label: "Secondary Mobile" },
    { key: "email", label: "Primary Email" },
    { key: "secondary_email", label: "Secondary Email" },
    { key: "address_line1", label: "Address Line 1" },
    { key: "address_line2", label: "Address Line 2" },
    { key: "city", label: "City" },
    { key: "state", label: "State" },
    { key: "country", label: "Country" },
    { key: "pincode", label: "Pincode / ZIP" },
    { key: "website", label: "Website" },
    { key: "segment", label: "Segment" },
    { key: "category", label: "Category" },
    { key: "rating", label: "Rating" },
    { key: "notes", label: "Notes" }
  ];

  // User role and permissions: only Admin, Super Admin, Tech Admin
  const storedRole = localStorage.getItem("userRole") || "";
  const rawRole = (currentUser?.role || propUser?.role || storedRole || "").trim().toLowerCase();
  const userRole = rawRole.replace(/[\s_-]+/g, "");
  const isAuthorized = ["admin", "superadmin", "techadmin", "staff"].includes(userRole);
  const isSuperOrAdmin = isAuthorized;

  // Fetch Current User if not passed
  useEffect(() => {
    if (!currentUser) {
      const fetchUser = async () => {
        try {
          const res = await axiosInstance.get(`${BASE_URL}/api/users/me/`);
          setCurrentUser(res.data);
        } catch (err) {
          console.error("Failed to load user info", err);
        }
      };
      fetchUser();
    }
  }, [currentUser]);

  // Fetch Filter Options & Sync Dynamic Counts
  const fetchFilterOptions = async () => {
    const raw = (currentUser?.role || propUser?.role || localStorage.getItem("userRole") || "").trim().toLowerCase();
    const role = raw.replace(/[\s_-]+/g, "");
    if ((currentUser || localStorage.getItem("userRole")) && !["admin", "superadmin", "techadmin", "staff"].includes(role)) {
      return;
    }
    try {
      const res = await axiosInstance.get(`${BASE_URL}/api/leads/filters/`);
      setFilterOptions((prev) => ({
        ...prev,
        ...res.data,
        segments: res.data.segments || res.data.counts?.segments || [],
        assignable_users: res.data.assignable_users || res.data.counts?.assignable_users || prev.assignable_users || []
      }));
      if (res.data.counts) {
        setCounts(res.data.counts);
      }
    } catch (err) {
      console.error("Failed to fetch filter options", err);
    }
  };

  useEffect(() => {
    const raw = (currentUser?.role || propUser?.role || localStorage.getItem("userRole") || "").trim().toLowerCase();
    const role = raw.replace(/[\s_-]+/g, "");
    if (["admin", "superadmin", "techadmin", "staff"].includes(role)) {
      fetchFilterOptions();
    }
  }, [currentUser]);

  // Fetch Leads with search & filters
  const fetchLeads = async (pageNumber = 1) => {
    const raw = (currentUser?.role || propUser?.role || localStorage.getItem("userRole") || "").trim().toLowerCase();
    const role = raw.replace(/[\s_-]+/g, "");
    if ((currentUser || localStorage.getItem("userRole")) && !["admin", "superadmin", "techadmin", "staff"].includes(role)) {
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("page", pageNumber);
      params.append("page_size", pageSize);

      if (searchTerm.trim()) params.append("search", searchTerm.trim());
      if (selectedStatus && selectedStatus !== "all") params.append("status", selectedStatus);
      if (selectedSegment && selectedSegment !== "all") params.append("segment", selectedSegment);
      if (selectedCity) params.append("city", selectedCity);
      if (isUnassignedOnly) {
        params.append("is_unassigned", "true");
      } else if (selectedAssignee) {
        params.append("assigned_to", selectedAssignee);
      }
      if (dateFrom) params.append("date_from", dateFrom);
      if (dateTo) params.append("date_to", dateTo);

      const res = await axiosInstance.get(`${BASE_URL}/api/leads/?${params.toString()}`);
      setLeads(res.data.leads || []);
      setTotalLeads(res.data.total || 0);
      setPage(res.data.page || 1);
      setTotalPages(res.data.total_pages || 1);
      if (res.data.counts) {
        setCounts(res.data.counts);
        if (res.data.counts.segments) {
          setFilterOptions((prev) => ({ ...prev, segments: res.data.counts.segments }));
        }
        if (res.data.counts.assignable_users) {
          setFilterOptions((prev) => ({ ...prev, assignable_users: res.data.counts.assignable_users }));
        }
      }
      setSelectedLeadIds([]);
    } catch (err) {
      console.error("Error fetching leads:", err);
      toast.error("Failed to fetch leads.");
    } finally {
      setLoading(false);
    }
  };

  // Debounced search / filter triggers
  useEffect(() => {
    const raw = (currentUser?.role || propUser?.role || localStorage.getItem("userRole") || "").trim().toLowerCase();
    const role = raw.replace(/[\s_-]+/g, "");
    if ((currentUser || localStorage.getItem("userRole")) && !["admin", "superadmin", "techadmin"].includes(role)) {
      return;
    }
    const timer = setTimeout(() => {
      fetchLeads(1);
    }, 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, searchTerm, selectedStatus, selectedSegment, selectedCity, selectedAssignee, isUnassignedOnly, dateFrom, dateTo, pageSize]);

  // Clear all filters
  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedStatus("all");
    setSelectedSegment("all");
    setSelectedCity("");
    setSelectedAssignee("");
    setIsUnassignedOnly(false);
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  // Quick Status tab click
  const handleStatusTabClick = (statusKey) => {
    if (statusKey === "unassigned") {
      setIsUnassignedOnly(true);
      setSelectedStatus("all");
      setSelectedAssignee("");
    } else {
      setIsUnassignedOnly(false);
      setSelectedStatus(statusKey);
    }
    setPage(1);
  };

  // Single Checkbox Selection
  const handleToggleLeadSelect = (id) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Select All on current page
  const handleSelectAllOnPage = () => {
    if (selectedLeadIds.length === leads.length && leads.length > 0) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(leads.map((l) => l.id));
    }
  };

  // Quick Inline Status / Assignment Update
  const handleQuickStatusChange = async (leadId, newStatus) => {
    try {
      const res = await axiosInstance.post(`${BASE_URL}/api/leads/${leadId}/status/`, { status: newStatus });
      toast.success(res.data.message || `Status updated to ${newStatus}`);
      if (newStatus.toLowerCase() === "unassigned") {
        setLeads((prev) =>
          prev.map((l) =>
            l.id === leadId
              ? {
                  ...l,
                  assigned_to: null,
                  assigned_to_name: "Unassigned",
                  assigned_to_display: "Unassigned",
                  status_updated_by: null,
                  status_updated_by_name: "",
                }
              : l
          )
        );
      } else {
        const updatedAssignee = res.data.assigned_to_name || res.data.assigned_to_display || "";
        setLeads((prev) =>
          prev.map((l) =>
            l.id === leadId
              ? {
                  ...l,
                  status: res.data.status || newStatus,
                  assigned_to: res.data.assigned_to !== undefined ? res.data.assigned_to : l.assigned_to,
                  assigned_to_name: updatedAssignee || l.assigned_to_name,
                  assigned_to_display: updatedAssignee || l.assigned_to_display,
                  status_updated_by: res.data.status_updated_by,
                  status_updated_by_name: res.data.status_updated_by_name,
                }
              : l
          )
        );
      }
      fetchLeads(page);
      fetchFilterOptions();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update status.");
    }
  };

  // Bulk Status Update Submit
  const handleBulkStatusSubmit = async (e) => {
    e.preventDefault();
    if (selectedLeadIds.length === 0) {
      toast.warn("No leads selected.");
      return;
    }
    try {
      const res = await axiosInstance.post(`${BASE_URL}/api/leads/bulk-status/`, {
        lead_ids: selectedLeadIds,
        status: bulkStatusValue,
        notes: bulkStatusNotes || "Bulk status change"
      });
      toast.success(res.data.message || `Status updated to ${bulkStatusValue}`);
      setShowBulkStatusModal(false);
      setBulkStatusNotes("");
      fetchLeads(page);
      fetchFilterOptions();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update status in bulk.");
    }
  };


  // Open Add Modal with current logged in user preselected
  const handleOpenAdd = () => {
    let defaultAssignee = [];
    if (currentUser?.id) {
      defaultAssignee = [Number(currentUser.id)];
    } else {
      const storedUsername = localStorage.getItem("username") || "";
      const match = filterOptions.assignable_users.find(
        (u) =>
          (u.username && u.username.toLowerCase() === storedUsername.toLowerCase()) ||
          (u.name && u.name.toLowerCase() === storedUsername.toLowerCase())
      );
      if (match) {
        defaultAssignee = [Number(match.id)];
      }
    }

    setLeadForm({
      ...initialForm,
      assigned_to: defaultAssignee
    });
    setShowAddModal(true);
  };

  // Save manual new lead
  const handleCreateLead = async (e) => {
    e.preventDefault();
    try {
      await axiosInstance.post(`${BASE_URL}/api/leads/`, leadForm);
      toast.success("Lead created successfully!");
      setShowAddModal(false);
      setLeadForm(initialForm);
      fetchLeads(1);
      fetchFilterOptions();
    } catch (err) {
      const msg = err.response?.data?.error || "Failed to create lead.";
      toast.error(msg);
    }
  };

  // Open Edit Modal with existing assigned users pre-populated
  const handleOpenEdit = (lead) => {
    setActiveLead(lead);
    let assignedIds = [];
    if (Array.isArray(lead.assigned_user_ids) && lead.assigned_user_ids.length > 0) {
      assignedIds = lead.assigned_user_ids.map(Number);
    } else if (Array.isArray(lead.assigned_users) && lead.assigned_users.length > 0) {
      assignedIds = lead.assigned_users.map((u) => Number(u.id));
    } else if (lead.assigned_to) {
      assignedIds = [Number(lead.assigned_to)];
    }

    setLeadForm({
      company_name: lead.company_name || "",
      first_name: lead.first_name || "",
      last_name: lead.last_name || "",
      phone: lead.phone || "",
      secondary_phone: lead.secondary_phone || "",
      mobile: lead.mobile || "",
      secondary_mobile: lead.secondary_mobile || "",
      email: lead.email || "",
      secondary_email: lead.secondary_email || "",
      address_line1: lead.address_line1 || "",
      address_line2: lead.address_line2 || "",
      city: lead.city || "",
      state: lead.state || "",
      country: lead.country || "India",
      pincode: lead.pincode || "",
      website: lead.website || "",
      segment: lead.segment || "",
      category: lead.category || "",
      rating: lead.rating || "",
      notes: lead.notes || "",
      status: lead.status || "Lead",
      assigned_to: assignedIds
    });
    setShowEditModal(true);
  };

  // Update existing lead
  const handleUpdateLead = async (e) => {
    e.preventDefault();
    if (!activeLead) return;
    try {
      const res = await axiosInstance.put(`${BASE_URL}/api/leads/${activeLead.id}/`, leadForm);
      toast.success("Lead updated successfully!");
      setShowEditModal(false);
      if (res.data?.lead) {
        setLeads((prev) =>
          prev.map((l) => (l.id === activeLead.id ? res.data.lead : l))
        );
      }
      fetchLeads(page);
      fetchFilterOptions();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update lead.");
    }
  };

  // Delete Lead
  const handleConfirmDelete = async () => {
    if (!leadToDelete) return;
    try {
      await axiosInstance.delete(`${BASE_URL}/api/leads/${leadToDelete.id}/`);
      toast.success("Lead deleted successfully.");
      setShowDeleteModal(false);
      setLeadToDelete(null);
      fetchLeads(page);
      fetchFilterOptions();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete lead.");
    }
  };

  // Bulk Assign Submit
  const handleBulkAssignSubmit = async (e) => {
    e.preventDefault();
    if (selectedLeadIds.length === 0) {
      toast.warn("No leads selected.");
      return;
    }
    try {
      const res = await axiosInstance.post(`${BASE_URL}/api/leads/assign/`, {
        lead_ids: selectedLeadIds,
        assigned_to_ids: bulkIsUnassign ? [] : bulkAssigneeIds,
        assigned_to_id: bulkIsUnassign ? null : (bulkAssigneeIds[0] || null),
        notes: bulkAssignNotes || (bulkIsUnassign ? "Unassigned via Lead Generation Bulk Action" : "Assigned via Lead Generation Bulk Action")
      });
      toast.success(res.data.message || (bulkIsUnassign ? "Leads unassigned successfully!" : "Leads assigned successfully!"));
      setShowAssignModal(false);
      setBulkAssigneeIds([]);
      setBulkIsUnassign(false);
      setBulkAssignNotes("");
      fetchLeads(page);
      fetchFilterOptions();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to assign leads.");
    }
  };

  // Open Lead Detail View
  const handleOpenDetail = async (lead) => {
    try {
      const res = await axiosInstance.get(`${BASE_URL}/api/leads/${lead.id}/`);
      setActiveLead(res.data.lead);
      setShowDetailModal(true);
    } catch (err) {
      setActiveLead(lead);
      setShowDetailModal(true);
    }
  };

  // ================= EXCEL / CSV UPLOAD LOGIC =================
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadedFile(file);
    setUploadedFileName(file.name);

    const isCSV = file.name.endsWith(".csv");

    if (isCSV) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: "greedy",
        complete: (results) => {
          if (!results.data || results.data.length === 0) {
            toast.error("CSV file appears to be empty.");
            return;
          }
          const rawHeaders = results.meta.fields || Object.keys(results.data[0] || {});
          const seen = new Set();
          const headers = [];
          rawHeaders.forEach((h) => {
            if (!h || typeof h !== "string") return;
            const trimmed = h.trim();
            const clean = trimmed.toLowerCase();
            if (!clean) return;
            if (clean === "file_column_header" || clean === "file column header" || clean === "filename" || clean === "file_name" || clean === "filepath") return;
            if (clean.startsWith("__parsed_extra") || clean.startsWith("__empty")) return;
            if (!seen.has(trimmed)) {
              seen.add(trimmed);
              headers.push(trimmed);
            }
          });

          const validRows = results.data.filter((r) =>
            r && typeof r === "object" && Object.values(r).some((v) => v !== null && v !== undefined && String(v).trim() !== "")
          );

          setFileHeaders(headers);
          setRawParsedRows(validRows.length > 0 ? validRows : results.data);
          setPreviewRows(validRows.length > 0 ? validRows.slice(0, 5) : results.data.slice(0, 5));
          autoGuessMapping(headers);
          setUploadViewMode("mapping");
          setUploadStep(2);
        },
        error: (err) => {
          toast.error("Failed to parse CSV: " + err.message);
        }
      });
    } else {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target.result;
          const wb = XLSX.read(bstr, { type: "binary" });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws, { defval: "" });

          if (!data || data.length === 0) {
            toast.error("Excel sheet appears to be empty.");
            return;
          }

          const sheetHeaderRow = XLSX.utils.sheet_to_json(ws, { header: 1 })[0] || [];
          const rawHeaders = sheetHeaderRow.length > 0 ? sheetHeaderRow.map(String) : Object.keys(data[0] || {});

          const seen = new Set();
          const headers = [];
          rawHeaders.forEach((h) => {
            if (!h || typeof h !== "string") return;
            const trimmed = h.trim();
            const clean = trimmed.toLowerCase();
            if (!clean) return;
            if (clean === "file_column_header" || clean === "file column header" || clean === "filename" || clean === "file_name" || clean === "filepath") return;
            if (clean.startsWith("__empty") || clean.startsWith("__EMPTY")) return;
            if (!seen.has(trimmed)) {
              seen.add(trimmed);
              headers.push(trimmed);
            }
          });

          const validRows = data.filter((r) =>
            r && typeof r === "object" && Object.values(r).some((v) => v !== null && v !== undefined && String(v).trim() !== "")
          );

          setFileHeaders(headers);
          setRawParsedRows(validRows.length > 0 ? validRows : data);
          setPreviewRows(validRows.length > 0 ? validRows.slice(0, 5) : data.slice(0, 5));
          autoGuessMapping(headers);
          setUploadViewMode("mapping");
          setUploadStep(2);
        } catch (err) {
          toast.error("Failed to parse Excel file.");
        }
      };
      reader.readAsBinaryString(file);
    }
  };

  // Smart Header Auto-Mapping with conflict-free candidate allocation
  const autoGuessMapping = (headers) => {
    const mapping = {};
    const usedTargets = new Set();

    headers.forEach((h) => {
      const clean = h.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      let candidates = [];

      if (clean === "company" || clean === "companyname" || clean === "compname" || clean === "businessname") {
        candidates = ["company_name"];
      } else if (clean === "fname" || clean === "firstname" || clean === "first") {
        candidates = ["first_name"];
      } else if (clean === "lname" || clean === "lastname" || clean === "last") {
        candidates = ["last_name"];
      } else if (
        clean === "contactperson" || clean === "contactname" || clean === "contact" ||
        clean === "fullname" || clean === "customername"
      ) {
        candidates = ["contact_person", "first_name"];
      } else if (clean === "phone1" || clean === "phone" || clean === "phonenumber" || clean === "telephone" || clean === "landline") {
        candidates = ["phone", "secondary_phone", "mobile", "secondary_mobile"];
      } else if (clean === "phone2" || clean === "secondaryphone" || clean === "telephone2") {
        candidates = ["secondary_phone", "phone", "secondary_mobile", "mobile"];
      } else if (clean === "mobile1" || clean === "mobile" || clean === "mobilenumber" || clean === "cell" || clean === "cellphone") {
        candidates = ["mobile", "secondary_mobile", "phone", "secondary_phone"];
      } else if (clean === "mobile2" || clean === "secondarymobile") {
        candidates = ["secondary_mobile", "secondary_phone", "mobile", "phone"];
      } else if (clean === "mobile3" || clean === "phone3") {
        candidates = ["secondary_mobile", "secondary_phone", "mobile", "phone"];
      } else if (clean === "email1" || clean === "email" || clean === "emailaddress") {
        candidates = ["email", "secondary_email"];
      } else if (clean === "email2" || clean === "secondaryemail" || clean === "email3") {
        candidates = ["secondary_email", "email"];
      } else if (clean === "address1" || clean === "address" || clean === "addressline1") {
        candidates = ["address_line1", "address_line2"];
      } else if (clean === "address2" || clean === "addressline2") {
        candidates = ["address_line2", "address_line1"];
      } else if (clean === "city" || clean === "town") {
        candidates = ["city"];
      } else if (clean === "state" || clean === "province") {
        candidates = ["state"];
      } else if (clean === "country") {
        candidates = ["country"];
      } else if (clean === "pincode" || clean === "zip" || clean === "postalcode") {
        candidates = ["pincode"];
      } else if (clean === "website" || clean === "url") {
        candidates = ["website"];
      } else if (clean === "segment") {
        candidates = ["segment"];
      } else if (clean === "category") {
        candidates = ["category"];
      } else if (clean === "rating") {
        candidates = ["rating"];
      } else if (clean === "notes" || clean === "comment" || clean === "remark" || clean === "remarks") {
        candidates = ["notes"];
      }

      // Pick first available candidate that hasn't been allocated yet
      const chosen = candidates.find((c) => !usedTargets.has(c));
      if (chosen) {
        mapping[h] = chosen;
        usedTargets.add(chosen);
      } else {
        mapping[h] = "skip";
      }
    });
    setColumnMapping(mapping);
  };

  // Map of target -> list of headers that mapped to it
  const targetToHeaders = useMemo(() => {
    const map = {};
    Object.entries(columnMapping).forEach(([col, target]) => {
      if (target && target !== "skip") {
        if (!map[target]) map[target] = [];
        map[target].push(col);
      }
    });
    return map;
  }, [columnMapping]);

  // Find any duplicate mapped system fields
  const duplicateMappedFields = useMemo(() => {
    return Object.keys(targetToHeaders).filter((k) => targetToHeaders[k].length > 1);
  }, [targetToHeaders]);

  // Perform Import
  const handleExecuteImport = async () => {
    if (!rawParsedRows || rawParsedRows.length === 0) {
      toast.error("No rows to import.");
      return;
    }

    if (duplicateMappedFields.length > 0) {
      const dupLabels = duplicateMappedFields
        .map((k) => {
          const lbl = systemFields.find((f) => f.key === k)?.label || k;
          const cols = targetToHeaders[k]?.join(", ") || "";
          return `${lbl} (mapped by: ${cols})`;
        })
        .join("; ");
      toast.error(`Cannot import: Multiple columns are mapped to the same field (${dupLabels}). Please assign unique fields.`);
      return;
    }

    const mappedTargets = Object.entries(columnMapping)
      .filter(([col, target]) => target && target !== "skip")
      .map(([col, target]) => target);

    const hasIdentifier = mappedTargets.some((t) =>
      ["company_name", "first_name", "last_name", "contact_person", "phone", "mobile", "secondary_phone", "secondary_mobile", "email"].includes(t)
    );
    if (!hasIdentifier) {
      toast.warning("Please map at least one contact identifier (Company, Name, Phone, Mobile, or Email) before importing.");
      return;
    }

    setImporting(true);
    try {
      const payload = {
        rows: rawParsedRows,
        column_mapping: columnMapping,
        file_name: uploadedFileName,
        status: uploadDefaultStatus || "Lead"
      };

      const res = await axiosInstance.post(`${BASE_URL}/api/leads/upload/`, payload);
      setImportResult(res.data);
      setShowUploadModal(false);
      setShowImportResultModal(true);
      fetchLeads(1);
      fetchFilterOptions();
    } catch (err) {
      toast.error(err.response?.data?.error || "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  if ((currentUser || storedRole) && !isAuthorized) {
    return <UserAssignedLeads user={currentUser || propUser} />;
  }

  return (
    <div className="w-full max-w-full min-w-0 p-3 sm:p-4 md:p-5 bg-white dark:bg-gray-900 shadow-lg rounded-xl">
      {/* Compact Page Heading */}
      <div className="flex items-center justify-between mb-2.5 sm:mb-3">
        <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white tracking-tight">Lead Generation</h2>
      </div>

      {/* Compact Single-Row Toolbar & Filters */}
      <div className="mb-3.5">
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-1.5 sm:gap-2 w-full">
          
          {/* 1. Add Lead (Icon-Only, Compact) */}
          <button
            type="button"
            title="Add Lead"
            aria-label="Add Lead"
            className="h-8 w-8 sm:h-8.5 sm:w-8.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-md flex items-center justify-center shadow-xs transition hover:shadow focus:outline-none focus:ring-1 focus:ring-blue-500 shrink-0"
            onClick={handleOpenAdd}
          >
            <FaPlus className="text-xs sm:text-sm" />
          </button>

          {/* 2. Upload Excel/CSV (Icon-Only, Compact) */}
          <button
            type="button"
            title="Upload Excel/CSV"
            aria-label="Upload Excel/CSV"
            className="h-8 w-8 sm:h-8.5 sm:w-8.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-md flex items-center justify-center shadow-xs transition hover:shadow focus:outline-none focus:ring-1 focus:ring-blue-500 shrink-0"
            onClick={() => {
              setUploadStep(1);
              setUploadedFile(null);
              setShowUploadModal(true);
            }}
          >
            <FaFileExcel className="text-xs sm:text-sm" />
          </button>

          {/* 3. Refresh (Icon-Only, Compact) */}
          <button
            type="button"
            onClick={() => fetchLeads(page)}
            className="h-8 w-8 sm:h-8.5 sm:w-8.5 bg-white hover:bg-gray-100 active:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md shadow-xs flex items-center justify-center transition hover:shadow focus:outline-none focus:ring-1 focus:ring-blue-500 shrink-0"
            title="Refresh"
            aria-label="Refresh"
          >
            <FaSyncAlt className={`text-xs sm:text-sm ${loading ? "animate-spin" : ""}`} />
          </button>

          {/* Optional Bulk Assign and Bulk Status Buttons if items selected */}
          {selectedLeadIds.length > 0 && isSuperOrAdmin && (
            <button
              type="button"
              className="bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white px-2.5 h-8 sm:h-8.5 rounded-md flex items-center gap-1.5 shadow-xs text-xs font-medium transition shrink-0"
              onClick={() => setShowAssignModal(true)}
              title="Assign Selected Leads"
            >
              <FaUserCheck className="text-xs" />
              <span>Assign ({selectedLeadIds.length})</span>
            </button>
          )}

          {selectedLeadIds.length > 0 && (
            <button
              type="button"
              className="bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white px-2.5 h-8 sm:h-8.5 rounded-md flex items-center gap-1.5 shadow-xs text-xs font-medium transition shrink-0"
              onClick={() => {
                setBulkStatusValue("Lead");
                setShowBulkStatusModal(true);
              }}
              title="Change Status for Selected Leads"
            >
              <FaSyncAlt className="text-xs" />
              <span>Status ({selectedLeadIds.length})</span>
            </button>
          )}

          {/* 4. Status Filter Tabs (placed immediately beside Refresh) */}
          {[
            { key: "all", label: "All Leads", count: counts.all },
            { key: "Lead", label: "Lead", count: counts.lead },
            { key: "HostLead", label: "HostLead", count: counts.hostlead },
            { key: "Converted", label: "Converted", count: counts.converted },
            { key: "unassigned", label: "Unassigned", count: counts.unassigned },
          ].map((tab) => {
            const isActive = tab.key === "unassigned" ? isUnassignedOnly : (selectedStatus === tab.key && !isUnassignedOnly);
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleStatusTabClick(tab.key)}
                className={`px-2 sm:px-2.5 h-8 sm:h-8.5 rounded-md text-xs font-medium transition whitespace-nowrap focus:outline-none focus:ring-1 focus:ring-blue-500 flex items-center justify-center shrink-0 ${
                  isActive
                    ? "bg-blue-600 text-white shadow-xs font-semibold"
                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                <span>{tab.label}</span>
                <span className="ml-1 opacity-80 font-normal">({tab.count})</span>
              </button>
            );
          })}

          {/* 5. City Filter Dropdown (beside status filters) */}
          <select
            value={selectedCity}
            onChange={(e) => {
              setSelectedCity(e.target.value);
              setPage(1);
            }}
            className="h-8 sm:h-8.5 px-2 py-0 border rounded-md bg-white dark:bg-gray-800 text-gray-800 dark:text-white border-gray-300 dark:border-gray-600 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer min-w-[95px] max-w-[130px] shrink-0"
          >
            <option value="">All Cities</option>
            {filterOptions.cities.map((c, i) => (
              <option key={i} value={c}>{c}</option>
            ))}
          </select>

          {/* 6. Assignee Filter Dropdown (beside city filter) */}
          {isSuperOrAdmin && (
            <select
              value={isUnassignedOnly ? "unassigned" : selectedAssignee}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "unassigned") {
                  setIsUnassignedOnly(true);
                  setSelectedAssignee("");
                } else {
                  setIsUnassignedOnly(false);
                  setSelectedAssignee(val);
                }
                setPage(1);
              }}
              className="h-8 sm:h-8.5 px-2 py-0 border rounded-md bg-white dark:bg-gray-800 text-gray-800 dark:text-white border-gray-300 dark:border-gray-600 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer min-w-[110px] max-w-[155px] shrink-0"
            >
              <option value="">All Assignees ({counts.all})</option>
              <option value="unassigned">Unassigned Only ({counts.unassigned})</option>
              {filterOptions.assignable_users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.role ? `(${u.role})` : ""} ({u.count ?? 0})
                </option>
              ))}
            </select>
          )}

          {/* 7. Segment Filter Dropdown (arranged adjacent to All Assignees) */}
          <select
            value={selectedSegment}
            onChange={(e) => {
              setSelectedSegment(e.target.value);
              setPage(1);
            }}
            className="h-8 sm:h-8.5 px-2 py-0 border rounded-md bg-white dark:bg-gray-800 text-gray-800 dark:text-white border-gray-300 dark:border-gray-600 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer min-w-[110px] max-w-[155px] shrink-0"
          >
            <option value="all">All Segments ({counts.all})</option>
            {filterOptions.segments.map((seg) => (
              <option key={seg.name} value={seg.name}>
                {seg.name} ({seg.count})
              </option>
            ))}
          </select>

          {/* Reset Filter Button (conditionally shown if active filters) */}
          {(searchTerm || selectedCity || selectedStatus !== "all" || selectedSegment !== "all" || selectedAssignee || isUnassignedOnly) && (
            <button
              type="button"
              onClick={handleResetFilters}
              title="Reset Filters"
              className="h-8 sm:h-8.5 px-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md text-xs font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition shrink-0"
            >
              Reset
            </button>
          )}

          {/* 7. Search Input (positioned at the far right via ml-auto) */}
          <div className="relative flex-1 min-w-[130px] max-w-full sm:max-w-[180px] md:max-w-[210px] xl:max-w-[240px] ml-auto shrink-0 w-full sm:w-auto">
            <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none" />
            <input
              type="text"
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full h-8 sm:h-8.5 pl-8 pr-2.5 text-xs border rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 shadow-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

        </div>
      </div>

      {/* Horizontally Scrollable Table Container */}
      <div className="w-full max-w-full overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800">
        <table className="w-full text-xs sm:text-sm text-left text-gray-600 dark:text-gray-300">
          <thead className="bg-gray-50 dark:bg-gray-700/60 text-gray-700 dark:text-gray-200 font-semibold border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-3 sm:px-4 py-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={leads.length > 0 && selectedLeadIds.length === leads.length}
                  onChange={handleSelectAllOnPage}
                  className="rounded cursor-pointer"
                />
              </th>
              <th className="px-3 sm:px-4 py-3 min-w-[160px]">Company</th>
              <th className="px-3 sm:px-4 py-3 min-w-[160px]">Contact Person</th>
              <th className="px-3 sm:px-4 py-3 whitespace-nowrap min-w-[125px]">Phone / Mobile</th>
              <th className="px-3 sm:px-4 py-3 whitespace-nowrap min-w-[105px]">City</th>
              <th className="px-3 sm:px-4 py-3 whitespace-nowrap min-w-[120px]">Status</th>
              <th className="px-3 sm:px-4 py-3 whitespace-nowrap min-w-[140px]">Assigned To</th>
              <th className="px-3 sm:px-4 py-3 whitespace-nowrap min-w-[100px]">Created</th>
              <th className="px-3 sm:px-4 py-3 text-center whitespace-nowrap min-w-[105px]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan="9" className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <div className="flex items-center justify-center gap-2">
                    <FaSyncAlt className="animate-spin text-blue-500" />
                    <span>Loading leads...</span>
                  </div>
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan="9" className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No leads found.
                </td>
              </tr>
            ) : (
              leads.map((lead) => {
                const isChecked = selectedLeadIds.includes(lead.id);
                const displayPhone = (lead.phone && lead.phone !== "0") ? lead.phone : ((lead.mobile && lead.mobile !== "0") ? lead.mobile : "");
                return (
                  <tr key={lead.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/60 transition">
                    <td className="px-3 sm:px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleLeadSelect(lead.id)}
                        className="rounded cursor-pointer"
                      />
                    </td>
                    <td className="px-3 sm:px-4 py-3 font-semibold text-gray-900 dark:text-white max-w-[200px] break-words">
                      {lead.company_name || <span className="text-gray-400 italic">No Company</span>}
                    </td>
                    <td className="px-3 sm:px-4 py-3">
                      <div className="text-gray-800 dark:text-gray-200 font-medium">
                        {lead.first_name || lead.last_name ? `${lead.first_name || ""} ${lead.last_name || ""}`.trim() : "—"}
                      </div>
                      {lead.email && (
                        <div className="text-2xs text-gray-500 flex items-center gap-1 mt-0.5 break-all max-w-[220px]">
                          <FaEnvelope className="text-gray-400 flex-shrink-0" /> {lead.email}
                        </div>
                      )}
                    </td>
                    <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                      {displayPhone ? (
                        <div className="flex items-center gap-1 font-mono text-xs text-gray-700 dark:text-gray-300">
                          <FaPhone className="text-gray-400" /> {displayPhone}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                      {lead.city ? (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300">
                          <FaMapMarkerAlt className="text-red-500 flex-shrink-0" /> {lead.city}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                      {(() => {
                        const currentVal = !lead.assigned_to ? "Unassigned" : (lead.status || "Lead");
                        return (
                          <select
                            value={currentVal}
                            onChange={(e) => handleQuickStatusChange(lead.id, e.target.value)}
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full border cursor-pointer focus:outline-none transition ${
                              currentVal === "Converted"
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/60 dark:text-emerald-200 dark:border-emerald-700"
                                : currentVal === "HostLead"
                                ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/60 dark:text-amber-200 dark:border-amber-700"
                                : currentVal === "Lead"
                                ? "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/60 dark:text-sky-200 dark:border-sky-700"
                                : "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                            }`}
                          >
                            <option value="Lead">Lead</option>
                            <option value="HostLead">HostLead</option>
                            <option value="Converted">Converted</option>
                            <option value="Unassigned">Unassigned</option>
                          </select>
                        );
                      })()}
                    </td>
                    <td className="px-3 sm:px-4 py-3">
                      {lead.assigned_users && lead.assigned_users.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          {lead.assigned_users.map((u) => (
                            <span
                              key={u.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200 shadow-2xs whitespace-nowrap"
                              title={`Assigned to ${u.name || u.username}`}
                            >
                              <FaUserCheck className="text-[10px]" />
                              {u.name || u.username}
                            </span>
                          ))}
                        </div>
                      ) : lead.assigned_to && lead.assigned_to_name && lead.assigned_to_name !== "Unassigned" ? (
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200 shadow-2xs whitespace-nowrap"
                          title={`Assigned to ${lead.assigned_to_name}`}
                        >
                          <FaUserCheck className="text-[11px]" />
                          {lead.assigned_to_name}
                        </span>
                      ) : (
                        <span
                          className="inline-block px-2.5 py-0.5 text-xs text-gray-500 bg-gray-100 dark:bg-gray-700/60 rounded-md"
                          title="Unassigned"
                        >
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                      {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-3 sm:gap-4 text-base sm:text-lg">
                        <button
                          onClick={() => handleOpenDetail(lead)}
                          className="text-blue-600 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300 p-1 transition"
                          title="View Details"
                        >
                          <FaEye />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(lead)}
                          className="text-blue-600 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300 p-1 transition"
                          title="Edit Lead"
                        >
                          <FaRegEdit />
                        </button>
                        {isSuperOrAdmin && (
                          <button
                            onClick={() => {
                              setLeadToDelete(lead);
                              setShowDeleteModal(true);
                            }}
                            className="text-red-600 hover:text-red-400 dark:text-red-400 dark:hover:text-red-300 p-1 transition"
                            title="Delete Lead"
                          >
                            <FaRegTrashAlt />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row justify-between items-center mt-5 sm:mt-6 gap-3 sm:gap-4 text-xs sm:text-sm">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 w-full sm:w-auto">
          <label className="text-gray-700 dark:text-gray-300 whitespace-nowrap">Rows per page:</label>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="border px-2 py-1.5 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-white border-gray-300 dark:border-gray-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            {[10, 25, 50, 100].map((num) => (
              <option key={num} value={num}>{num}</option>
            ))}
          </select>
          <span className="text-gray-500 dark:text-gray-400 ml-1 whitespace-nowrap">Total: {totalLeads} leads</span>
        </div>
        <div className="flex items-center justify-center gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={() => fetchLeads(page - 1)}
            disabled={page <= 1}
            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 shadow-sm transition font-medium"
          >
            Previous
          </button>
          <span className="text-gray-700 dark:text-gray-300 whitespace-nowrap font-medium px-1">
            Page {page} of {totalPages || 1}
          </span>
          <button
            onClick={() => fetchLeads(page + 1)}
            disabled={page >= totalPages}
            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 shadow-sm transition font-medium"
          >
            Next
          </button>
        </div>
      </div>

      {/* ================= MODAL: ADD / EDIT LEAD ================= */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700 my-auto">
            <div className="flex justify-between items-center px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                {showAddModal ? <FaPlus /> : <FaEdit />}
                {showAddModal ? "Create New Lead" : "Edit Lead"}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={showAddModal ? handleCreateLead : handleUpdateLead} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Company Name</label>
                  <input
                    type="text"
                    value={leadForm.company_name}
                    onChange={(e) => setLeadForm({ ...leadForm, company_name: e.target.value })}
                    placeholder="e.g. Acme Health Corp"
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Status *</label>
                  <select
                    value={leadForm.status}
                    onChange={(e) => setLeadForm({ ...leadForm, status: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  >
                    <option value="Lead">Lead</option>
                    <option value="HostLead">HostLead</option>
                    <option value="Converted">Converted</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">First Name</label>
                  <input
                    type="text"
                    value={leadForm.first_name}
                    onChange={(e) => setLeadForm({ ...leadForm, first_name: e.target.value })}
                    placeholder="First Name"
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={leadForm.last_name}
                    onChange={(e) => setLeadForm({ ...leadForm, last_name: e.target.value })}
                    placeholder="Last Name"
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Phone 1 (Landline)</label>
                  <input
                    type="text"
                    value={leadForm.phone}
                    onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                    placeholder="Primary phone"
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Secondary Phone</label>
                  <input
                    type="text"
                    value={leadForm.secondary_phone}
                    onChange={(e) => setLeadForm({ ...leadForm, secondary_phone: e.target.value })}
                    placeholder="Secondary phone"
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Mobile 1</label>
                  <input
                    type="text"
                    value={leadForm.mobile}
                    onChange={(e) => setLeadForm({ ...leadForm, mobile: e.target.value })}
                    placeholder="Primary mobile"
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Secondary Mobile</label>
                  <input
                    type="text"
                    value={leadForm.secondary_mobile}
                    onChange={(e) => setLeadForm({ ...leadForm, secondary_mobile: e.target.value })}
                    placeholder="Secondary mobile"
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={leadForm.email}
                    onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                    placeholder="Email address"
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">City</label>
                  <input
                    type="text"
                    value={leadForm.city}
                    onChange={(e) => setLeadForm({ ...leadForm, city: e.target.value })}
                    placeholder="City"
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">State</label>
                  <input
                    type="text"
                    value={leadForm.state}
                    onChange={(e) => setLeadForm({ ...leadForm, state: e.target.value })}
                    placeholder="State"
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Pincode</label>
                  <input
                    type="text"
                    value={leadForm.pincode}
                    onChange={(e) => setLeadForm({ ...leadForm, pincode: e.target.value })}
                    placeholder="Pincode"
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  />
                </div>

                {isSuperOrAdmin && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Assigned To (Multi-Select Users)
                    </label>
                    <UserMultiSelectDropdown
                      users={filterOptions.assignable_users}
                      selectedIds={leadForm.assigned_to}
                      onChange={(newSelected) => setLeadForm({ ...leadForm, assigned_to: newSelected })}
                      placeholder="Search active users to assign..."
                    />
                    <p className="text-2xs text-gray-400 dark:text-gray-500 mt-1">
                      All selected users will independently receive and manage this lead in their Task Manager.
                    </p>
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Address Line 1</label>
                  <input
                    type="text"
                    value={leadForm.address_line1}
                    onChange={(e) => setLeadForm({ ...leadForm, address_line1: e.target.value })}
                    placeholder="Street, locality, area..."
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                  <textarea
                    rows="2"
                    value={leadForm.notes}
                    onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                    placeholder="Lead notes, requirements, interactions..."
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  ></textarea>
                </div>
              </div>
            </div>

              <div className="flex justify-end gap-2 sm:gap-3 p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                  }}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition"
                >
                  {showAddModal ? "Save Lead" : "Update Lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: LEAD DETAIL & ALL EXCEL COLUMNS ================= */}
      {showDetailModal && activeLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700 my-auto animate-fadeIn">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start sm:items-center px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0 gap-2">
              <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                <div className="p-2 sm:p-2.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 rounded-xl flex-shrink-0 mt-0.5 sm:mt-0">
                  <FaBuilding className="text-lg sm:text-xl" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate max-w-full">
                      {activeLead.company_name || `Lead #${activeLead.id}`}
                    </h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      activeLead.status === "Converted" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" :
                      activeLead.status === "HostLead" ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" :
                      "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200"
                    }`}>
                      {activeLead.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex flex-wrap items-center gap-1 sm:gap-2">
                    <span>Lead ID: #{activeLead.id}</span>
                    {activeLead.excel_name && (
                      <>
                        <span className="hidden sm:inline">•</span>
                        <span className="flex items-center gap-1 font-mono text-gray-600 dark:text-gray-300 truncate max-w-[180px] sm:max-w-xs">
                          <FaFileExcel className="text-emerald-500 flex-shrink-0" /> Source: {activeLead.excel_name}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                {isSuperOrAdmin && (
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      handleOpenEdit(activeLead);
                    }}
                    className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition shadow-sm"
                  >
                    <FaEdit /> <span className="hidden sm:inline">Edit Lead</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setExcelSearchTerm("");
                  }}
                  className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg transition"
                >
                  <FaTimes />
                </button>
              </div>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1 text-xs sm:text-sm">
              
              {/* Section 1: Standard Company & Contact Info Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Contact & Communication */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                    <FaUserFriends className="text-blue-500" /> Contact Info
                  </h4>
                  <div>
                    <span className="text-2xs text-gray-400 block">Contact Person</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {activeLead.first_name || activeLead.last_name ? `${activeLead.first_name || ""} ${activeLead.last_name || ""}`.trim() : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-2xs text-gray-400 block">Email Address</span>
                    <span className="text-gray-800 dark:text-gray-200 font-mono text-xs">
                      {activeLead.email || "—"}
                    </span>
                    {activeLead.secondary_email && (
                      <div className="text-2xs text-gray-400 font-mono">{activeLead.secondary_email}</div>
                    )}
                  </div>
                  <div>
                    <span className="text-2xs text-gray-400 block">Phone / Mobile</span>
                    <span className="text-gray-800 dark:text-gray-200 font-mono text-xs">
                      {(() => {
                        const p = (activeLead.phone && activeLead.phone !== "0") ? activeLead.phone : "";
                        const m = (activeLead.mobile && activeLead.mobile !== "0") ? activeLead.mobile : "";
                        if (p && m && p !== m) return `${p} / ${m}`;
                        return p || m || "—";
                      })()}
                    </span>
                  </div>
                </div>

                {/* Location & Address */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                    <FaMapMarkerAlt className="text-red-500" /> Location Details
                  </h4>
                  <div>
                    <span className="text-2xs text-gray-400 block">City & State</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {activeLead.city || activeLead.state ? `${activeLead.city || "—"}, ${activeLead.state || "—"}` : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-2xs text-gray-400 block">Country & Postal Code</span>
                    <span className="text-gray-800 dark:text-gray-200">
                      {activeLead.country || "—"} {activeLead.pincode ? `(${activeLead.pincode})` : ""}
                    </span>
                  </div>
                  <div>
                    <span className="text-2xs text-gray-400 block">Address</span>
                    <span className="text-gray-800 dark:text-gray-200 text-xs">
                      {[activeLead.address_line1, activeLead.address_line2].filter(Boolean).join(", ") || "—"}
                    </span>
                  </div>
                </div>

                {/* Assignment & Pipeline */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                    <FaUserCheck className="text-purple-500" /> Assignment & Sales
                  </h4>
                  <div>
                    <span className="text-2xs text-gray-400 block">Assigned Representative(s)</span>
                    {activeLead.assigned_users && activeLead.assigned_users.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {activeLead.assigned_users.map((u) => (
                          <span
                            key={u.id}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200"
                          >
                            <FaUserCheck className="text-[10px]" /> {u.name || u.username} {u.role ? `(${u.role})` : ""}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="font-semibold text-purple-700 dark:text-purple-300">
                        {activeLead.assigned_to_name || "Unassigned"}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-2xs text-gray-400 block">Assigned By</span>
                    <span className="text-gray-700 dark:text-gray-300 text-xs">
                      {activeLead.assigned_to && activeLead.assigned_by_name ? activeLead.assigned_by_name : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-2xs text-gray-400 block">Status Updated By</span>
                    <span className="text-gray-700 dark:text-gray-300 text-xs">
                      {activeLead.status_updated_by_name ? (
                        <>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {activeLead.status_updated_by_name}
                          </span>
                          {activeLead.status_updated_at && (
                            <span className="text-gray-400 block text-3xs font-mono">
                              {new Date(activeLead.status_updated_at).toLocaleString()}
                            </span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </span>
                  </div>
                  {activeLead.segment && (
                    <div>
                      <span className="text-2xs text-gray-400 block">Segment</span>
                      <span className="text-gray-800 dark:text-gray-200 text-xs">{activeLead.segment}</span>
                    </div>
                  )}
                  {activeLead.category && (
                    <div>
                      <span className="text-2xs text-gray-400 block">Category</span>
                      <span className="text-gray-800 dark:text-gray-200 text-xs">{activeLead.category}</span>
                    </div>
                  )}
                </div>

              </div>

              {/* Section 2: DYNAMIC ALL EXCEL / CSV COLUMNS VIEW */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 px-5 py-3.5 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="flex items-center gap-2">
                    <FaFileExcel className="text-emerald-600 dark:text-emerald-400 text-lg" />
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white text-sm">
                        Original Excel / CSV Columns
                      </h4>
                      <p className="text-2xs text-gray-500 dark:text-gray-400">
                        All uploaded raw attributes and values stored for this company row.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative w-full sm:w-64">
                      <FaSearch className="absolute left-2.5 top-2.5 text-gray-400 text-xs" />
                      <input
                        type="text"
                        placeholder="Search column or value..."
                        value={excelSearchTerm}
                        onChange={(e) => setExcelSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-gray-900 dark:text-white"
                      />
                    </div>
                    <span className="px-2.5 py-1 text-2xs font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 rounded-full whitespace-nowrap">
                      {Object.keys(activeLead.raw_data || {}).filter(k => k.toLowerCase() !== 'file_column_header' && k.toLowerCase() !== 'file column header').length} Columns
                    </span>
                  </div>
                </div>

                <div className="p-4 max-h-80 overflow-y-auto">
                  {activeLead.raw_data && Object.keys(activeLead.raw_data).length > 0 ? (
                    (() => {
                      const entries = Object.entries(activeLead.raw_data).filter(([k, v]) => {
                        const cleanK = k.trim().toLowerCase();
                        if (cleanK === 'file_column_header' || cleanK === 'file column header' || cleanK === 'filename' || cleanK.startsWith('__parsed_extra')) return false;
                        if (!excelSearchTerm.trim()) return true;
                        const q = excelSearchTerm.toLowerCase();
                        return k.toLowerCase().includes(q) || formatColumnLabel(k).toLowerCase().includes(q) || String(v).toLowerCase().includes(q);
                      });

                      if (entries.length === 0) {
                        return (
                          <div className="py-6 text-center text-xs text-gray-400">
                            No columns match "{excelSearchTerm}".
                          </div>
                        );
                      }

                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {entries.map(([columnName, rawVal]) => {
                            const hasValue = rawVal !== null && rawVal !== undefined && String(rawVal).trim() !== "";
                            return (
                              <div
                                key={columnName}
                                className="p-2.5 rounded-lg border border-gray-150 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/40 hover:border-emerald-300 dark:hover:border-emerald-700 transition"
                              >
                                <div className="text-2xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 truncate" title={columnName}>
                                  {columnName}
                                </div>
                                <div
                                  className={`mt-1 text-xs break-words ${
                                    hasValue
                                      ? "font-medium text-gray-900 dark:text-gray-100"
                                      : "text-gray-400 dark:text-gray-500 italic"
                                  }`}
                                  title={hasValue ? String(rawVal) : "No value"}
                                >
                                  {hasValue ? String(rawVal) : "—"}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="py-8 text-center text-gray-400 text-xs">
                      No raw spreadsheet data stored for this lead.
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: Notes if present */}
              {activeLead.notes && (
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                  <div className="text-xs text-gray-400 font-semibold mb-1">Notes & Remarks</div>
                  <div className="text-gray-700 dark:text-gray-300 text-xs whitespace-pre-wrap">{activeLead.notes}</div>
                </div>
              )}

              {/* Section 4: Assignment History Timeline */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-800">
                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2 mb-3">
                  <FaHistory className="text-purple-500" /> Assignment Audit History
                </h4>

                {activeLead.assignment_history && activeLead.assignment_history.length > 0 ? (
                  <div className="space-y-2">
                    {activeLead.assignment_history.map((hist, idx) => (
                      <div key={idx} className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-900/70 rounded-lg text-xs border border-gray-100 dark:border-gray-700">
                        <div>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            Assigned to: {hist.assigned_to_name}
                          </span>
                          {hist.assigned_by_name && (
                            <span className="text-gray-500"> (by {hist.assigned_by_name})</span>
                          )}
                          {hist.notes && (
                            <div className="text-gray-500 dark:text-gray-400 mt-1 italic">{hist.notes}</div>
                          )}
                        </div>
                        <div className="text-gray-400 text-3xs font-mono">
                          {new Date(hist.assigned_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 italic">No previous assignment changes recorded.</div>
                )}
              </div>

              {/* Section 5: Status Audit History Timeline */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-800">
                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2 mb-3">
                  <FaHistory className="text-sky-500" /> Status Audit History
                </h4>

                {activeLead.status_history && activeLead.status_history.length > 0 ? (
                  <div className="space-y-2">
                    {activeLead.status_history.map((hist, idx) => (
                      <div key={idx} className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-900/70 rounded-lg text-xs border border-gray-100 dark:border-gray-700">
                        <div>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            Status: {hist.old_status ? `${hist.old_status} ➔ ` : ""}{hist.new_status}
                          </span>
                          {hist.changed_by_name && (
                            <span className="text-gray-500"> (by {hist.changed_by_name})</span>
                          )}
                          {hist.notes && (
                            <div className="text-gray-500 dark:text-gray-400 mt-1 italic">{hist.notes}</div>
                          )}
                        </div>
                        <div className="text-gray-400 text-3xs font-mono">
                          {new Date(hist.changed_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 italic">No status transitions recorded yet.</div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="flex flex-col-reverse sm:flex-row justify-between items-center px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 gap-2 sm:gap-0">
              <div className="text-2xs text-gray-400 font-mono text-center sm:text-left">
                Created: {new Date(activeLead.created_at).toLocaleDateString()}
              </div>

              <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
                {isSuperOrAdmin && (
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      handleOpenEdit(activeLead);
                    }}
                    className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center gap-1.5"
                  >
                    <FaEdit /> Edit Lead
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setExcelSearchTerm("");
                  }}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                >
                  Close
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ================= MODAL: BULK ASSIGN ================= */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700 my-auto">
            <div className="flex justify-between items-center px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FaUserCheck className="text-purple-600" />
                Assign Selected Leads ({selectedLeadIds.length})
              </h3>
              <button onClick={() => setShowAssignModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1">
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleBulkAssignSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Select Assignee(s) *
                    </label>
                    <label className="flex items-center gap-1.5 text-2xs text-gray-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bulkIsUnassign}
                        onChange={(e) => {
                          setBulkIsUnassign(e.target.checked);
                          if (e.target.checked) setBulkAssigneeIds([]);
                        }}
                        className="rounded cursor-pointer"
                      />
                      <span>Unassign all users</span>
                    </label>
                  </div>

                  {!bulkIsUnassign ? (
                    <UserMultiSelectDropdown
                      users={filterOptions.assignable_users}
                      selectedIds={bulkAssigneeIds}
                      onChange={setBulkAssigneeIds}
                      placeholder="Search users to assign..."
                    />
                  ) : (
                    <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs border border-red-200 dark:border-red-800">
                      All currently assigned users will be unassigned from the selected {selectedLeadIds.length} lead(s).
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Assignment Note / Reason
                  </label>
                  <textarea
                    rows="2"
                    value={bulkAssignNotes}
                    onChange={(e) => setBulkAssignNotes(e.target.value)}
                    placeholder="e.g. Assigned for Q4 outbound calling"
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  ></textarea>
                </div>
              </div>

              <div className="flex justify-end gap-2 sm:gap-3 p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-sm"
                >
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: BULK STATUS UPDATE ================= */}
      {showBulkStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700 my-auto">
            <div className="flex justify-between items-center px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FaSyncAlt className="text-sky-600" />
                Update Status ({selectedLeadIds.length} Leads)
              </h3>
              <button onClick={() => setShowBulkStatusModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1">
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleBulkStatusSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Select New Business Status *
                  </label>
                  <select
                    required
                    value={bulkStatusValue}
                    onChange={(e) => setBulkStatusValue(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  >
                    <option value="Lead">Lead</option>
                    <option value="HostLead">HostLead</option>
                    <option value="Converted">Converted</option>
                    <option value="Unassigned">Unassigned</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Status Change Note / Reason
                  </label>
                  <textarea
                    rows="2"
                    value={bulkStatusNotes}
                    onChange={(e) => setBulkStatusNotes(e.target.value)}
                    placeholder="e.g. Bulk status update following outbound call"
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  ></textarea>
                </div>
              </div>

              <div className="flex justify-end gap-2 sm:gap-3 p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowBulkStatusModal(false)}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold bg-sky-600 hover:bg-sky-700 text-white rounded-lg shadow-sm"
                >
                  Confirm Status Change
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EXCEL / CSV UPLOAD & COLUMN MAPPING WIZARD ================= */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700 my-auto">
            <div className="flex justify-between items-center px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FaFileExcel className="text-emerald-600" />
                Upload Leads via Excel / CSV (Step {uploadStep} of 2)
              </h3>
              <button onClick={() => setShowUploadModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1">
                <FaTimes />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1">
              {uploadStep === 1 && (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl p-6 sm:p-8 text-center hover:border-blue-500 transition cursor-pointer relative bg-gray-50 dark:bg-gray-900/50">
                    <input
                      type="file"
                      accept=".csv, .xlsx, .xls"
                      onChange={handleFileSelect}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <FaUpload className="mx-auto text-3xl sm:text-4xl text-blue-500 mb-3" />
                    <h4 className="text-sm sm:text-base font-semibold text-gray-800 dark:text-gray-200">
                      Choose an Excel or CSV spreadsheet
                    </h4>
                    <p className="text-2xs sm:text-xs text-gray-500 mt-1">
                      Supports .csv, .xlsx, .xls (e.g. sample icrm_20250607123833_7.csv)
                    </p>
                  </div>
                </div>
              )}

              {uploadStep === 2 && (
                <div className="space-y-4 sm:space-y-6">
                  <div className="bg-blue-50 dark:bg-blue-900/30 p-3 sm:p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-blue-900 dark:text-blue-200">
                        File: {uploadedFileName}
                      </div>
                      <div className="text-2xs sm:text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                        {rawParsedRows.length} total rows detected. Match each file column to system fields below.
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                      <div className="w-full sm:w-auto">
                        <label className="block text-2xs uppercase font-bold text-gray-500 mb-0.5">Default Status</label>
                        <select
                          value={uploadDefaultStatus}
                          onChange={(e) => setUploadDefaultStatus(e.target.value)}
                          className="w-full sm:w-auto px-2 py-1 text-xs border rounded-lg bg-white dark:bg-gray-800 dark:text-white"
                        >
                          <option value="Lead">Lead</option>
                          <option value="HostLead">HostLead</option>
                          <option value="Converted">Converted</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 text-xs text-purple-800 dark:text-purple-200 font-medium">
                        <FaUserCheck className="text-purple-600 dark:text-purple-400" />
                        <span>Assignment: <strong>Unassigned</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Sub-navigation tabs: Column Mapping & Data Preview */}
                  <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
                    <button
                      type="button"
                      onClick={() => setUploadViewMode("mapping")}
                      className={`px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                        uploadViewMode === "mapping"
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      Column Mapping ({fileHeaders.length} Columns)
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadViewMode("preview")}
                      className={`px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                        uploadViewMode === "preview"
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      Data Preview ({previewRows.length} Sample Rows)
                    </button>
                  </div>

                  {uploadViewMode === "mapping" ? (
                    /* Column Mapping Table */
                    <div className="space-y-3">
                      {duplicateMappedFields.length > 0 && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
                          <FaExclamationTriangle className="text-red-500 flex-shrink-0" />
                          <span>
                            <strong>Duplicate mapping detected:</strong> Multiple columns are mapped to the same field (
                            {duplicateMappedFields.map((k) => {
                              const lbl = systemFields.find((f) => f.key === k)?.label || k;
                              const cols = targetToHeaders[k]?.join(", ") || "";
                              return `${lbl} [${cols}]`;
                            }).join("; ")}
                            ). Each system destination field must be mapped uniquely.
                          </span>
                        </div>
                      )}

                      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden max-h-[350px] overflow-y-auto overflow-x-auto">
                        <table className="w-full min-w-[500px] text-left text-xs">
                          <thead className="bg-gray-100 dark:bg-gray-900 uppercase font-semibold text-gray-500 sticky top-0">
                            <tr>
                              <th className="py-2.5 px-3">File Column Header</th>
                              <th className="py-2.5 px-3">Sample Value (Row 1)</th>
                              <th className="py-2.5 px-3">Map to System Field</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {fileHeaders
                              .filter((h) => h && h.trim().toLowerCase() !== "file_column_header" && h.trim().toLowerCase() !== "file column header")
                              .map((header, idx) => {
                                const firstValidRow = rawParsedRows && rawParsedRows.length > 0 ? rawParsedRows[0] : (previewRows[0] || null);
                                const sampleVal = firstValidRow ? firstValidRow[header] : "";
                                const hasVal = sampleVal !== undefined && sampleVal !== null && String(sampleVal).trim() !== "";
                                const currentMapped = columnMapping[header] || "skip";
                                const isDuplicate = currentMapped !== "skip" && duplicateMappedFields.includes(currentMapped);
                                const otherCols = isDuplicate && targetToHeaders[currentMapped]
                                  ? targetToHeaders[currentMapped].filter((c) => c !== header)
                                  : [];

                                return (
                                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                                    <td className="py-2 px-3 font-semibold text-gray-900 dark:text-white max-w-[220px] break-words">
                                      {header}
                                    </td>
                                    <td
                                      className="py-2 px-3 text-gray-600 dark:text-gray-300 font-mono truncate max-w-[220px]"
                                      title={hasVal ? String(sampleVal) : "Empty"}
                                    >
                                      {hasVal ? (
                                        <span>{String(sampleVal)}</span>
                                      ) : (
                                        <span className="italic text-gray-400 dark:text-gray-500 font-normal">Empty</span>
                                      )}
                                    </td>
                                    <td className="py-2 px-3">
                                      <select
                                        value={currentMapped}
                                        onChange={(e) => {
                                          setColumnMapping({
                                            ...columnMapping,
                                            [header]: e.target.value
                                          });
                                        }}
                                        className={`px-2 py-1.5 rounded border text-xs font-medium w-full max-w-[240px] focus:outline-none transition ${
                                          isDuplicate
                                            ? "bg-red-50 border-red-500 text-red-900 dark:bg-red-900/40 dark:text-red-100"
                                            : currentMapped !== "skip"
                                            ? "bg-blue-50 border-blue-400 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100"
                                            : "bg-gray-50 border-gray-300 text-gray-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400"
                                        }`}
                                      >
                                        {systemFields.map((f) => (
                                          <option key={f.key} value={f.key}>
                                            {f.label}
                                          </option>
                                        ))}
                                      </select>
                                      {isDuplicate && otherCols.length > 0 && (
                                        <div className="text-3xs text-red-600 dark:text-red-400 mt-1 font-semibold flex items-start gap-1">
                                          <FaExclamationTriangle className="flex-shrink-0 text-red-500 mt-0.5" />
                                          <span>
                                            Conflicts with "{otherCols.join('", "')}". Both map to {systemFields.find(f => f.key === currentMapped)?.label || currentMapped}. Please choose a unique field or Skip.
                                          </span>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    /* Data Preview Table showing original CSV headers and row values */
                    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-x-auto max-h-[350px]">
                      <table className="min-w-full text-left text-xs whitespace-nowrap">
                        <thead className="bg-gray-100 dark:bg-gray-900 uppercase font-semibold text-gray-600 dark:text-gray-300 sticky top-0">
                          <tr>
                            <th className="py-2.5 px-3 border-b dark:border-gray-700 text-center w-12">#</th>
                            {fileHeaders.map((header, idx) => (
                              <th key={idx} className="py-2.5 px-3 border-b dark:border-gray-700">
                                <div>{header}</div>
                                {columnMapping[header] && columnMapping[header] !== "skip" && (
                                  <div className="text-2xs normal-case font-medium text-blue-600 dark:text-blue-400">
                                    → {systemFields.find(f => f.key === columnMapping[header])?.label || columnMapping[header]}
                                  </div>
                                )}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {previewRows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                              <td className="py-2 px-3 text-center text-gray-400 font-mono text-2xs">{rIdx + 1}</td>
                              {fileHeaders.map((header, cIdx) => {
                                const val = row[header];
                                const hasVal = val !== undefined && val !== null && String(val).trim() !== "";
                                return (
                                  <td key={cIdx} className="py-2 px-3 text-gray-700 dark:text-gray-300 max-w-[220px] truncate" title={hasVal ? String(val) : ""}>
                                    {hasVal ? String(val) : <span className="text-gray-300 dark:text-gray-600 italic">—</span>}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between items-center pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
                {uploadStep === 2 ? (
                  <button
                    onClick={() => setUploadStep(1)}
                    className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    Back to File
                  </button>
                ) : <div />}

                <div className="flex gap-2 sm:gap-3">
                  <button
                    onClick={() => setShowUploadModal(false)}
                    className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    Cancel
                  </button>
                  {uploadStep === 2 && (
                    <button
                      disabled={importing}
                      onClick={handleExecuteImport}
                      className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm disabled:opacity-50 transition"
                    >
                      {importing ? (
                        <>
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-r-transparent"></div>
                          Importing Leads...
                        </>
                      ) : (
                        <>
                          <FaCheck />
                          Import Leads ({rawParsedRows.length})
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: IMPORT RESULTS SUMMARY ================= */}
      {showImportResultModal && importResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700 my-auto">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-between items-center flex-shrink-0">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FaCheck className="text-emerald-500" />
                Import Summary Results
              </h3>
              <button onClick={() => setShowImportResultModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1">
                <FaTimes />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 text-center">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <div className="text-2xs sm:text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase">Imported</div>
                  <div className="text-xl sm:text-2xl font-extrabold text-emerald-800 dark:text-emerald-200 mt-1">
                    {importResult.imported_count}
                  </div>
                </div>

                <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-xl border border-amber-200 dark:border-amber-800">
                  <div className="text-2xs sm:text-xs font-bold text-amber-700 dark:text-amber-300 uppercase">Duplicates Skipped</div>
                  <div className="text-xl sm:text-2xl font-extrabold text-amber-800 dark:text-amber-200 mt-1">
                    {importResult.duplicate_count}
                  </div>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200 dark:border-gray-700">
                  <div className="text-2xs sm:text-xs font-bold text-gray-500 uppercase">Invalid Rows</div>
                  <div className="text-xl sm:text-2xl font-extrabold text-gray-700 dark:text-gray-300 mt-1">
                    {importResult.invalid_count}
                  </div>
                </div>
              </div>

              {importResult.duplicates && importResult.duplicates.length > 0 && (
                <div className="mt-4">
                  <h5 className="text-xs font-bold uppercase text-gray-500 mb-2">Duplicate Samples Skipped:</h5>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 text-xs">
                    {importResult.duplicates.slice(0, 10).map((dup, i) => (
                      <div key={i} className="p-2 bg-amber-50/50 dark:bg-amber-900/20 rounded border border-amber-200/50 flex flex-col sm:flex-row sm:justify-between gap-1">
                        <div>
                          <span className="font-semibold text-gray-800 dark:text-gray-200">
                            {dup.company_name || dup.name || "Lead"}
                          </span>
                          <span className="text-gray-500 ml-1 sm:ml-2">({dup.phone || dup.email || dup.city})</span>
                        </div>
                        <span className="text-amber-700 dark:text-amber-400 font-medium text-2xs sm:text-xs">{dup.reason}</span>
                      </div>
                    ))}
                    {importResult.duplicates.length > 10 && (
                      <div className="text-center text-2xs text-gray-400 italic">
                        + {importResult.duplicates.length - 10} more duplicates skipped
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex justify-end flex-shrink-0">
              <button
                onClick={() => setShowImportResultModal(false)}
                className="px-4 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && leadToDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-xl shadow-2xl w-full max-w-sm my-auto border border-gray-200 dark:border-gray-700">
            <h4 className="text-base sm:text-lg font-semibold mb-3 dark:text-white">Delete Lead?</h4>
            <p className="mb-4 text-xs sm:text-sm text-gray-600 dark:text-gray-300">
              Are you sure you want to delete lead for <strong>{leadToDelete.company_name || leadToDelete.first_name || "this lead"}</strong>?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setLeadToDelete(null);
                }}
                className="px-3 sm:px-4 py-1.5 text-xs sm:text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-3 sm:px-4 py-1.5 text-xs sm:text-sm bg-red-600 text-white rounded hover:bg-red-700 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
