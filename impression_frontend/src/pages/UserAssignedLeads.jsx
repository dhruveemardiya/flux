import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import {
  FaUserFriends,
  FaSearch,
  FaSyncAlt,
  FaEye,
  FaPhone,
  FaEnvelope,
  FaMapMarkerAlt,
  FaBuilding,
  FaUserCheck,
  FaTimes,
  FaFileExcel,
  FaSave,
  FaClock
} from "react-icons/fa";
import BASE_URL from "./config";
import axiosInstance from "./axiosconfig";

export default function UserAssignedLeads({ user: propUser }) {
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
  const [filterOptions, setFilterOptions] = useState({
    cities: [],
    statuses: ["Lead", "HostLead", "Converted"],
    segments: []
  });

  // Modal State
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeLead, setActiveLead] = useState(null);
  const [editingNotes, setEditingNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // Fetch Current User if not passed
  useEffect(() => {
    if (!currentUser) {
      const fetchUser = async () => {
        try {
          const res = await axiosInstance.get(`${BASE_URL}/api/users/me/`);
          setCurrentUser(res.data);
        } catch (err) {
          console.error("Failed to load user info in assigned leads", err);
        }
      };
      fetchUser();
    }
  }, [currentUser]);

  // Fetch Filter Options & Dynamic Counts
  const fetchFilterOptions = async () => {
    try {
      const res = await axiosInstance.get(`${BASE_URL}/api/leads/filters/`);
      setFilterOptions({
        cities: res.data.cities || [],
        statuses: res.data.statuses || ["Lead", "HostLead", "Converted"],
        segments: res.data.segments || res.data.counts?.segments || []
      });
      if (res.data.counts) {
        setCounts(res.data.counts);
      }
    } catch (err) {
      console.error("Failed to fetch lead filter options", err);
    }
  };

  // Fetch Leads (Strictly filtered by backend for assigned user)
  const fetchLeads = async (pageNumber = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("page", pageNumber);
      params.append("page_size", pageSize);

      if (searchTerm.trim()) params.append("search", searchTerm.trim());
      if (selectedStatus && selectedStatus !== "all") params.append("status", selectedStatus);
      if (selectedSegment && selectedSegment !== "all") params.append("segment", selectedSegment);
      if (selectedCity) params.append("city", selectedCity);

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
      }
    } catch (err) {
      console.error("Error fetching assigned leads:", err);
      toast.error("Failed to load assigned leads.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchFilterOptions();
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      const timer = setTimeout(() => {
        fetchLeads(1);
      }, 300);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, searchTerm, selectedStatus, selectedSegment, selectedCity, pageSize]);

  // Quick Status change for regular user
  const handleQuickStatusChange = async (leadId, newStatus) => {
    try {
      const res = await axiosInstance.post(`${BASE_URL}/api/leads/${leadId}/status/`, {
        status: newStatus,
        notes: `Status updated to ${newStatus}`
      });

      toast.success(res.data.message || `Status updated to ${newStatus}`);

      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId
            ? {
                ...l,
                status: res.data.status || newStatus,
                status_updated_by: res.data.status_updated_by,
                status_updated_by_name: res.data.status_updated_by_name
              }
            : l
        )
      );

      fetchFilterOptions();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update lead status.");
    }
  };

  // Open Details Modal
  const handleOpenDetail = (lead) => {
    setActiveLead(lead);
    setEditingNotes(lead.notes || "");
    setShowDetailModal(true);
  };

  // Save updated notes
  const handleSaveNotes = async () => {
    if (!activeLead) return;
    setSavingNotes(true);
    try {
      const res = await axiosInstance.patch(`${BASE_URL}/api/leads/${activeLead.id}/`, {
        notes: editingNotes
      });
      toast.success("Notes saved successfully!");
      setActiveLead(res.data.lead);
      setLeads((prev) => prev.map((l) => (l.id === activeLead.id ? res.data.lead : l)));
    } catch (err) {
      toast.error("Failed to update notes.");
    } finally {
      setSavingNotes(false);
    }
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedStatus("all");
    setSelectedSegment("all");
    setSelectedCity("");
    setPage(1);
  };

  return (
    <div className="w-full max-w-full min-w-0 p-3 sm:p-4 md:p-5 bg-white dark:bg-gray-900 shadow-lg rounded-xl">
      {/* Compact Page Heading (Matching Admin lead page) */}
      <div className="flex items-center justify-between mb-2.5 sm:mb-3">
        <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white tracking-tight">
          Lead Generation
        </h2>
      </div>

      {/* Compact Single-Row Toolbar & Filters (Matching Admin Lead page) */}
      <div className="mb-3.5">
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-1.5 sm:gap-2 w-full">
          
          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchLeads(page)}
            className="h-8 w-8 sm:h-8.5 sm:w-8.5 bg-white hover:bg-gray-100 active:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md shadow-xs flex items-center justify-center transition hover:shadow focus:outline-none focus:ring-1 focus:ring-blue-500 shrink-0"
            title="Refresh"
            aria-label="Refresh"
          >
            <FaSyncAlt className={`text-xs sm:text-sm ${loading ? "animate-spin" : ""}`} />
          </button>

          {/* Status Filter Tabs */}
          {[
            { key: "all", label: "All Leads", count: counts.all },
            { key: "Lead", label: "Lead", count: counts.lead },
            { key: "HostLead", label: "HostLead", count: counts.hostlead },
            { key: "Converted", label: "Converted", count: counts.converted },
          ].map((tab) => {
            const isActive = selectedStatus === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setSelectedStatus(tab.key);
                  setPage(1);
                }}
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

          {/* City Filter Dropdown */}
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

          {/* Segment Filter Dropdown */}
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

          {/* Reset Filters */}
          {(searchTerm || selectedCity || selectedStatus !== "all" || selectedSegment !== "all") && (
            <button
              type="button"
              onClick={handleResetFilters}
              title="Reset Filters"
              className="h-8 sm:h-8.5 px-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md text-xs font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition shrink-0"
            >
              Reset
            </button>
          )}

          {/* Search Input on the far right */}
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

      {/* Horizontally Scrollable Table Container (Exact Admin Lead Styling) */}
      <div className="w-full max-w-full overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800">
        <table className="w-full text-xs sm:text-sm text-left text-gray-600 dark:text-gray-300">
          <thead className="bg-gray-50 dark:bg-gray-700/60 text-gray-700 dark:text-gray-200 font-semibold border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-3 sm:px-4 py-3 min-w-[160px]">Company</th>
              <th className="px-3 sm:px-4 py-3 min-w-[160px]">Contact Person</th>
              <th className="px-3 sm:px-4 py-3 whitespace-nowrap min-w-[125px]">Phone / Mobile</th>
              <th className="px-3 sm:px-4 py-3 whitespace-nowrap min-w-[105px]">City</th>
              <th className="px-3 sm:px-4 py-3 whitespace-nowrap min-w-[120px]">Status</th>
              <th className="px-3 sm:px-4 py-3 whitespace-nowrap min-w-[140px]">Assigned By</th>
              <th className="px-3 sm:px-4 py-3 whitespace-nowrap min-w-[100px]">Created</th>
              <th className="px-3 sm:px-4 py-3 text-center whitespace-nowrap min-w-[90px]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan="8" className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <div className="flex items-center justify-center gap-2">
                    <FaSyncAlt className="animate-spin text-blue-500" />
                    <span>Loading leads...</span>
                  </div>
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan="8" className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No assigned leads found.
                </td>
              </tr>
            ) : (
              leads.map((lead) => {
                const displayPhone = (lead.phone && lead.phone !== "0") ? lead.phone : ((lead.mobile && lead.mobile !== "0") ? lead.mobile : "");
                return (
                  <tr key={lead.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/60 transition">
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
                      <select
                        value={lead.status || "Lead"}
                        onChange={(e) => handleQuickStatusChange(lead.id, e.target.value)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full border cursor-pointer focus:outline-none transition ${
                          lead.status === "Converted"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/60 dark:text-emerald-200 dark:border-emerald-700"
                            : lead.status === "HostLead"
                            ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/60 dark:text-amber-200 dark:border-amber-700"
                            : "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/60 dark:text-sky-200 dark:border-sky-700"
                        }`}
                      >
                        <option value="Lead">Lead</option>
                        <option value="HostLead">HostLead</option>
                        <option value="Converted">Converted</option>
                      </select>
                    </td>
                    <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200"
                        title={lead.assigned_by_name || "Admin"}
                      >
                        <FaUserCheck className="text-[11px]" />
                        {lead.assigned_by_name || "Admin"}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                      {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-center">
                      <button
                        onClick={() => handleOpenDetail(lead)}
                        className="text-blue-600 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300 p-1 transition text-base"
                        title="View Details"
                      >
                        <FaEye />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination (Exact Admin Lead Styling) */}
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

      {/* ================= MODAL: LEAD DETAIL (Exact Admin Lead Modal Styling) ================= */}
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
                <button
                  onClick={() => setShowDetailModal(false)}
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
                    <span className="text-2xs text-gray-400 block">Phones</span>
                    <div className="font-mono text-xs text-gray-800 dark:text-gray-200">
                      {activeLead.phone && <div>📞 {activeLead.phone}</div>}
                      {activeLead.mobile && <div>📱 {activeLead.mobile}</div>}
                      {!activeLead.phone && !activeLead.mobile && "—"}
                    </div>
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
                      {[activeLead.city, activeLead.state].filter(Boolean).join(", ") || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-2xs text-gray-400 block">Country & ZIP</span>
                    <span className="text-gray-800 dark:text-gray-200">
                      {[activeLead.country, activeLead.pincode].filter(Boolean).join(" - ") || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-2xs text-gray-400 block">Street Address</span>
                    <span className="text-gray-700 dark:text-gray-300 text-xs">
                      {[activeLead.address_line1, activeLead.address_line2].filter(Boolean).join(", ") || "—"}
                    </span>
                  </div>
                </div>

                {/* Assignment & Status Meta */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                    <FaClock className="text-purple-500" /> Lead Status & Assignment
                  </h4>
                  <div>
                    <span className="text-2xs text-gray-400 block">Current Status</span>
                    <div className="mt-1">
                      <select
                        value={activeLead.status || "Lead"}
                        onChange={async (e) => {
                          const newStatus = e.target.value;
                          await handleQuickStatusChange(activeLead.id, newStatus);
                          setActiveLead((prev) => ({ ...prev, status: newStatus }));
                        }}
                        className="text-xs font-semibold px-2.5 py-1 rounded-full border cursor-pointer focus:outline-none"
                      >
                        <option value="Lead">Lead</option>
                        <option value="HostLead">HostLead</option>
                        <option value="Converted">Converted</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <span className="text-2xs text-gray-400 block">Assigned By</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {activeLead.assigned_by_name || "Admin"}
                    </span>
                  </div>
                  <div>
                    <span className="text-2xs text-gray-400 block">Assigned Date</span>
                    <span className="text-gray-700 dark:text-gray-300 text-xs">
                      {activeLead.assigned_at ? new Date(activeLead.assigned_at).toLocaleString() : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Follow-up Notes Section */}
              <div className="p-4 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
                  Follow-up Notes / Activity Logs
                </label>
                <textarea
                  rows={3}
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                  placeholder="Add notes from your interaction with this client..."
                  className="w-full p-2.5 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition"
                  >
                    <FaSave /> {savingNotes ? "Saving..." : "Save Notes"}
                  </button>
                </div>
              </div>

              {/* Extra Attributes from Uploaded Excel */}
              {activeLead.extra_attributes && Object.keys(activeLead.extra_attributes).length > 0 && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <FaFileExcel className="text-emerald-500" />
                      Additional Excel Data Columns ({Object.keys(activeLead.extra_attributes).length})
                    </h4>
                  </div>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto">
                    {Object.entries(activeLead.extra_attributes).map(([k, v]) => (
                      <div key={k} className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800">
                        <span className="font-semibold text-2xs text-gray-500 dark:text-gray-400 block truncate" title={k}>
                          {k}
                        </span>
                        <span className="text-xs text-gray-800 dark:text-gray-200 font-medium block truncate mt-0.5" title={String(v || "")}>
                          {String(v || "—")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="flex justify-end px-4 sm:px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
