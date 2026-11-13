import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import {
  FaBriefcase, FaCalendarAlt, FaChevronLeft, FaChevronRight,
  FaCheckCircle, FaClock, FaExclamationTriangle, FaSearch,
  FaFilter, FaPhoneAlt, FaBuilding, FaUser, FaRegEdit,
  FaSpinner, FaTimes, FaCalendarCheck, FaTag, FaHistory, FaPaperclip
} from "react-icons/fa";
import BASE_URL from "../config";
import axiosInstance from "../axiosconfig";

export default function CRMMyWorkDashboard({ user }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [activities, setActivities] = useState([]);
  const [summary, setSummary] = useState({ total: 0, completed: 0, pending: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modal State for Updating Activity
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [updateStatus, setUpdateStatus] = useState("Pending");
  const [actionTaken, setActionTaken] = useState("");
  const [notes, setNotes] = useState("");
  const [nextFollowupDate, setNextFollowupDate] = useState("");
  const [nextFollowupTime, setNextFollowupTime] = useState("");
  const [attachment, setAttachment] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchMyWork = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`${BASE_URL}/api/crm/my-work/`, {
        params: {
          date: selectedDate,
          search,
          status: statusFilter,
        },
      });
      setActivities(res.data.activities || []);
      setSummary(res.data.summary || { total: 0, completed: 0, pending: 0, overdue: 0 });
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to load work items.");
    } finally {
      setLoading(false);
    }
  }, [selectedDate, search, statusFilter]);

  useEffect(() => {
    fetchMyWork();
  }, [fetchMyWork]);

  // Date Shift Helper
  const shiftDate = (days) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().slice(0, 10));
  };

  const setPresetDate = (type) => {
    const d = new Date();
    if (type === "yesterday") d.setDate(d.getDate() - 1);
    if (type === "tomorrow") d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const openUpdateModal = (act) => {
    setSelectedActivity(act);
    setUpdateStatus(act.activity_status || "Pending");
    setActionTaken(act.action_taken || "");
    setNotes(act.notes || "");
    setNextFollowupDate(act.next_followup_date || "");
    setNextFollowupTime(act.next_followup_time || "");
    setAttachment("");
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    if (!selectedActivity) return;
    setSaving(true);
    try {
      await axiosInstance.post(
        `${BASE_URL}/api/crm/my-work/activities/${selectedActivity.activity_id}/update/`,
        {
          status: updateStatus,
          action_taken: actionTaken,
          notes,
          next_followup_date: nextFollowupDate || null,
          next_followup_time: nextFollowupTime || null,
          attachment,
        }
      );
      toast.success("Activity and timeline updated successfully!");
      setSelectedActivity(null);
      fetchMyWork();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update activity.");
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (st) => {
    switch (st) {
      case "Completed":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "Rejected":
      case "Not Interested":
        return "bg-rose-100 text-rose-800 border-rose-300";
      case "Callback Required":
      case "Follow-up Required":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "No Answer":
        return "bg-purple-100 text-purple-800 border-purple-300";
      default:
        return "bg-blue-100 text-blue-800 border-blue-300";
    }
  };

  const getPriorityBadge = (p) => {
    switch (p) {
      case "Urgent":
        return "bg-red-500 text-white";
      case "High":
        return "bg-orange-500 text-white";
      case "Low":
        return "bg-slate-500 text-white";
      default:
        return "bg-blue-500 text-white";
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const isToday = selectedDate === todayStr;

  return (
    <div className="p-6 bg-slate-50 min-h-screen space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FaBriefcase className="text-blue-600" /> My Work Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Personalized daily task workspace, lead follow-ups, and activity tracking.
          </p>
        </div>

        {/* Date Navigator Controls */}
        <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-1">
            <button
              onClick={() => shiftDate(-1)}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
              title="Previous Day"
            >
              <FaChevronLeft size={14} />
            </button>
            <button
              onClick={() => setPresetDate("yesterday")}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100 transition"
            >
              Yesterday
            </button>
            <button
              onClick={() => setPresetDate("today")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                isToday
                  ? "bg-blue-600 text-white shadow"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setPresetDate("tomorrow")}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100 transition"
            >
              Tomorrow
            </button>
            <button
              onClick={() => shiftDate(1)}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
              title="Next Day"
            >
              <FaChevronRight size={14} />
            </button>
          </div>

          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <FaCalendarAlt className="text-slate-400" size={14} />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-bold text-slate-500 tracking-wider">Total Work Items</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{summary.total}</p>
          </div>
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-xl">
            <FaCalendarCheck />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-bold text-slate-500 tracking-wider">Completed</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{summary.completed}</p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-xl">
            <FaCheckCircle />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-bold text-slate-500 tracking-wider">Pending Action</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{summary.pending}</p>
          </div>
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center text-xl">
            <FaClock />
          </div>
        </div>

        <div className={`p-5 rounded-xl border shadow-sm flex items-center justify-between ${
          summary.overdue > 0 ? "bg-rose-50 border-rose-200" : "bg-white border-slate-200"
        }`}>
          <div>
            <p className="text-xs uppercase font-bold text-rose-600 tracking-wider">Overdue Follow-ups</p>
            <p className="text-2xl font-bold text-rose-700 mt-1">{summary.overdue}</p>
          </div>
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center text-xl">
            <FaExclamationTriangle />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <FaSearch className="absolute left-3 top-3 text-slate-400" size={14} />
          <input
            type="text"
            placeholder="Search by company, person, phone, task..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <FaFilter className="text-slate-400" size={14} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-300 rounded-lg text-sm px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">All Activity Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Completed">Completed</option>
              <option value="Follow-up Required">Follow-up Required</option>
              <option value="Callback Required">Callback Required</option>
              <option value="No Answer">No Answer</option>
              <option value="Rejected">Rejected</option>
              <option value="Not Interested">Not Interested</option>
            </select>
          </div>
        </div>
      </div>

      {/* Activities Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 text-sm">
            Assigned Work Activities for {new Date(selectedDate).toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
          </h2>
          <span className="text-xs bg-blue-100 text-blue-800 font-semibold px-2.5 py-1 rounded-full">
            {activities.length} items
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center">
            <FaSpinner className="animate-spin text-3xl text-blue-600 mb-2" />
            <p className="text-sm">Loading assigned tasks and follow-ups...</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <p className="text-base font-semibold text-slate-700">No work items found for this date.</p>
            <p className="text-sm mt-1">Select another date or adjust your search filters above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100/75 text-slate-600 uppercase text-xs font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Task Group / Priority</th>
                  <th className="px-6 py-3.5">Company & Contact</th>
                  <th className="px-6 py-3.5">Contact Details</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Follow-Up Schedule</th>
                  <th className="px-6 py-3.5">Latest Action / Notes</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {activities.map((act) => (
                  <tr key={act.activity_id} className={`hover:bg-slate-50/75 transition ${act.is_overdue ? "bg-rose-50/30" : ""}`}>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{act.task_title}</div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getPriorityBadge(act.priority)}`}>
                          {act.priority}
                        </span>
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <FaTag size={10} className="text-slate-400" /> {act.segment}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <FaBuilding className="text-slate-400" size={12} /> {act.company_name}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                        <FaUser className="text-slate-400" size={11} /> {act.contact_person}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      {act.mobile_number ? (
                        <a
                          href={`tel:${act.mobile_number}`}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
                        >
                          <FaPhoneAlt size={11} /> {act.mobile_number}
                        </a>
                      ) : (
                        <span className="text-slate-400 text-xs">No phone</span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full border ${getStatusBadge(act.activity_status)}`}>
                        {act.activity_status}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      {act.next_followup_date ? (
                        <div>
                          <div className={`text-xs font-medium flex items-center gap-1 ${
                            act.is_overdue ? "text-rose-600 font-bold" : "text-slate-700"
                          }`}>
                            <FaClock size={11} />
                            {act.next_followup_date} {act.next_followup_time || ""}
                          </div>
                          {act.is_overdue && (
                            <span className="inline-block mt-0.5 text-[10px] font-bold text-rose-600 uppercase tracking-wide">
                              OVERDUE
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">Not scheduled</span>
                      )}
                    </td>

                    <td className="px-6 py-4 max-w-xs">
                      {act.action_taken && (
                        <div className="text-xs font-semibold text-slate-800 truncate">
                          {act.action_taken}
                        </div>
                      )}
                      <div className="text-xs text-slate-500 truncate mt-0.5">
                        {act.notes || "No notes logged yet."}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openUpdateModal(act)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium shadow-sm transition"
                      >
                        <FaRegEdit size={12} /> Log Action
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* UPDATE ACTIVITY MODAL */}
      {selectedActivity && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">Update Lead Activity</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedActivity.company_name} ({selectedActivity.contact_person})
                </p>
              </div>
              <button
                onClick={() => setSelectedActivity(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <FaTimes size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Activity Status *
                </label>
                <select
                  value={updateStatus}
                  onChange={(e) => setUpdateStatus(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                >
                  <option value="Pending">Pending</option>
                  <option value="Completed">Completed</option>
                  <option value="Follow-up Required">Follow-up Required</option>
                  <option value="Callback Required">Callback Required</option>
                  <option value="No Answer">No Answer</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Not Interested">Not Interested</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Action Taken / Discussion Summary
                </label>
                <input
                  type="text"
                  placeholder="e.g. Phone call with client, discussed enterprise pricing"
                  value={actionTaken}
                  onChange={(e) => setActionTaken(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Detailed Notes & Observations
                </label>
                <textarea
                  rows={3}
                  placeholder="Client expressed high interest, requested a demo presentation on Monday..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Next Follow-up Date
                  </label>
                  <input
                    type="date"
                    value={nextFollowupDate}
                    onChange={(e) => setNextFollowupDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Follow-up Time
                  </label>
                  <input
                    type="time"
                    value={nextFollowupTime}
                    onChange={(e) => setNextFollowupTime(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1.5">
                  <FaPaperclip size={12} /> Attachment Link / Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Paste URL or document reference name"
                  value={attachment}
                  onChange={(e) => setAttachment(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedActivity(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm transition flex items-center gap-2"
                >
                  {saving && <FaSpinner className="animate-spin" />}
                  Save Activity Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

