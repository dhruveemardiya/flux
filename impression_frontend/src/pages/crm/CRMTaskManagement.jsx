import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import {
  FaTasks, FaPlus, FaSearch, FaCalendarAlt, FaClock,
  FaPaperclip, FaUsers, FaUserCheck, FaCheck, FaTimes,
  FaSpinner, FaFilter, FaLayerGroup, FaExclamationCircle,
  FaEdit, FaTrashAlt
} from "react-icons/fa";
import BASE_URL from "../config";
import axiosInstance from "../axiosconfig";

export default function CRMTaskManagement({ user }) {
  const [taskGroups, setTaskGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  // Modal State (Create & Edit)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTaskGroup, setEditingTaskGroup] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [availableLeads, setAvailableLeads] = useState([]);
  const [segmentsList, setSegmentsList] = useState([]);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [taskStatus, setTaskStatus] = useState("Active");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [endTime, setEndTime] = useState("18:00");
  const [selectedStaffIds, setSelectedStaffIds] = useState(new Set());
  const [associateLeads, setAssociateLeads] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState(new Set());
  const [leadSegmentFilter, setLeadSegmentFilter] = useState("");
  const [leadSearchTerm, setLeadSearchTerm] = useState("");
  const [creating, setCreating] = useState(false);

  // Delete State
  const [deletingTaskGroup, setDeletingTaskGroup] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const fetchTaskGroups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`${BASE_URL}/api/crm/task-groups/`, {
        params: { search, status: statusFilter, priority: priorityFilter },
      });
      setTaskGroups(res.data.task_groups || []);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to load task groups.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, priorityFilter]);

  const fetchStaffAndLeads = async () => {
    try {
      const [staffRes, leadsRes, segRes] = await Promise.all([
        axiosInstance.get(`${BASE_URL}/api/crm/users/`),
        axiosInstance.get(`${BASE_URL}/api/crm/leads/?page_size=100`),
        axiosInstance.get(`${BASE_URL}/api/crm/segments/`),
      ]);
      setStaffList(staffRes.data.users || []);
      setAvailableLeads(leadsRes.data.leads || []);
      setSegmentsList(segRes.data.segments || []);
    } catch (err) {
      // silent
    }
  };

  useEffect(() => {
    fetchTaskGroups();
  }, [fetchTaskGroups]);

  const handleOpenCreate = () => {
    fetchStaffAndLeads();
    setEditingTaskGroup(null);
    setTitle("");
    setDescription("");
    setPriority("Normal");
    setTaskStatus("Active");
    setStartDate(new Date().toISOString().slice(0, 10));
    setStartTime("09:00");
    setEndDate(new Date().toISOString().slice(0, 10));
    setEndTime("18:00");
    setSelectedStaffIds(new Set());
    setAssociateLeads(false);
    setSelectedLeadIds(new Set());
    setShowCreateModal(true);
  };

  const handleOpenEdit = (tg) => {
    fetchStaffAndLeads();
    setEditingTaskGroup(tg);
    setTitle(tg.title || "");
    setDescription(tg.description || "");
    setPriority(tg.priority || "Normal");
    setTaskStatus(tg.status || "Active");
    setStartDate(tg.start_date || new Date().toISOString().slice(0, 10));
    setStartTime(tg.start_time || "09:00");
    setEndDate(tg.end_date || new Date().toISOString().slice(0, 10));
    setEndTime(tg.end_time || "18:00");
    setSelectedStaffIds(new Set(tg.staff_ids || tg.assignees?.map((a) => a.id) || []));
    const leadIds = new Set(tg.lead_ids || []);
    setSelectedLeadIds(leadIds);
    setAssociateLeads(leadIds.size > 0);
    setShowCreateModal(true);
  };

  const handleOpenDelete = (tg) => {
    setDeletingTaskGroup(tg);
  };

  const handleConfirmDelete = async () => {
    if (!deletingTaskGroup) return;
    setDeleteSubmitting(true);
    try {
      const res = await axiosInstance.delete(
        `${BASE_URL}/api/crm/task-groups/${deletingTaskGroup.id}/`
      );
      toast.success(res.data.message || "Task group deleted successfully.");
      setDeletingTaskGroup(null);
      fetchTaskGroups();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete task group.");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const toggleStaff = (id) => {
    const next = new Set(selectedStaffIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedStaffIds(next);
  };

  const toggleLead = (id) => {
    const next = new Set(selectedLeadIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedLeadIds(next);
  };

  const filteredAvailableLeads = availableLeads.filter((l) => {
    if (leadSegmentFilter && l.segment?.toLowerCase() !== leadSegmentFilter.toLowerCase()) return false;
    if (leadSearchTerm) {
      const q = leadSearchTerm.toLowerCase();
      const match =
        (l.company_name && l.company_name.toLowerCase().includes(q)) ||
        (l.contact_person && l.contact_person.toLowerCase().includes(q)) ||
        (l.mobile_number && l.mobile_number.includes(q));
      if (!match) return false;
    }
    return true;
  });

  const handleSelectAllFilteredLeads = () => {
    const next = new Set(selectedLeadIds);
    filteredAvailableLeads.forEach((l) => next.add(l.id));
    setSelectedLeadIds(next);
  };

  const handleSubmitTaskGroup = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.warning("Task title is required.");
      return;
    }
    if (selectedStaffIds.size === 0) {
      toast.warning("Please assign at least one staff member.");
      return;
    }

    setCreating(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        priority,
        status: taskStatus,
        start_date: startDate,
        start_time: startTime || null,
        end_date: endDate,
        end_time: endTime || null,
        staff_ids: Array.from(selectedStaffIds),
        lead_ids: associateLeads ? Array.from(selectedLeadIds) : [],
      };

      if (editingTaskGroup) {
        const res = await axiosInstance.put(
          `${BASE_URL}/api/crm/task-groups/${editingTaskGroup.id}/`,
          payload
        );
        toast.success(res.data.message || "Task group updated successfully.");
      } else {
        const res = await axiosInstance.post(`${BASE_URL}/api/crm/task-groups/`, payload);
        toast.success(res.data.message || "Task group created successfully.");
      }

      setShowCreateModal(false);
      setEditingTaskGroup(null);
      fetchTaskGroups();
    } catch (err) {
      toast.error(
        err.response?.data?.error ||
        `Failed to ${editingTaskGroup ? "update" : "create"} task group.`
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <FaTasks className="text-blue-600" />
            Task Management
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Create task groups, assign staff teams, associate leads, and auto-generate independent lead activities.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition"
        >
          <FaPlus />
          Create Task Group
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <FaSearch className="absolute left-3 top-3 text-gray-400 text-xs" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search task groups by title, description..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
        >
          <option value="">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Scheduled">Scheduled</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
        >
          <option value="">All Priorities</option>
          <option value="Low">Low</option>
          <option value="Normal">Normal</option>
          <option value="High">High</option>
          <option value="Urgent">Urgent</option>
        </select>
      </div>

      {/* Task Groups Grid / Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-500 flex justify-center items-center gap-2">
            <FaSpinner className="animate-spin text-blue-600" />
            Loading task groups...
          </div>
        ) : taskGroups.length === 0 ? (
          <div className="p-10 text-center text-gray-400 italic">No task groups found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 uppercase tracking-wider font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-4">Task Group Title</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Date Range</th>
                  <th className="py-3 px-4">Assigned Staff</th>
                  <th className="py-3 px-4 text-center">Associated Leads</th>
                  <th className="py-3 px-4">Activities Progress</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {taskGroups.map((tg) => (
                  <tr key={tg.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-750 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-900 dark:text-white">{tg.title}</div>
                      {tg.description && (
                        <div className="text-gray-500 text-xs truncate max-w-xs">{tg.description}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-2xs font-bold ${tg.priority === "Urgent" ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" :
                          tg.priority === "High" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" :
                            "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                        }`}>
                        {tg.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300 text-xs">
                      <div>{tg.start_date} → {tg.end_date}</div>
                      {tg.start_time && (
                        <div className="text-2xs text-gray-400">{tg.start_time} - {tg.end_time || ""}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {tg.assignees?.map((a) => (
                          <span key={a.id} className="px-1.5 py-0.5 rounded text-2xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                            {a.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-gray-800 dark:text-gray-200">
                      {tg.lead_count || 0} leads
                    </td>
                    <td className="py-3 px-4">
                      <div className="w-36">
                        <div className="flex justify-between text-2xs font-semibold text-gray-500 mb-1">
                          <span>{tg.completed_activities || 0} / {tg.total_activities || 0}</span>
                          <span>{tg.progress_percentage || 0}%</span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full"
                            style={{ width: `${tg.progress_percentage || 0}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${tg.status === "Completed" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" :
                          tg.status === "Active" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" :
                            "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                        }`}>
                        {tg.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(tg)}
                          title="Edit Task Group"
                          className="p-1.5 rounded-lg text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition cursor-pointer"
                        >
                          <FaEdit className="text-sm" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDelete(tg)}
                          title="Delete Task Group"
                          className="p-1.5 rounded-lg text-red-600 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-900/30 transition cursor-pointer"
                        >
                          <FaTrashAlt className="text-sm" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: Create & Edit Task Group with Independent Activities */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-gray-700 overflow-hidden my-auto max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900 flex-shrink-0">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FaTasks className="text-blue-600" />
                {editingTaskGroup ? `Edit Task Group: ${editingTaskGroup.title}` : "Create New Task Group"}
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingTaskGroup(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white cursor-pointer"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSubmitTaskGroup} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Q4 Follow-up Calls on CCTV Leads"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  rows="2"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Action instructions for the assigned staff members..."
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                />
              </div>

              <div className={`grid grid-cols-2 ${editingTaskGroup ? "sm:grid-cols-5" : "sm:grid-cols-4"} gap-3`}>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  >
                    <option value="Low">Low</option>
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
                {editingTaskGroup && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Status</label>
                    <select
                      value={taskStatus}
                      onChange={(e) => setTaskStatus(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                    >
                      <option value="Active">Active</option>
                      <option value="Scheduled">Scheduled</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Staff Selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Assign Staff Members * ({selectedStaffIds.size} selected)
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700">
                  {staffList.map((st) => {
                    const isChecked = selectedStaffIds.has(st.id);
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => toggleStaff(st.id)}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition flex items-center gap-1 cursor-pointer ${isChecked
                            ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                            : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
                          }`}
                      >
                        {isChecked && <FaCheck className="text-[9px]" />}
                        {st.full_name || st.username}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Associate Leads Toggle */}
              <div className="p-3 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-gray-900 dark:text-white block text-xs">
                      Do you want to associate leads with this task?
                    </span>
                    <span className="text-[11px] text-gray-500">
                      Generates independent activities for each assigned staff member per lead.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={associateLeads}
                    onChange={(e) => setAssociateLeads(e.target.checked)}
                    className="h-4 w-4 text-blue-600 rounded cursor-pointer"
                  />
                </div>

                {associateLeads && (
                  <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={leadSearchTerm}
                        onChange={(e) => setLeadSearchTerm(e.target.value)}
                        placeholder="Search leads..."
                        className="flex-1 px-2.5 py-1 text-xs bg-white dark:bg-gray-900 border border-gray-300 rounded"
                      />
                      <select
                        value={leadSegmentFilter}
                        onChange={(e) => setLeadSegmentFilter(e.target.value)}
                        className="px-2.5 py-1 text-xs bg-white dark:bg-gray-900 border border-gray-300 rounded"
                      >
                        <option value="">All Segments</option>
                        {segmentsList.map((s) => (
                          <option key={s.id} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleSelectAllFilteredLeads}
                        className="px-2.5 py-1 text-2xs font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 cursor-pointer"
                      >
                        Select All Filtered
                      </button>
                    </div>

                    <div className="max-h-40 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg">
                      {filteredAvailableLeads.slice(0, 50).map((l) => {
                        const isChecked = selectedLeadIds.has(l.id);
                        return (
                          <div
                            key={l.id}
                            onClick={() => toggleLead(l.id)}
                            className="p-2 flex items-center justify-between cursor-pointer hover:bg-blue-50/40 dark:hover:bg-gray-750"
                          >
                            <div>
                              <span className="font-semibold text-gray-800 dark:text-gray-200">{l.company_name}</span>
                              <span className="text-gray-400 ml-2">({l.contact_person})</span>
                            </div>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => { }}
                              className="h-3.5 w-3.5 text-blue-600 rounded"
                            />
                          </div>
                        );
                      })}
                    </div>
                    <span className="text-2xs text-gray-500 block text-right font-semibold">
                      {selectedLeadIds.size} leads selected × {selectedStaffIds.size} staff = {selectedLeadIds.size * selectedStaffIds.size} independent activities
                    </span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingTaskGroup(null);
                  }}
                  className="px-4 py-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-6 py-2 text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 cursor-pointer"
                >
                  {creating
                    ? (editingTaskGroup ? "Saving Changes..." : "Creating...")
                    : (editingTaskGroup ? "Save Changes" : "Create Task Group")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Delete Confirmation Dialog */}
      {deletingTaskGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 text-red-600">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
                  <FaTrashAlt className="text-lg" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Delete Task Group</h3>
                  <p className="text-xs text-gray-500">Confirm task removal</p>
                </div>
              </div>

              <div className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 space-y-2">
                <p>
                  Are you sure you want to delete task group <strong className="text-gray-900 dark:text-white">"{deletingTaskGroup.title}"</strong>?
                </p>
                <p className="text-2xs text-gray-500 bg-gray-50 dark:bg-gray-900/60 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700">
                  All historical staff activities, notes, and communication logs will be safely archived and preserved.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={deleteSubmitting}
                  onClick={() => setDeletingTaskGroup(null)}
                  className="px-4 py-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteSubmitting}
                  onClick={handleConfirmDelete}
                  className="px-5 py-2 text-xs sm:text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {deleteSubmitting ? (
                    <>
                      <FaSpinner className="animate-spin text-xs" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <FaTrashAlt className="text-xs" />
                      Delete Task Group
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

