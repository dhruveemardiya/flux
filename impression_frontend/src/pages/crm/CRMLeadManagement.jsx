import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { toast } from "react-toastify";
import {
  FaAddressBook, FaPlus, FaUpload, FaFileExport, FaSearch,
  FaFilter, FaEdit, FaTrash, FaCheck, FaTimes, FaSpinner,
  FaPhone, FaEnvelope, FaBuilding, FaMapMarkerAlt, FaFileExcel,
  FaCheckCircle, FaExclamationTriangle, FaExchangeAlt, FaHistory,
  FaUserTag, FaTag, FaInfoCircle, FaSave
} from "react-icons/fa";
import BASE_URL from "../config";
import axiosInstance from "../axiosconfig";

const CRM_FIELDS = [
  { key: "company_name", label: "Company Name", aliases: ["company", "company name", "organization", "firm"] },
  { key: "contact_person", label: "Contact Person", aliases: ["contact", "contact person", "name", "full name", "person"] },
  { key: "designation", label: "Designation", aliases: ["designation", "title", "role", "position"] },
  { key: "mobile_number", label: "Mobile Number", aliases: ["mobile", "mobile no", "mobile number", "phone", "contact no", "cell"] },
  { key: "alternate_mobile", label: "Alternate Mobile", aliases: ["alt mobile", "alternate mobile", "secondary mobile", "secondary phone"] },
  { key: "email", label: "Email Address", aliases: ["email", "email id", "mail", "email address"] },
  { key: "website", label: "Website", aliases: ["website", "url", "web", "domain"] },
  { key: "segment", label: "Segment", aliases: ["segment", "industry", "category", "sector"] },
  { key: "lead_source", label: "Lead Source", aliases: ["source", "lead source", "channel"] },
  { key: "city", label: "City", aliases: ["city", "town"] },
  { key: "state", label: "State", aliases: ["state", "province"] },
  { key: "country", label: "Country", aliases: ["country", "nation"] },
  { key: "pincode", label: "Pincode", aliases: ["pincode", "pin", "zip", "postal code"] },
  { key: "address_line1", label: "Address", aliases: ["address", "address 1", "street", "location"] },
  { key: "notes", label: "Notes / Discussion", aliases: ["notes", "remarks", "comment", "discussion"] },
];

const EMPTY_LEAD = {
  company_name: "",
  first_name: "",
  last_name: "",
  designation: "",
  mobile_number: "",
  alternate_mobile: "",
  email: "",
  secondary_email: "",
  website: "",
  address_line1: "",
  city: "",
  state: "",
  country: "India",
  pincode: "",
  segment: "Unassigned",
  lead_source: "Direct",
  notes: "",
  custom_fields: {},
};

