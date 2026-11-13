import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import {
  FaUserTag, FaUsers, FaUserCheck, FaSearch, FaFilter,
  FaCheck, FaTimes, FaSpinner, FaLayerGroup, FaBuilding,
  FaPhone, FaTrashAlt
} from "react-icons/fa";
import BASE_URL from "../config";
import axiosInstance from "../axiosconfig";

export default function CRMLeadAssignment({ user }) {
  const [leads, setLeads] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [segmentFilter, setSegmentFilter] = useState("");
  const [staffFilter, setStaffFilter] = useState("");

  // Selections
  const [selectedLeads, setSelectedLeads] = useState(new Set());
  const [selectedStaff, setSelectedStaff] = useState(new Set());
  const [assigning, setAssigning] = useState(false);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`${BASE_URL}/api/crm/assignments/`, {
        params: {
          search,
          segment: segmentFilter,
          staff_id: staffFilter,
          page,
          page_size: 25,
        },
      });
      setLeads(res.data.leads || []);
      setTotal(res.data.total || 0);
      setNumPages(res.data.num_pages || 1);
      setStaffList(res.data.staff_list || []);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to load assignment data.");
    } finally {
      setLoading(false);
    }
  }, [search, segmentFilter, staffFilter, page]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const toggleLead = (id) => {
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

  const toggleStaff = (id) => {
    const next = new Set(selectedStaff);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedStaff(next);
  };

  const handleExecuteAssignment = async () => {
    if (selectedLeads.size === 0) {
      toast.warning("Please select at least one lead to assign.");
      return;
    }
    if (selectedStaff.size === 0) {
      toast.warning("Please select at least one staff member.");
      return;
    }

    setAssigning(true);
    try {
      const res = await axiosInstance.post(`${BASE_URL}/api/crm/assignments/assign/`, {
        lead_ids: Array.from(selectedLeads),
        staff_ids: Array.from(selectedStaff),
      });
      toast.success(res.data.message || "Assignment completed.");
      setSelectedLeads(new Set());
      setSelectedStaff(new Set());
      fetchAssignments();
    } catch (err) {
      toast.error(err.response?.data?.error || "Assignment failed.");
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassignUser = async (leadId, userId) => {
    if (!window.confirm("Remove this staff assignment?")) return;
    try {
      await axiosInstance.post(`${BASE_URL}/api/crm/assignments/unassign/`, {
        lead_id: leadId,
        user_id: userId,
      });
      toast.success("Staff unassigned successfully.");
      fetchAssignments();
    } catch (err) {
      toast.error("Failed to unassign staff.");
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <FaUserTag className="text-blue-600" />
            Lead Assignment
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Assign individual or bulk leads to single or multiple staff members with dedicated assignment tracking.
          </p>
        </div>
      </div>

      {/* Assignment Control Box */}
      <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-gray-700">
          <div className="text-xs sm:text-sm">
            <span className="font-bold text-gray-900 dark:text-white block">Bulk Assignment Panel</span>
            <span className="text-gray-500 text-xs">
              Selected <strong>{selectedLeads.size}</strong> leads and <strong>{selectedStaff.size}</strong> staff members.
            </span>
          </div>

          <button
            onClick={handleExecuteAssignment}
            disabled={assigning || selectedLeads.size === 0 || selectedStaff.size === 0}
            className="flex items-center justify-center gap-2 px-6 py-2.5 text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs disabled:opacity-50 transition"
          >
            {assigning ? (
              <>
                <FaSpinner className="animate-spin" /> Assigning...
              </>
            ) : (
              <>
                <FaUserCheck /> Execute Assignment ({selectedLeads.size} leads → {selectedStaff.size} staff)
              </>
            )}
          </button>
        </div>

        {/* Staff Checkbox Selector */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
            Select Staff Members to Receive Selected Leads:
          </label>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
            {staffList.map((st) => {
              const isChecked = selectedStaff.has(st.id);
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => toggleStaff(st.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 ${isChecked
                    ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                    : "bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-400"
                    }`}
                >
                  {isChecked && <FaCheck className="text-[10px]" />}
                  <span>{st.name}</span>
                  {st.role && <span className="text-[10px] opacity-75">({st.role})</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <FaSearch className="absolute left-3 top-3 text-gray-400 text-xs" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads by company, contact, phone..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={segmentFilter}
          onChange={(e) => setSegmentFilter(e.target.value)}
          className="px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
        >
          <option value="">All Segments</option>
          <option value="Unassigned">Unassigned</option>
        </select>
        <select
          value={staffFilter}
          onChange={(e) => setStaffFilter(e.target.value)}
          className="px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
        >
          <option value="">Filter by Current Assignee</option>
          {staffList.map((st) => (
            <option key={st.id} value={st.id}>{st.name}</option>
          ))}
        </select>
      </div>

      {/* Leads Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-500 flex justify-center items-center gap-2">
            <FaSpinner className="animate-spin text-blue-600" />
            Loading assignment leads...
          </div>
        ) : leads.length === 0 ? (
          <div className="p-10 text-center text-gray-400 italic">No leads found.</div>
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
                  <th className="py-3 px-3">Contact Number</th>
                  <th className="py-3 px-3">Segment</th>
                  <th className="py-3 px-3">Currently Assigned Staff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {leads.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-750 transition">
                    <td className="py-3 px-3">
                      <input
                        type="checkbox"
                        checked={selectedLeads.has(l.id)}
                        onChange={() => toggleLead(l.id)}
                        className="h-4 w-4 text-blue-600 rounded cursor-pointer"
                      />
                    </td>
                    <td className="py-3 px-3 font-bold text-gray-900 dark:text-white">
                      {l.company_name || "—"}
                    </td>
                    <td className="py-3 px-3 text-gray-700 dark:text-gray-300">
                      {l.contact_person}
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-gray-600 dark:text-gray-300">
                      {l.contact_number || "—"}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        {l.segment}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {l.assigned_staff && l.assigned_staff.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {l.assigned_staff.map((st) => (
                            <span
                              key={st.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-2xs font-bold bg-blue-50 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                            >
                              <span>{st.name}</span>
                              <button
                                type="button"
                                onClick={() => handleUnassignUser(l.id, st.id)}
                                className="text-gray-400 hover:text-red-500 ml-0.5"
                                title={`Unassign ${st.name}`}
                              >
                                <FaTimes className="text-[9px]" />
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Unassigned</span>
                      )}
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
    </div>
  );
}

