import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FaSearch,
  FaSyncAlt,
  FaPlus,
  FaPhoneAlt,
  FaWhatsapp,
  FaEnvelope,
  FaRegEdit,
  FaRegTrashAlt,
  FaEye,
  FaClock,
  FaCalendarAlt,
  FaCalendarCheck,
  FaExclamationTriangle,
  FaTimes,
  FaHistory,
  FaSave,
  FaCommentDots,
  FaComments,
  FaMapMarkerAlt,
  FaUserFriends,
  FaPhone
} from "react-icons/fa";
import BASE_URL from "./config";
import axiosInstance from "./axiosconfig";

export default function TaskManager({ user: propUser }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(propUser || null);

  // Task list and counts
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState({ all: 0, pending: 0, completed: 0 });

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Pending"); // Default to 'Pending' for focused workflow

  // Modal States
  const [showLogCallModal, setShowLogCallModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Active / Selected Task
  const [selectedTask, setSelectedTask] = useState(null);
  const [availableLeads, setAvailableLeads] = useState([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);

  // Form states for Lead Communication & Follow-up Modal
  const [callFormData, setCallFormData] = useState({
    interaction_type: "Call", // 'Call' | 'WhatsApp' | 'Email'
    call_date: new Date().toISOString().split("T")[0],
    interaction_date: new Date().toISOString().split("T")[0],
    discussion: "",
    communication_notes: "",
    next_followup_date: "",
    future_discussion: "",
    next_followup_notes: ""
  });
  const [submittingCall, setSubmittingCall] = useState(false);

  // Form states for Add Task Modal
  const [addTaskData, setAddTaskData] = useState({
    lead_id: "",
    description: "",
    assigned_date: new Date().toISOString().split("T")[0],
    next_followup_date: "",
    future_discussion: ""
  });
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Form states for Edit Task Modal
  const [editTaskData, setEditTaskData] = useState({
    id: null,
    description: "",
    assigned_date: "",
    next_followup_date: "",
    future_discussion: "",
    status: "Pending"
  });
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Fetch current user if not passed
  useEffect(() => {
    if (!currentUser) {
      const fetchUser = async () => {
        try {
          const res = await axiosInstance.get(`${BASE_URL}/api/users/me/`);
          setCurrentUser(res.data);
        } catch (err) {
          console.error("Failed to load user info in TaskManager", err);
        }
      };
      fetchUser();
    }
  }, [currentUser]);

  // Fetch Tasks
  const fetchTasks = useCallback(async (customStatus) => {
    setLoading(true);
    try {
      const activeStatus = customStatus !== undefined ? customStatus : statusFilter;
      const params = new URLSearchParams();
      if (activeStatus && activeStatus !== "all") {
        params.append("status", activeStatus);
      }
      if (searchTerm.trim()) {
        params.append("search", searchTerm.trim());
      }

      const res = await axiosInstance.get(`${BASE_URL}/api/tasks/?${params.toString()}`);
      setTasks(res.data.tasks || []);
      if (res.data.counts) {
        setCounts(res.data.counts);
      }
    } catch (err) {
      console.error("Error fetching tasks:", err);
      toast.error("Failed to load assigned tasks.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm]);

  // Initial and reactive fetch
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Handle URL query ?taskId=123 to open detail modal directly
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const taskIdParam = queryParams.get("taskId");
    if (taskIdParam) {
      const loadTaskById = async (id) => {
        try {
          const res = await axiosInstance.get(`${BASE_URL}/api/tasks/${id}/`);
          if (res.data.task) {
            setSelectedTask(res.data.task);
            setShowDetailModal(true);
          }
        } catch (err) {
          console.error("Could not load task from notification link:", err);
        }
      };
      loadTaskById(taskIdParam);
    }
  }, [location.search]);

  // Fetch available leads for Add Task modal
  const fetchAvailableLeads = async () => {
    setLoadingAvailable(true);
    try {
      const res = await axiosInstance.get(`${BASE_URL}/api/tasks/available-leads/`);
      setAvailableLeads(res.data.available_leads || []);
    } catch (err) {
      console.error("Failed to load available leads", err);
      toast.error("Could not fetch available leads.");
    } finally {
      setLoadingAvailable(false);
    }
  };

  // Open Lead Communication & Follow-up Modal
  const handleOpenCallManager = async (task) => {
    try {
      const res = await axiosInstance.get(`${BASE_URL}/api/tasks/${task.id}/`);
      setSelectedTask(res.data.task || task);
    } catch (err) {
      setSelectedTask(task);
    }
    const todayStr = new Date().toISOString().split("T")[0];
    setCallFormData({
      interaction_type: "Call",
      call_date: todayStr,
      interaction_date: todayStr,
      discussion: "",
      communication_notes: "",
      next_followup_date: task.next_followup_date || "",
      future_discussion: task.future_discussion || "",
      next_followup_notes: task.future_discussion || ""
    });
    setShowLogCallModal(true);
  };
  const handleOpenLogCall = handleOpenCallManager;

  // Submit Communication / Interaction Log
  const handleSubmitCallLog = async (e) => {
    e.preventDefault();
    const notes = (callFormData.communication_notes || callFormData.discussion || "").trim();
    if (!notes) {
      toast.warning("Please enter communication notes.");
      return;
    }
    setSubmittingCall(true);
    try {
      const payload = {
        interaction_type: callFormData.interaction_type || "Call",
        interaction_date: callFormData.interaction_date || callFormData.call_date,
        call_date: callFormData.interaction_date || callFormData.call_date,
        communication_notes: notes,
        discussion: notes,
        next_followup_date: callFormData.next_followup_date || null,
        next_followup_notes: (callFormData.next_followup_notes || callFormData.future_discussion || "").trim(),
        future_discussion: (callFormData.next_followup_notes || callFormData.future_discussion || "").trim(),
      };
      await axiosInstance.post(
        `${BASE_URL}/api/tasks/${selectedTask.id}/calls/`,
        payload
      );
      toast.success(`${payload.interaction_type} interaction recorded and follow-up scheduled!`);

      // Refresh task details to immediately display newly logged communication in timeline
      try {
        const refreshed = await axiosInstance.get(`${BASE_URL}/api/tasks/${selectedTask.id}/`);
        if (refreshed.data.task) {
          setSelectedTask(refreshed.data.task);
        }
      } catch (rErr) {
        // Continue
      }

      // Reset discussion field while keeping interaction type & date
      setCallFormData((prev) => ({
        ...prev,
        discussion: "",
        communication_notes: "",
        future_discussion: "",
        next_followup_notes: ""
      }));

      fetchTasks();
    } catch (err) {
      console.error("Error saving communication record:", err);
      toast.error(err.response?.data?.error || "Failed to record communication.");
    } finally {
      setSubmittingCall(false);
    }
  };

  // Open Task Detail & Timeline Modal
  const handleOpenDetail = async (task) => {
    try {
      const res = await axiosInstance.get(`${BASE_URL}/api/tasks/${task.id}/`);
      setSelectedTask(res.data.task);
    } catch (err) {
      setSelectedTask(task);
    }
    setShowDetailModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (task) => {
    setSelectedTask(task);
    setEditTaskData({
      id: task.id,
      description: task.description || "",
      assigned_date: task.assigned_date || "",
      next_followup_date: task.next_followup_date || "",
      future_discussion: task.future_discussion || "",
      status: task.status || "Pending"
    });
    setShowEditModal(true);
  };

  // Save Edit Task
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSubmittingEdit(true);
    try {
      await axiosInstance.patch(`${BASE_URL}/api/tasks/${editTaskData.id}/`, {
        description: editTaskData.description,
        assigned_date: editTaskData.assigned_date || null,
        next_followup_date: editTaskData.next_followup_date || null,
        future_discussion: editTaskData.future_discussion,
        status: editTaskData.status
      });
      toast.success("Task updated successfully!");
      setShowEditModal(false);
      fetchTasks();
    } catch (err) {
      console.error("Failed to update task:", err);
      toast.error(err.response?.data?.error || "Failed to update task.");
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Toggle Task Status (Pending <-> Completed)
  const handleToggleStatus = async (task) => {
    const nextStatus = task.status === "Pending" ? "Completed" : "Pending";
    try {
      await axiosInstance.post(`${BASE_URL}/api/tasks/${task.id}/status/`, {
        status: nextStatus
      });
      toast.success(`Task marked as ${nextStatus}!`);
      fetchTasks();
    } catch (err) {
      console.error("Failed to toggle task status:", err);
      toast.error("Could not update task status.");
    }
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    fetchAvailableLeads();
    setAddTaskData({
      lead_id: "",
      description: "",
      assigned_date: new Date().toISOString().split("T")[0],
      next_followup_date: "",
      future_discussion: ""
    });
    setShowAddModal(true);
  };

  // Submit Add Task
  const handleSubmitAdd = async (e) => {
    e.preventDefault();
    if (!addTaskData.lead_id) {
      toast.warning("Please select a lead.");
      return;
    }
    setSubmittingAdd(true);
    try {
      await axiosInstance.post(`${BASE_URL}/api/tasks/`, addTaskData);
      toast.success("New task created successfully!");
      setShowAddModal(false);
      fetchTasks();
    } catch (err) {
      console.error("Failed to create task:", err);
      toast.error(err.response?.data?.error || "Failed to create task.");
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Open Delete Confirmation
  const handleOpenDelete = (task) => {
    setSelectedTask(task);
    setShowDeleteModal(true);
  };

  // Confirm Delete Task
  const handleConfirmDelete = async () => {
    if (!selectedTask) return;
    try {
      await axiosInstance.delete(`${BASE_URL}/api/tasks/${selectedTask.id}/`);
      toast.success("Task deleted successfully.");
      setShowDeleteModal(false);
      fetchTasks();
    } catch (err) {
      console.error("Failed to delete task:", err);
      toast.error("Could not delete task.");
    }
  };

  // Clean phone numbers for tel: and wa.me
  const cleanPhoneNumber = (number) => {
    if (!number) return "";
    return String(number).replace(/[^0-9]/g, "");
  };

  // Helper to preview reminder date calculation
  const getCalculatedReminderDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      d.setDate(d.getDate() - 1);
      return d.toISOString().split("T")[0];
    } catch {
      return null;
    }
  };

  return (
    <div className="w-full max-w-full min-w-0 p-3 sm:p-4 md:p-5 bg-white dark:bg-gray-900 shadow-lg rounded-xl">
      {/* Compact Page Heading (Matching Lead Generation page) */}
      <div className="flex items-center justify-between mb-2.5 sm:mb-3">
        <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white tracking-tight">
          Assigned Tasks
        </h2>
      </div>

      {/* Compact Single-Row Toolbar & Filters (Matching Lead Generation page) */}
      <div className="mb-3.5">
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-1.5 sm:gap-2 w-full">
          
          {/* 1. Add Task Button (Matching Add Lead button styling) */}
          <button
            type="button"
            title="Add Task"
            aria-label="Add Task"
            onClick={handleOpenAdd}
            className="h-8 w-8 sm:h-8.5 sm:w-8.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-md flex items-center justify-center shadow-xs transition hover:shadow focus:outline-none focus:ring-1 focus:ring-blue-500 shrink-0"
          >
            <FaPlus className="text-xs sm:text-sm" />
          </button>

          {/* 2. Refresh Button */}
          <button
            type="button"
            onClick={() => fetchTasks()}
            className="h-8 w-8 sm:h-8.5 sm:w-8.5 bg-white hover:bg-gray-100 active:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md shadow-xs flex items-center justify-center transition hover:shadow focus:outline-none focus:ring-1 focus:ring-blue-500 shrink-0"
            title="Refresh"
            aria-label="Refresh"
          >
            <FaSyncAlt className={`text-xs sm:text-sm ${loading ? "animate-spin" : ""}`} />
          </button>

          {/* 3. Status Filter Tabs (Matching Lead Generation tab styling) */}
          {[
            { key: "Pending", label: "Pending", count: counts.pending },
            { key: "Completed", label: "Completed", count: counts.completed },
            { key: "all", label: "All Tasks", count: counts.all },
          ].map((tab) => {
            const isActive = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
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

          {/* 4. Reset search button */}
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              title="Reset Search"
              className="h-8 sm:h-8.5 px-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md text-xs font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition shrink-0"
            >
              Reset
            </button>
          )}

          {/* 5. Search Bar (aligned right) */}
          <div className="relative flex-1 min-w-[130px] max-w-full sm:max-w-[180px] md:max-w-[210px] xl:max-w-[240px] ml-auto shrink-0 w-full sm:w-auto">
            <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-8 sm:h-8.5 pl-8 pr-2.5 text-xs border rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 shadow-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

        </div>
      </div>

      {/* Horizontally Scrollable Table Container (Matching Lead Generation Table) */}
      <div className="w-full max-w-full overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800">
        <table className="w-full text-xs sm:text-sm text-left text-gray-600 dark:text-gray-300">
          <thead className="bg-gray-50 dark:bg-gray-700/60 text-gray-700 dark:text-gray-200 font-semibold border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-3 sm:px-4 py-3 min-w-[170px]">Company</th>
              <th className="px-3 sm:px-4 py-3 min-w-[160px]">Contact Person</th>
              <th className="px-3 sm:px-4 py-3 text-center whitespace-nowrap min-w-[110px]">Contact Actions</th>
              <th className="px-3 sm:px-4 py-3 min-w-[220px]">Description</th>
              <th className="px-3 sm:px-4 py-3 whitespace-nowrap min-w-[110px]">Assigned Date</th>
              <th className="px-3 sm:px-4 py-3 whitespace-nowrap min-w-[130px]">Next Follow-up</th>
              <th className="px-3 sm:px-4 py-3 whitespace-nowrap text-center min-w-[110px]">Status</th>
              <th className="px-3 sm:px-4 py-3 text-center whitespace-nowrap min-w-[120px]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan="8" className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <div className="flex items-center justify-center gap-2">
                    <FaSyncAlt className="animate-spin text-blue-500" />
                    <span>Loading assigned tasks...</span>
                  </div>
                </td>
              </tr>
            ) : tasks.length === 0 ? (
              <tr>
                <td colSpan="8" className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No assigned tasks found.
                </td>
              </tr>
            ) : (
              tasks.map((task) => {
                const rawPhone = task.phone || task.mobile || "";
                const cleanPhone = cleanPhoneNumber(rawPhone);
                const rawMobile = task.mobile || task.phone || "";
                const cleanMobile = cleanPhoneNumber(rawMobile);
                const email = task.email || "";

                return (
                  <tr
                    key={task.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/60 transition"
                  >
                    {/* Company Name */}
                    <td className="px-3 sm:px-4 py-3 font-semibold text-gray-900 dark:text-white max-w-[200px] break-words">
                      <div>
                        {task.company_name || <span className="text-gray-400 italic">No Company</span>}
                      </div>
                      {task.city && (
                        <div className="text-2xs text-gray-400 mt-0.5 flex items-center gap-1 font-normal">
                          <FaMapMarkerAlt className="text-red-500 text-[10px] shrink-0" />
                          <span>{task.city}</span>
                        </div>
                      )}
                    </td>

                    {/* Contact Person */}
                    <td className="px-3 sm:px-4 py-3">
                      <div className="text-gray-800 dark:text-gray-200 font-medium">
                        {task.contact_person || "—"}
                      </div>
                      {email && (
                        <div className="text-2xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5 break-all max-w-[220px]">
                          <FaEnvelope className="text-gray-400 shrink-0 text-[10px]" />
                          <span>{email}</span>
                        </div>
                      )}
                    </td>

                    {/* Direct Contact Actions: Email, WhatsApp, Call */}
                    <td className="px-3 sm:px-4 py-3 text-center whitespace-nowrap">
                      <div className="inline-flex items-center justify-center gap-1.5">
                        {/* Call Icon (tel:) */}
                        {cleanPhone ? (
                          <a
                            href={`tel:${cleanPhone}`}
                            title={`Call: ${rawPhone}`}
                            className="h-7 w-7 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white flex items-center justify-center transition border border-emerald-200 dark:border-emerald-800"
                          >
                            <FaPhone className="text-[11px]" />
                          </a>
                        ) : (
                          <span
                            title="No phone number"
                            className="h-7 w-7 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600 flex items-center justify-center border border-gray-200 dark:border-gray-700 cursor-not-allowed"
                          >
                            <FaPhone className="text-[11px]" />
                          </span>
                        )}

                        {/* WhatsApp Icon */}
                        {cleanMobile ? (
                          <a
                            href={`https://wa.me/${cleanMobile}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`WhatsApp: ${rawMobile}`}
                            className="h-7 w-7 rounded-full bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 hover:bg-green-600 hover:text-white dark:hover:bg-green-600 dark:hover:text-white flex items-center justify-center transition border border-green-200 dark:border-green-800"
                          >
                            <FaWhatsapp className="text-sm" />
                          </a>
                        ) : (
                          <span
                            title="No mobile number for WhatsApp"
                            className="h-7 w-7 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600 flex items-center justify-center border border-gray-200 dark:border-gray-700 cursor-not-allowed"
                          >
                            <FaWhatsapp className="text-sm" />
                          </span>
                        )}

                        {/* Email Icon (mailto:) */}
                        {email ? (
                          <a
                            href={`mailto:${email}?subject=Follow-up%20-%20${encodeURIComponent(task.company_name || 'Client')}`}
                            title={`Email: ${email}`}
                            className="h-7 w-7 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 hover:bg-sky-600 hover:text-white dark:hover:bg-sky-600 dark:hover:text-white flex items-center justify-center transition border border-sky-200 dark:border-sky-800"
                          >
                            <FaEnvelope className="text-[11px]" />
                          </a>
                        ) : (
                          <span
                            title="No email address"
                            className="h-7 w-7 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600 flex items-center justify-center border border-gray-200 dark:border-gray-700 cursor-not-allowed"
                          >
                            <FaEnvelope className="text-[11px]" />
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Description / Message */}
                    <td className="px-3 sm:px-4 py-3 max-w-[220px]">
                      <div className="flex flex-col">
                        <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2" title={task.description}>
                          {task.description || <span className="italic text-gray-400">No description</span>}
                        </p>
                        {task.future_discussion && (
                          <p className="text-2xs text-blue-600 dark:text-blue-400 mt-0.5 line-clamp-1 flex items-center gap-1 font-medium" title={`Next discussion: ${task.future_discussion}`}>
                            <FaCommentDots className="text-[10px] shrink-0" />
                            <span>Next: {task.future_discussion}</span>
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Assigned Date */}
                    <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-xs text-gray-600 dark:text-gray-300">
                      <div className="flex items-center gap-1">
                        <FaCalendarAlt className="text-gray-400 text-xs shrink-0" />
                        <span>{task.assigned_date || "—"}</span>
                      </div>
                    </td>

                    {/* Next Follow-up Date */}
                    <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                      {task.next_followup_date ? (
                        <div className="flex flex-col gap-0.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${
                              task.is_overdue
                                ? "bg-red-100 text-red-800 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800"
                                : task.is_due_today
                                ? "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/60 dark:text-amber-300 dark:border-amber-800 animate-pulse"
                                : "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800"
                            }`}
                          >
                            {task.is_overdue ? (
                              <FaExclamationTriangle className="text-[10px]" />
                            ) : (
                              <FaClock className="text-[10px]" />
                            )}
                            <span>{task.next_followup_date}</span>
                          </span>
                          {task.reminder_date && (
                            <span className="text-2xs text-gray-400 dark:text-gray-500 font-mono">
                              Reminder: {task.reminder_date}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs italic">Not scheduled</span>
                      )}
                    </td>

                    {/* Task Status Toggle (Matching Lead Generation status pill) */}
                    <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(task)}
                        title={`Click to mark ${task.status === "Pending" ? "Completed" : "Pending"}`}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full border cursor-pointer focus:outline-none transition ${
                          task.status === "Completed"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/60 dark:text-emerald-200 dark:border-emerald-700"
                            : "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/60 dark:text-amber-200 dark:border-amber-700"
                        }`}
                      >
                        {task.status}
                      </button>
                    </td>

                    {/* Actions: Follow-up, View Details, Edit Task, Delete Task (Exact Order) */}
                    <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                        {/* 1. Follow-up Button (Lead Communication & Follow-up with calendar-clock/check icon) */}
                        <button
                          type="button"
                          onClick={() => handleOpenCallManager(task)}
                          title="Lead Communication & Follow-up"
                          aria-label="Lead Communication & Follow-up"
                          className="h-8 w-8 bg-white hover:bg-gray-100 active:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-blue-600 dark:text-blue-400 border border-gray-300 dark:border-gray-600 rounded-md shadow-xs flex items-center justify-center transition hover:shadow focus:outline-none focus:ring-1 focus:ring-blue-500 shrink-0"
                        >
                          <FaCalendarCheck className="text-xs sm:text-sm" />
                        </button>

                        {/* 2. View Details Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(task)}
                          title="View Details"
                          aria-label="View Details"
                          className="h-8 w-8 bg-white hover:bg-gray-100 active:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-blue-600 dark:text-blue-400 border border-gray-300 dark:border-gray-600 rounded-md shadow-xs flex items-center justify-center transition hover:shadow focus:outline-none focus:ring-1 focus:ring-blue-500 shrink-0"
                        >
                          <FaEye className="text-xs sm:text-sm" />
                        </button>

                        {/* 3. Edit Task Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(task)}
                          title="Edit Task"
                          aria-label="Edit Task"
                          className="h-8 w-8 bg-white hover:bg-gray-100 active:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-blue-600 dark:text-blue-400 border border-gray-300 dark:border-gray-600 rounded-md shadow-xs flex items-center justify-center transition hover:shadow focus:outline-none focus:ring-1 focus:ring-blue-500 shrink-0"
                        >
                          <FaRegEdit className="text-xs sm:text-sm" />
                        </button>

                        {/* 4. Delete Task Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenDelete(task)}
                          title="Delete Task"
                          aria-label="Delete Task"
                          className="h-8 w-8 bg-white hover:bg-gray-100 active:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-red-600 dark:text-red-400 border border-gray-300 dark:border-gray-600 rounded-md shadow-xs flex items-center justify-center transition hover:shadow focus:outline-none focus:ring-1 focus:ring-red-500 shrink-0"
                        >
                          <FaRegTrashAlt className="text-xs sm:text-sm" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL 1: Lead Communication & Follow-up (Log Interaction & View Complete Chronological History) */}
      {showLogCallModal && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700 my-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-start sm:items-center px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0 gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <FaComments className="text-blue-600 dark:text-blue-400 text-lg sm:text-xl shrink-0" />
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate">
                    Lead Communication & Follow-up
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600 dark:text-gray-300 mt-1">
                  <span className="font-semibold text-gray-900 dark:text-white">{selectedTask.company_name}</span>
                  {selectedTask.contact_person && <span>• {selectedTask.contact_person}</span>}
                  {selectedTask.city && <span>• {selectedTask.city}</span>}
                </div>

                {/* Quick Action Contact Pills: Phone Call, WhatsApp, Email */}
                {(() => {
                  const phoneNum = (selectedTask.phone && selectedTask.phone !== "0") ? selectedTask.phone : ((selectedTask.mobile && selectedTask.mobile !== "0") ? selectedTask.mobile : "");
                  const cleanPhone = phoneNum ? phoneNum.replace(/[^0-9+]/g, "") : "";
                  const mobileNum = (selectedTask.mobile && selectedTask.mobile !== "0") ? selectedTask.mobile : "";
                  const cleanMobile = mobileNum ? mobileNum.replace(/[^0-9]/g, "") : (cleanPhone.replace(/[^0-9]/g, ""));
                  const emailAddr = selectedTask.email || "";

                  return (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {cleanPhone ? (
                        <a
                          href={`tel:${cleanPhone}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 transition"
                          title={`Direct Phone Call: ${phoneNum}`}
                        >
                          <FaPhoneAlt className="text-[10px]" />
                          <span>Call: {phoneNum}</span>
                        </a>
                      ) : null}

                      {cleanMobile ? (
                        <a
                          href={`https://wa.me/${cleanMobile.startsWith("91") ? cleanMobile : (cleanMobile.length === 10 ? `91${cleanMobile}` : cleanMobile)}?text=Hello%20${encodeURIComponent(selectedTask.contact_person || selectedTask.company_name || '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-950/50 dark:text-green-300 dark:hover:bg-green-900/60 border border-green-200 dark:border-green-800 transition"
                          title="Open WhatsApp Chat"
                        >
                          <FaWhatsapp className="text-[12px]" />
                          <span>WhatsApp</span>
                        </a>
                      ) : null}

                      {emailAddr ? (
                        <a
                          href={`mailto:${emailAddr}?subject=Follow-up%20-%20${encodeURIComponent(selectedTask.company_name || 'Client')}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-900/60 border border-sky-200 dark:border-sky-800 transition"
                          title={`Send Email: ${emailAddr}`}
                        >
                          <FaEnvelope className="text-[10px]" />
                          <span className="truncate max-w-[160px]">{emailAddr}</span>
                        </a>
                      ) : null}
                    </div>
                  );
                })()}
              </div>
              <button
                type="button"
                onClick={() => setShowLogCallModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1"
              >
                <FaTimes />
              </button>
            </div>

            {/* Modal Body: Form to Add Interaction + Previous Communication History */}
            <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1 text-xs sm:text-sm">
              {/* SECTION A: Add New Interaction Record */}
              <form onSubmit={handleSubmitCallLog} className="p-3.5 sm:p-4 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <FaCommentDots className="text-blue-500 text-xs" />
                    <span>RECORD NEW INTERACTION</span>
                  </h4>
                  <span className="text-2xs text-gray-400">All fields saved to permanent history</span>
                </div>

                {/* Interaction Type Selector */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Interaction Type <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { type: "Call", label: "Phone Call", icon: FaPhoneAlt, activeColor: "bg-emerald-600 text-white border-emerald-600 shadow-xs" },
                      { type: "WhatsApp", label: "WhatsApp", icon: FaWhatsapp, activeColor: "bg-green-600 text-white border-green-600 shadow-xs" },
                      { type: "Email", label: "Email", icon: FaEnvelope, activeColor: "bg-sky-600 text-white border-sky-600 shadow-xs" },
                    ].map((tab) => {
                      const Icon = tab.icon;
                      const isSelected = (callFormData.interaction_type || "Call") === tab.type;
                      return (
                        <button
                          key={tab.type}
                          type="button"
                          onClick={() => setCallFormData({ ...callFormData, interaction_type: tab.type })}
                          className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                            isSelected
                              ? tab.activeColor
                              : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                          }`}
                        >
                          <Icon className="text-xs" />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Interaction Date & Next Follow-up Date Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Interaction Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={callFormData.interaction_date || callFormData.call_date}
                      onChange={(e) => setCallFormData({
                        ...callFormData,
                        interaction_date: e.target.value,
                        call_date: e.target.value
                      })}
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Next Follow-up Date
                    </label>
                    <input
                      type="date"
                      value={callFormData.next_followup_date}
                      onChange={(e) => setCallFormData({ ...callFormData, next_followup_date: e.target.value })}
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    {callFormData.next_followup_date && (
                      <p className="text-2xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1 font-medium">
                        <FaClock className="text-[10px]" />
                        <span>
                          Reminder: <strong>{getCalculatedReminderDate(callFormData.next_followup_date)}</strong> (1 day prior)
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Communication Notes */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Communication Notes <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows="2.5"
                    placeholder="Enter discussion notes from the phone call, WhatsApp conversation, or email..."
                    value={callFormData.communication_notes !== undefined && callFormData.communication_notes !== "" ? callFormData.communication_notes : callFormData.discussion}
                    onChange={(e) => setCallFormData({
                      ...callFormData,
                      communication_notes: e.target.value,
                      discussion: e.target.value
                    })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-400"
                  ></textarea>
                </div>

                {/* Next Follow-up Notes */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Next Follow-up Notes
                  </label>
                  <textarea
                    rows="1.5"
                    placeholder="Agenda / points to discuss during the next follow-up..."
                    value={callFormData.next_followup_notes !== undefined && callFormData.next_followup_notes !== "" ? callFormData.next_followup_notes : callFormData.future_discussion}
                    onChange={(e) => setCallFormData({
                      ...callFormData,
                      next_followup_notes: e.target.value,
                      future_discussion: e.target.value
                    })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-400"
                  ></textarea>
                </div>

                {/* Submit Record Button */}
                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={submittingCall}
                    className="px-4 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <FaSave />
                    <span>{submittingCall ? "Saving Record..." : "Save Communication Record"}</span>
                  </button>
                </div>
              </form>

              {/* SECTION B: Previous Communication History (Preserved Chronologically) */}
              <div>
                <div className="flex items-center justify-between mb-2.5 pb-1 border-b border-gray-200 dark:border-gray-700">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <FaHistory className="text-blue-500" />
                    <span>PREVIOUS COMMUNICATION HISTORY ({selectedTask.call_history ? selectedTask.call_history.length : 0})</span>
                  </h4>
                  <span className="text-2xs text-gray-400">Chronological Record</span>
                </div>

                {selectedTask.call_history && selectedTask.call_history.length > 0 ? (
                  <div className="space-y-3 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-gray-200 dark:before:bg-gray-700">
                    {selectedTask.call_history.map((c, idx) => {
                      const type = c.interaction_type || "Call";
                      const isWhatsApp = type.toLowerCase() === "whatsapp";
                      const isEmail = type.toLowerCase() === "email";
                      const dateStr = c.interaction_date || c.call_date;

                      return (
                        <div key={c.id || idx} className="relative flex items-start gap-3 pl-7 text-xs">
                          <div className={`absolute left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-white dark:border-gray-900 ${
                            isWhatsApp ? "bg-green-600" : isEmail ? "bg-sky-600" : "bg-emerald-600"
                          }`}></div>

                          <div className="w-full p-3 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                {isWhatsApp ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-semibold bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300">
                                    <FaWhatsapp className="text-[11px]" /> WhatsApp
                                  </span>
                                ) : isEmail ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
                                    <FaEnvelope className="text-[10px]" /> Email
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                    <FaPhoneAlt className="text-[10px]" /> Phone Call
                                  </span>
                                )}
                                <span className="text-gray-600 dark:text-gray-300 font-normal">on {dateStr}</span>
                              </span>
                              <span className="text-2xs text-gray-400">
                                By {c.user_name || "User"}
                              </span>
                            </div>

                            <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap mb-2">
                              {c.communication_notes || c.discussion}
                            </p>

                            {(c.next_followup_date || c.next_followup_notes || c.future_discussion) && (
                              <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700 text-2xs text-gray-600 dark:text-gray-300">
                                {c.next_followup_date && (
                                  <p className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                                    <FaCalendarAlt className="text-[10px]" />
                                    <span>Scheduled next follow-up: <strong>{c.next_followup_date}</strong></span>
                                  </p>
                                )}
                                {(c.next_followup_notes || c.future_discussion) && (
                                  <p className="mt-0.5 text-gray-500 dark:text-gray-400 italic">
                                    Next Follow-up Notes: {c.next_followup_notes || c.future_discussion}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-gray-400 italic rounded-lg bg-gray-50 dark:bg-gray-900/40">
                    No communication records saved yet. Record an interaction using the form above.
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-2 sm:gap-3 p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowLogCallModal(false)}
                className="px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Task Details & Chronological Call History */}
      {showDetailModal && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700 my-auto">
            {/* Header */}
            <div className="flex justify-between items-center px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <FaEye className="text-blue-600 dark:text-blue-400" />
                    <span>{selectedTask.company_name || `Lead #${selectedTask.lead_id}`}</span>
                  </h3>
                  <span className={`text-2xs font-semibold px-2 py-0.5 rounded-full border ${
                    selectedTask.status === "Completed"
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/60 dark:text-emerald-200"
                      : "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/60 dark:text-amber-200"
                  }`}>
                    {selectedTask.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Contact: {selectedTask.contact_person || "—"} • Assigned Date: {selectedTask.assigned_date || "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowDetailModal(false);
                  if (location.search.includes("taskId")) {
                    navigate("/task-manager", { replace: true });
                  }
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1"
              >
                <FaTimes />
              </button>
            </div>

            {/* Scrollable Content (Matching UserAssignedLeads detail grid) */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm">
              {/* Lead Details Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Contact Info Card */}
                <div className="p-3.5 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                    <FaUserFriends className="text-blue-500" /> Contact Info
                  </h4>
                  <div>
                    <span className="text-2xs text-gray-400 block">Contact Person</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {selectedTask.contact_person || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-2xs text-gray-400 block">Email</span>
                    <span className="text-gray-800 dark:text-gray-200 font-mono text-xs break-all">
                      {selectedTask.email || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-2xs text-gray-400 block">Phone / Mobile</span>
                    <span className="text-gray-800 dark:text-gray-200 font-mono text-xs">
                      {selectedTask.phone || selectedTask.mobile || "—"}
                    </span>
                  </div>
                </div>

                {/* Location Card */}
                <div className="p-3.5 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                    <FaMapMarkerAlt className="text-red-500" /> Location
                  </h4>
                  <div>
                    <span className="text-2xs text-gray-400 block">City</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {selectedTask.city || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-2xs text-gray-400 block">Address</span>
                    <span className="text-gray-700 dark:text-gray-300 text-xs">
                      {selectedTask.address || "—"}
                    </span>
                  </div>
                </div>

                {/* Scheduling Card */}
                <div className="p-3.5 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                    <FaClock className="text-purple-500" /> Follow-up Schedule
                  </h4>
                  <div>
                    <span className="text-2xs text-gray-400 block">Next Follow-up</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {selectedTask.next_followup_date || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-2xs text-gray-400 block">Reminder Scheduled</span>
                    <span className="text-gray-700 dark:text-gray-300 text-xs font-mono">
                      {selectedTask.reminder_date || "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Task Description & Agenda */}
              <div className="space-y-2">
                <div className="p-3 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700 text-xs">
                  <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-1">Description:</h4>
                  <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                    {selectedTask.description || "No description specified."}
                  </p>
                </div>

                {selectedTask.future_discussion && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800 text-xs">
                    <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-1 flex items-center gap-1">
                      <FaCommentDots />
                      <span>Next Discussion Agenda:</span>
                    </h4>
                    <p className="text-blue-900 dark:text-blue-200 whitespace-pre-wrap">
                      {selectedTask.future_discussion}
                    </p>
                  </div>
                )}
              </div>

              {/* Communication History Timeline (Preserved permanently) */}
              <div>
                <div className="flex items-center justify-between mb-2.5 pb-1 border-b border-gray-200 dark:border-gray-700">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                    <FaHistory className="text-blue-500" />
                    <span>Complete Communication History ({selectedTask.call_history ? selectedTask.call_history.length : 0})</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDetailModal(false);
                      handleOpenLogCall(selectedTask);
                    }}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <FaPlus className="text-2xs" />
                    <span>Log Interaction</span>
                  </button>
                </div>

                {selectedTask.call_history && selectedTask.call_history.length > 0 ? (
                  <div className="space-y-3 mt-3 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-gray-200 dark:before:bg-gray-700">
                    {selectedTask.call_history.map((c, idx) => {
                      const type = c.interaction_type || "Call";
                      const isWhatsApp = type.toLowerCase() === "whatsapp";
                      const isEmail = type.toLowerCase() === "email";
                      const dateStr = c.interaction_date || c.call_date;

                      return (
                        <div key={c.id || idx} className="relative flex items-start gap-3 pl-7 text-xs">
                          <div className={`absolute left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-white dark:border-gray-900 ${
                            isWhatsApp ? "bg-green-600" : isEmail ? "bg-sky-600" : "bg-emerald-600"
                          }`}></div>

                          <div className="w-full p-3 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                {isWhatsApp ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-semibold bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300">
                                    <FaWhatsapp className="text-[11px]" /> WhatsApp
                                  </span>
                                ) : isEmail ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
                                    <FaEnvelope className="text-[10px]" /> Email
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                    <FaPhoneAlt className="text-[10px]" /> Phone Call
                                  </span>
                                )}
                                <span className="text-gray-600 dark:text-gray-300 font-normal">on {dateStr}</span>
                              </span>
                              <span className="text-2xs text-gray-400">
                                By {c.user_name || "User"}
                              </span>
                            </div>

                            <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap mb-2">
                              {c.communication_notes || c.discussion}
                            </p>

                            {(c.next_followup_date || c.next_followup_notes || c.future_discussion) && (
                              <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700 text-2xs text-gray-600 dark:text-gray-300">
                                {c.next_followup_date && (
                                  <p className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                                    <FaCalendarAlt className="text-[10px]" />
                                    <span>Scheduled next follow-up: <strong>{c.next_followup_date}</strong></span>
                                  </p>
                                )}
                                {(c.next_followup_notes || c.future_discussion) && (
                                  <p className="mt-0.5 text-gray-500 dark:text-gray-400 italic">
                                    Next Follow-up Notes: {c.next_followup_notes || c.future_discussion}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-gray-400 italic rounded-lg bg-gray-50 dark:bg-gray-900/40">
                    No communication records saved yet for this task.
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 sm:gap-3 p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowDetailModal(false);
                  if (location.search.includes("taskId")) {
                    navigate("/task-manager", { replace: true });
                  }
                }}
                className="px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Edit Task Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700 my-auto">
            <div className="flex justify-between items-center px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FaRegEdit className="text-blue-600 dark:text-blue-400" />
                <span>Edit Task</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm">
                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Description / Instructions
                  </label>
                  <textarea
                    rows="3"
                    value={editTaskData.description}
                    onChange={(e) => setEditTaskData({ ...editTaskData, description: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  ></textarea>
                </div>

                {/* Dates Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Assigned Date
                    </label>
                    <input
                      type="date"
                      value={editTaskData.assigned_date}
                      onChange={(e) => setEditTaskData({ ...editTaskData, assigned_date: e.target.value })}
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Next Follow-up Date
                    </label>
                    <input
                      type="date"
                      value={editTaskData.next_followup_date}
                      onChange={(e) => setEditTaskData({ ...editTaskData, next_followup_date: e.target.value })}
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Task Status
                  </label>
                  <select
                    value={editTaskData.status}
                    onChange={(e) => setEditTaskData({ ...editTaskData, status: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                {/* Future Discussion */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Future Discussion Notes
                  </label>
                  <textarea
                    rows="2"
                    value={editTaskData.future_discussion}
                    onChange={(e) => setEditTaskData({ ...editTaskData, future_discussion: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  ></textarea>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-2 sm:gap-3 p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="px-4 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <FaSave />
                  <span>{submittingEdit ? "Saving..." : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Add New Task from Available Assigned Leads */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700 my-auto">
            <div className="flex justify-between items-center px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FaPlus className="text-blue-600 dark:text-blue-400" />
                <span>Add New Task</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSubmitAdd} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm">
                {/* Select Assigned Lead */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Select Lead <span className="text-red-500">*</span>
                  </label>
                  {loadingAvailable ? (
                    <div className="text-xs text-gray-400 py-1.5 flex items-center gap-1.5">
                      <FaSyncAlt className="animate-spin text-blue-500" />
                      <span>Loading available assigned leads...</span>
                    </div>
                  ) : availableLeads.length === 0 ? (
                    <div className="p-3 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg">
                      All currently assigned leads already have an active pending task!
                    </div>
                  ) : (
                    <select
                      required
                      value={addTaskData.lead_id}
                      onChange={(e) => {
                        const selected = availableLeads.find((l) => String(l.id) === e.target.value);
                        setAddTaskData({
                          ...addTaskData,
                          lead_id: e.target.value,
                          description: selected ? `Follow up with ${selected.company_name || selected.display_name}` : ""
                        });
                      }}
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">-- Choose an assigned lead --</option>
                      {availableLeads.map((lead) => (
                        <option key={lead.id} value={lead.id}>
                          {lead.display_name} {lead.contact_person ? `(${lead.contact_person})` : ""} {lead.city ? `• ${lead.city}` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Description / Objective
                  </label>
                  <textarea
                    rows="2.5"
                    placeholder="Enter task description or instructions..."
                    value={addTaskData.description}
                    onChange={(e) => setAddTaskData({ ...addTaskData, description: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  ></textarea>
                </div>

                {/* Assigned Date & Next Follow-up Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Assigned Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={addTaskData.assigned_date}
                      onChange={(e) => setAddTaskData({ ...addTaskData, assigned_date: e.target.value })}
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Next Follow-up Date
                    </label>
                    <input
                      type="date"
                      value={addTaskData.next_followup_date}
                      onChange={(e) => setAddTaskData({ ...addTaskData, next_followup_date: e.target.value })}
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Future Discussion Notes */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Future Discussion Notes
                  </label>
                  <textarea
                    rows="2"
                    placeholder="Optional notes for future discussion..."
                    value={addTaskData.future_discussion}
                    onChange={(e) => setAddTaskData({ ...addTaskData, future_discussion: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  ></textarea>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-2 sm:gap-3 p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd || availableLeads.length === 0}
                  className="px-4 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <FaPlus />
                  <span>{submittingAdd ? "Creating..." : "Create Task"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Delete Confirmation Modal */}
      {showDeleteModal && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl sm:rounded-2xl max-w-sm w-full shadow-2xl border border-gray-200 dark:border-gray-700 text-center my-auto">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Task</h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-5">
              Are you sure you want to delete the task for{" "}
              <strong>{selectedTask.company_name || `Lead #${selectedTask.lead_id}`}</strong>?
              This action cannot be undone.
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-3 sm:px-4 py-1.5 text-xs sm:text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                Cancel
              </button>
              <button
                type="button"
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