export default function CRMLeadManagement({ user }) {
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [availableSegments, setAvailableSegments] = useState([]);
  const [availableStaff, setAvailableStaff] = useState([]);

  // Search & Filters
  const [search, setSearch] = useState("");
  const [filterSegment, setFilterSegment] = useState("");
  const [filterStaff, setFilterStaff] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [selectedLeads, setSelectedLeads] = useState(new Set());

  // Add / Edit Lead Modal
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [leadFormData, setLeadFormData] = useState(EMPTY_LEAD);
  const [savingLead, setSavingLead] = useState(false);

  // 7-Step Import Wizard States
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStep, setImportStep] = useState(1);
  const [importFile, setImportFile] = useState(null);
  const [importFileName, setImportFileName] = useState("");
  const [detectedHeaders, setDetectedHeaders] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [duplicateValidationResult, setDuplicateValidationResult] = useState(null);
  const [duplicateResolutions, setDuplicateResolutions] = useState({});
  const [createUnknownSegments, setCreateUnknownSegments] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const fileInputRef = useRef(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`${BASE_URL}/api/crm/leads/`, {
        params: {
          search,
          segment: filterSegment,
          staff_id: filterStaff,
          city: filterCity,
          page,
          page_size: 25,
        },
      });
      setLeads(res.data.leads || []);
      setTotal(res.data.total || 0);
      setNumPages(res.data.num_pages || 1);
      setAvailableSegments(res.data.available_segments || []);
      setAvailableStaff(res.data.available_staff || []);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to load leads.");
    } finally {
      setLoading(false);
    }
  }, [search, filterSegment, filterStaff, filterCity, page]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Bulk Selection
  const toggleSelectLead = (id) => {
    const next = new Set(selectedLeads);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedLeads(next);
  };

  const handleSelectAllOnPage = () => {
    if (selectedLeads.size === leads.length && leads.length > 0) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(leads.map((l) => l.id)));
    }
  };

  // Add / Edit Lead
  const handleOpenAddLead = () => {
    setEditingLead(null);
    setLeadFormData(EMPTY_LEAD);
    setShowLeadModal(true);
  };

  const handleOpenEditLead = (lead) => {
    setEditingLead(lead);
    setLeadFormData({
      company_name: lead.company_name || "",
      first_name: lead.first_name || "",
      last_name: lead.last_name || "",
      designation: lead.designation || "",
      mobile_number: lead.mobile_number || lead.phone || "",
      alternate_mobile: lead.alternate_mobile || "",
      email: lead.email || "",
      secondary_email: lead.secondary_email || "",
      website: lead.website || "",
      address_line1: lead.address_line1 || "",
      city: lead.city || "",
      state: lead.state || "",
      country: lead.country || "India",
      pincode: lead.pincode || "",
      segment: lead.segment || "Unassigned",
      lead_source: lead.lead_source || "Direct",
      notes: lead.notes || "",
      custom_fields: lead.custom_fields || {},
    });
    setShowLeadModal(true);
  };

  const handleSaveLead = async (e) => {
    e.preventDefault();
    setSavingLead(true);
    try {
      if (editingLead) {
        await axiosInstance.put(`${BASE_URL}/api/crm/leads/${editingLead.id}/`, leadFormData);
        toast.success("Lead updated successfully.");
      } else {
        await axiosInstance.post(`${BASE_URL}/api/crm/leads/`, leadFormData);
        toast.success("Lead created successfully.");
      }
      setShowLeadModal(false);
      fetchLeads();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save lead.");
    } finally {
      setSavingLead(false);
    }
  };

  const handleDeleteLead = async (id, name) => {
    if (!window.confirm(`Delete lead "${name || "this lead"}"?`)) return;
    try {
      await axiosInstance.delete(`${BASE_URL}/api/crm/leads/${id}/`);
      toast.success("Lead deleted successfully.");
      fetchLeads();
    } catch (err) {
      toast.error("Failed to delete lead.");
    }
  };

  // Export to Excel / CSV
  const handleExport = (format = "xlsx") => {
    if (leads.length === 0) {
      toast.warning("No leads to export.");
      return;
    }
    const exportData = leads.map((l) => ({
      "Company Name": l.company_name,
      "Contact Person": l.contact_person,
      "Designation": l.designation,
      "Mobile Number": l.mobile_number,
      "Email": l.email,
      "Segment": l.segment,
      "Lead Source": l.lead_source,
      "City": l.city,
      "State": l.state,
      "Country": l.country,
      "Assigned Staff": l.assigned_staff?.map((s) => s.name).join(", "),
      "Created Date": l.created_at ? new Date(l.created_at).toLocaleDateString() : "",
    }));

    if (format === "csv") {
      const csvStr = Papa.unparse(exportData);
      const blob = new Blob([csvStr], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Leads_Export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Leads");
      XLSX.writeFile(wb, `Leads_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }
    toast.success(`Exported ${leads.length} leads.`);
  };

  // =========================================================================
  // 7-Step Dynamic Excel / CSV Import Engine
  // =========================================================================

  const handleOpenFileUpload = () => {
    setImportStep(1);
    setImportFile(null);
    setImportFileName("");
    setDetectedHeaders([]);
    setPreviewRows([]);
    setColumnMapping({});
    setDuplicateValidationResult(null);
    setDuplicateResolutions({});
    setImportSummary(null);
    setShowImportModal(true);
  };

  // Step 1 & 2: Read Excel/CSV Headers
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportFileName(file.name);

    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (ext === ".csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (!results.data || results.data.length === 0) {
            toast.error("CSV file contains no rows.");
            return;
          }
          const headers = results.meta.fields || Object.keys(results.data[0]);
          initializeMapping(headers, results.data);
        },
      });
    } else if (ext === ".xlsx" || ext === ".xls") {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: "binary" });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const jsonData = XLSX.utils.sheet_to_json(ws, { defval: "" });
          if (!jsonData || jsonData.length === 0) {
            toast.error("Excel file contains no rows.");
            return;
          }
          const headers = Object.keys(jsonData[0]);
          initializeMapping(headers, jsonData);
        } catch (err) {
          toast.error("Failed to read Excel file.");
        }
      };
      reader.readAsBinaryString(file);
    } else {
      toast.error("Unsupported file format. Please upload .xlsx, .xls, or .csv.");
    }
  };

  // Step 3: Initialize Dynamic Mapping with Smart Suggestions
  const initializeMapping = (headers, rows) => {
    const cleanHeaders = headers.filter((h) => h && !h.startsWith("__EMPTY"));
    setDetectedHeaders(cleanHeaders);
    setPreviewRows(rows);

    const autoMapping = {};
    cleanHeaders.forEach((header) => {
      const hLower = header.trim().toLowerCase();
      // Match against known CRM fields aliases
      let matchedField = "skip";
      for (const field of CRM_FIELDS) {
        if (field.aliases.includes(hLower) || hLower.includes(field.key.replace("_", " "))) {
          matchedField = field.key;
          break;
        }
      }
      autoMapping[header] = matchedField;
    });

    setColumnMapping(autoMapping);
    setImportStep(3); // Advance to Field Mapping Step
  };

  // Step 4 & 5: Run Data Validation & Duplicate Detection
  const handleRunValidationAndDuplicates = async () => {
    // Check that at least one column is mapped to company_name, contact_person, or mobile_number
    const mappedValues = Object.values(columnMapping);
    if (!mappedValues.includes("company_name") && !mappedValues.includes("contact_person") && !mappedValues.includes("mobile_number")) {
      toast.warning("Please map at least Company Name, Contact Person, or Mobile Number.");
      return;
    }

    setImporting(true);
    try {
      const res = await axiosInstance.post(`${BASE_URL}/api/crm/leads/import/validate/`, {
        rows: previewRows,
        column_mapping: columnMapping,
        file_name: importFileName,
      });

      setDuplicateValidationResult(res.data);

      // Default all duplicate resolutions to 'SKIP' or 'UPDATE'
      const initResolutions = {};
      (res.data.exact_duplicates || []).forEach((dup) => {
        initResolutions[String(dup.row_index)] = "UPDATE";
      });
      (res.data.partial_duplicates || []).forEach((dup) => {
        initResolutions[String(dup.row_index)] = "MERGE";
      });
      setDuplicateResolutions(initResolutions);

      setImportStep(5); // Advance to Duplicate Resolution Step
    } catch (err) {
      toast.error(err.response?.data?.error || "Validation failed.");
    } finally {
      setImporting(false);
    }
  };

  // Step 6 & 7: Commit Import & Summary
  const handleCommitImport = async () => {
    setImporting(true);
    try {
      const res = await axiosInstance.post(`${BASE_URL}/api/crm/leads/import/commit/`, {
        rows: previewRows,
        column_mapping: columnMapping,
        resolutions: duplicateResolutions,
        create_unknown_segments: createUnknownSegments,
        file_name: importFileName,
        import_token: duplicateValidationResult?.import_token || "",
      });

      setImportSummary(res.data.summary);
      setImportStep(7); // Show Import Summary
      fetchLeads();
    } catch (err) {
      toast.error(err.response?.data?.error || "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <FaAddressBook className="text-blue-600" />
            Lead Management
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Search, filter, bulk manage leads, and run advanced dynamic Excel/CSV imports with duplicate detection.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleExport("xlsx")}
            className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-100 transition"
          >
            <FaFileExcel />
            Export Excel
          </button>
          <button
            onClick={handleOpenFileUpload}
            className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-100 transition"
          >
            <FaUpload />
            Dynamic Excel Import
          </button>
          <button
            onClick={handleOpenAddLead}
            className="flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition"
          >
            <FaPlus />
            Add Lead
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="sm:col-span-2 relative">
          <FaSearch className="absolute left-3 top-3 text-gray-400 text-xs" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Global search by company, contact, phone, mobile, city, segment..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          value={filterSegment}
          onChange={(e) => setFilterSegment(e.target.value)}
          className="px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
        >
          <option value="">All Segments</option>
          <option value="Unassigned">Unassigned</option>
          {availableSegments.map((s, i) => (
            <option key={i} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={filterStaff}
          onChange={(e) => setFilterStaff(e.target.value)}
          className="px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
        >
          <option value="">All Assignees</option>
          <option value="Unassigned">Unassigned Leads</option>
          {availableStaff.map((st) => (
            <option key={st.id} value={st.id}>{st.name}</option>
          ))}
        </select>
      </div>

      {/* Leads Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-500 flex justify-center items-center gap-2">
            <FaSpinner className="animate-spin text-blue-600" />
            Loading lead records...
          </div>
        ) : leads.length === 0 ? (
          <div className="p-10 text-center text-gray-400 italic">No leads found matching current filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 uppercase tracking-wider font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={selectedLeads.size === leads.length && leads.length > 0}
                      onChange={handleSelectAllOnPage}
                      className="h-4 w-4 text-blue-600 rounded cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-3">Company Name</th>
                  <th className="py-3 px-3">Contact Person</th>
                  <th className="py-3 px-3">Mobile Number</th>
                  <th className="py-3 px-3">Email</th>
                  <th className="py-3 px-3">Segment</th>
                  <th className="py-3 px-3">Assigned Staff</th>
                  <th className="py-3 px-3">City / State</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {leads.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-750 transition">
                    <td className="py-3 px-3">
                      <input
                        type="checkbox"
                        checked={selectedLeads.has(l.id)}
                        onChange={() => toggleSelectLead(l.id)}
                        className="h-4 w-4 text-blue-600 rounded cursor-pointer"
                      />
                    </td>
                    <td className="py-3 px-3 font-bold text-gray-900 dark:text-white">
                      {l.company_name}
                    </td>
                    <td className="py-3 px-3 text-gray-700 dark:text-gray-300">
                      <div>{l.contact_person}</div>
                      {l.designation && <span className="text-2xs text-gray-400">{l.designation}</span>}
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-gray-600 dark:text-gray-300">
                      {l.mobile_number || "—"}
                    </td>
                    <td className="py-3 px-3 text-gray-500 text-xs truncate max-w-[150px]" title={l.email}>
                      {l.email || "—"}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        {l.segment}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {l.assigned_staff && l.assigned_staff.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {l.assigned_staff.map((s, idx) => (
                            <span key={idx} className="px-1.5 py-0.5 rounded text-2xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
                              {s.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs italic">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-gray-500 text-xs">
                      {l.city ? `${l.city}${l.state ? `, ${l.state}` : ""}` : "—"}
                    </td>
                    <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenEditLead(l)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-700 rounded transition"
                        title="Edit Lead"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => handleDeleteLead(l.id, l.company_name)}
                        className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-gray-700 rounded transition"
                        title="Delete Lead"
                      >
                        <FaTrash />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500">
          <div>
            Showing <strong>{leads.length}</strong> of <strong>{total}</strong> leads
          </div>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-3 py-1 font-semibold text-gray-700 dark:text-gray-300">
              Page {page} of {numPages}
            </span>
            <button
              disabled={page >= numPages}
              onClick={() => setPage((p) => Math.min(numPages, p + 1))}
              className="px-3 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================================
          MODAL: 7-Step Advanced Dynamic Excel / CSV Import Wizard
      ===================================================================== */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl border border-gray-200 dark:border-gray-700 overflow-hidden my-auto max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900 flex-shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <FaUpload className="text-indigo-600" />
                  Dynamic Excel / CSV Lead Importer
                </h3>
                <span className="text-xs text-gray-500">Step {importStep} of 7: {
                  importStep === 1 ? "Upload File" :
                  importStep === 3 ? "Dynamic Field Mapping" :
                  importStep === 5 ? "Duplicate Detection & Side-by-Side Comparison" :
                  "Import Summary Report"
                }</span>
              </div>
              <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                <FaTimes />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs sm:text-sm">
              {/* STEP 1: Upload File */}
              {importStep === 1 && (
                <div className="space-y-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl p-10 text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition"
                  >
                    <FaUpload className="mx-auto text-4xl text-indigo-500 mb-3" />
                    <span className="font-bold text-gray-800 dark:text-gray-200 block text-base">
                      Click to choose an Excel or CSV file
                    </span>
                    <span className="text-xs text-gray-500 block mt-1">
                      Supports .xlsx, .xls, and .csv with any custom column names and order
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                </div>
              )}

              {/* STEP 3: Dynamic Field Mapping (Excel Header | CRM Database Field) */}
              {importStep === 3 && (
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 text-xs flex items-center gap-2">
                    <FaInfoCircle className="text-blue-600" />
                    <span>
                      Headers automatically detected from <strong>{importFileName}</strong> ({previewRows.length} rows found). Map your file columns to CRM fields below.
                    </span>
                  </div>

                  <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 font-bold uppercase text-gray-600 dark:text-gray-300">
                        <tr>
                          <th className="py-2.5 px-3">Excel Header</th>
                          <th className="py-2.5 px-3">Sample Value</th>
                          <th className="py-2.5 px-3">CRM Database Field</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {detectedHeaders.map((header) => {
                          const sampleVal = previewRows[0]?.[header] || "—";
                          return (
                            <tr key={header} className="hover:bg-gray-50/50 dark:hover:bg-gray-750">
                              <td className="py-2.5 px-3 font-bold text-gray-800 dark:text-gray-200">
                                {header}
                              </td>
                              <td className="py-2.5 px-3 text-gray-500 truncate max-w-xs" title={sampleVal}>
                                {sampleVal}
                              </td>
                              <td className="py-2.5 px-3">
                                <select
                                  value={columnMapping[header] || "skip"}
                                  onChange={(e) =>
                                    setColumnMapping({ ...columnMapping, [header]: e.target.value })
                                  }
                                  className="w-full px-2.5 py-1 text-xs bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                                >
                                  <option value="skip">-- Ignore / Skip Column --</option>
                                  {CRM_FIELDS.map((f) => (
                                    <option key={f.key} value={f.key}>
                                      {f.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* STEP 5: Duplicate Detection & Side-by-Side Comparison */}
              {importStep === 5 && duplicateValidationResult && (
                <div className="space-y-4">
                  {/* Summary pills */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl border border-emerald-200 dark:border-emerald-800">
                      <span className="text-2xs font-bold uppercase text-emerald-700 dark:text-emerald-300">New Records</span>
                      <div className="text-xl font-extrabold text-emerald-800 dark:text-emerald-200 mt-0.5">
                        {duplicateValidationResult.new_records_count || 0}
                      </div>
                    </div>
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-xl border border-amber-200 dark:border-amber-800">
                      <span className="text-2xs font-bold uppercase text-amber-700 dark:text-amber-300">Exact Matches</span>
                      <div className="text-xl font-extrabold text-amber-800 dark:text-amber-200 mt-0.5">
                        {duplicateValidationResult.exact_duplicates_count || 0}
                      </div>
                    </div>
                    <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-xl border border-purple-200 dark:border-purple-800">
                      <span className="text-2xs font-bold uppercase text-purple-700 dark:text-purple-300">Partial Matches</span>
                      <div className="text-xl font-extrabold text-purple-800 dark:text-purple-200 mt-0.5">
                        {duplicateValidationResult.partial_duplicates_count || 0}
                      </div>
                    </div>
                  </div>

                  {/* Auto-create unknown segments checkbox */}
                  {duplicateValidationResult.detected_segments?.some(s => !s.exists) && (
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-indigo-900 dark:text-indigo-200 block text-xs">
                          Unknown Segments Found in File
                        </span>
                        <span className="text-gray-500 text-2xs">
                          Segments: {duplicateValidationResult.detected_segments.filter(s => !s.exists).map(s => s.name).join(", ")}
                        </span>
                      </div>
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold">
                        <input
                          type="checkbox"
                          checked={createUnknownSegments}
                          onChange={(e) => setCreateUnknownSegments(e.target.checked)}
                          className="h-4 w-4 text-indigo-600 rounded"
                        />
                        Auto-create segments
                      </label>
                    </div>
                  )}

                  {/* Side-by-side Duplicate Resolution Table */}
                  {duplicateValidationResult.exact_duplicates?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-bold text-gray-800 dark:text-gray-200 text-xs uppercase tracking-wider">
                        Exact Duplicate Matches (Side-by-Side Review)
                      </h4>
                      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 font-bold text-gray-600 dark:text-gray-300">
                            <tr>
                              <th className="py-2 px-3">Uploaded Value</th>
                              <th className="py-2 px-3">Existing DB Value</th>
                              <th className="py-2 px-3 text-right">Resolution Choice</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {duplicateValidationResult.exact_duplicates.map((dup) => (
                              <tr key={dup.row_index} className="hover:bg-gray-50/50">
                                <td className="py-2 px-3">
                                  <div className="font-bold text-gray-800 dark:text-gray-200">{dup.uploaded.company_name || "—"}</div>
                                  <div className="text-gray-500 text-2xs">{dup.uploaded.phone || dup.uploaded.email}</div>
                                </td>
                                <td className="py-2 px-3">
                                  <div className="font-bold text-gray-800 dark:text-gray-200">{dup.existing.company_name}</div>
                                  <div className="text-gray-500 text-2xs">{dup.existing.phone || dup.existing.email}</div>
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <select
                                    value={duplicateResolutions[String(dup.row_index)] || "SKIP"}
                                    onChange={(e) =>
                                      setDuplicateResolutions({
                                        ...duplicateResolutions,
                                        [String(dup.row_index)]: e.target.value,
                                      })
                                    }
                                    className="px-2 py-1 text-xs bg-white dark:bg-gray-900 border border-gray-300 rounded font-semibold text-gray-800 dark:text-gray-200"
                                  >
                                    <option value="SKIP">Skip Record</option>
                                    <option value="UPDATE">Update Existing Record</option>
                                    <option value="MERGE">Merge Fields</option>
                                    <option value="NEW">Import as New Record</option>
                                  </select>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 7: Import Summary Report */}
              {importStep === 7 && importSummary && (
                <div className="space-y-6 text-center py-4">
                  <div className="inline-flex p-4 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300 mb-2">
                    <FaCheckCircle className="text-4xl" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Import Completed Successfully!</h3>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto">
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl border border-emerald-200">
                      <span className="text-2xs font-bold uppercase text-emerald-700">New Leads</span>
                      <div className="text-2xl font-black text-emerald-800 dark:text-emerald-200 mt-1">{importSummary.new_records}</div>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl border border-blue-200">
                      <span className="text-2xs font-bold uppercase text-blue-700">Updated</span>
                      <div className="text-2xl font-black text-blue-800 dark:text-blue-200 mt-1">{importSummary.updated_records}</div>
                    </div>
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-xl border border-amber-200">
                      <span className="text-2xs font-bold uppercase text-amber-700">Skipped</span>
                      <div className="text-2xl font-black text-amber-800 dark:text-amber-200 mt-1">{importSummary.skipped_records}</div>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200">
                      <span className="text-2xs font-bold uppercase text-gray-600">Total File</span>
                      <div className="text-2xl font-black text-gray-800 dark:text-gray-200 mt-1">{importSummary.total_uploaded}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
              {importStep === 3 ? (
                <button
                  onClick={() => setImportStep(1)}
                  className="px-4 py-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 rounded-lg"
                >
                  Back to File
                </button>
              ) : importStep === 5 ? (
                <button
                  onClick={() => setImportStep(3)}
                  className="px-4 py-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 rounded-lg"
                >
                  Back to Mapping
                </button>
              ) : <div />}

              <div className="flex gap-2">
                {importStep !== 7 ? (
                  <button
                    onClick={() => setShowImportModal(false)}
                    className="px-4 py-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 rounded-lg"
                  >
                    Cancel
                  </button>
                ) : null}

                {importStep === 3 && (
                  <button
                    onClick={handleRunValidationAndDuplicates}
                    disabled={importing}
                    className="px-5 py-2 text-xs sm:text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50"
                  >
                    {importing ? "Validating..." : "Validate & Check Duplicates →"}
                  </button>
                )}

                {importStep === 5 && (
                  <button
                    onClick={handleCommitImport}
                    disabled={importing}
                    className="px-6 py-2 text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm disabled:opacity-50"
                  >
                    {importing ? "Importing Leads..." : "Commit Import →"}
                  </button>
                )}

                {importStep === 7 && (
                  <button
                    onClick={() => setShowImportModal(false)}
                    className="px-6 py-2 text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                  >
                    Done & Refresh Leads
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add / Edit Single Lead */}
      {showLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-xl border border-gray-200 dark:border-gray-700 overflow-hidden my-auto max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900 flex-shrink-0">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                {editingLead ? "Edit Lead Profile" : "Add New Lead"}
              </h3>
              <button onClick={() => setShowLeadModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSaveLead} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Company Name</label>
                  <input
                    type="text"
                    required
                    value={leadFormData.company_name}
                    onChange={(e) => setLeadFormData({ ...leadFormData, company_name: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">First Name</label>
                  <input
                    type="text"
                    value={leadFormData.first_name}
                    onChange={(e) => setLeadFormData({ ...leadFormData, first_name: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={leadFormData.last_name}
                    onChange={(e) => setLeadFormData({ ...leadFormData, last_name: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Mobile Number</label>
                  <input
                    type="text"
                    value={leadFormData.mobile_number}
                    onChange={(e) => setLeadFormData({ ...leadFormData, mobile_number: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Alternate Mobile</label>
                  <input
                    type="text"
                    value={leadFormData.alternate_mobile}
                    onChange={(e) => setLeadFormData({ ...leadFormData, alternate_mobile: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={leadFormData.email}
                    onChange={(e) => setLeadFormData({ ...leadFormData, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Designation</label>
                  <input
                    type="text"
                    value={leadFormData.designation}
                    onChange={(e) => setLeadFormData({ ...leadFormData, designation: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Segment</label>
                  <select
                    value={leadFormData.segment}
                    onChange={(e) => setLeadFormData({ ...leadFormData, segment: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  >
                    <option value="Unassigned">Unassigned</option>
                    {availableSegments.map((s, i) => (
                      <option key={i} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">City</label>
                  <input
                    type="text"
                    value={leadFormData.city}
                    onChange={(e) => setLeadFormData({ ...leadFormData, city: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea
                  rows="3"
                  value={leadFormData.notes}
                  onChange={(e) => setLeadFormData({ ...leadFormData, notes: e.target.value })}
                  placeholder="Key discussion points or customer background..."
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowLeadModal(false)}
                  className="px-4 py-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingLead}
                  className="px-5 py-2 text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                >
                  {savingLead ? "Saving..." : editingLead ? "Save Changes" : "Create Lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

