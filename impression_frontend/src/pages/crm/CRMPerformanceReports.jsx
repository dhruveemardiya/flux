import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import {
  FaChartBar, FaChartPie, FaDownload, FaFilter, FaRedo,
  FaCheckCircle, FaClock, FaTimesCircle, FaExclamationTriangle,
  FaPercentage, FaTasks, FaUserCheck, FaSpinner, FaCalendarAlt
} from "react-icons/fa";
import * as XLSX from "xlsx";
import BASE_URL from "../config";
import axiosInstance from "../axiosconfig";

export default function CRMPerformanceReports({ user }) {
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState({
    summary: {
      total_assigned: 0,
      completed: 0,
      pending: 0,
      rejected: 0,
      overdue: 0,
      completion_percentage: 0,
    },
    charts: {
      status_distribution: [],
      staff_performance: [],
    },
    table_rows: [],
    total_rows: 0,
  });

  // Filter lists
  const [taskList, setTaskList] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [segmentList, setSegmentList] = useState([]);

  // Selected filters
  const [taskGroupId, setTaskGroupId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [segment, setSegment] = useState("");
  const [statusVal, setStatusVal] = useState("");
  const [priority, setPriority] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Load filter options once
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [tgRes, userRes, segRes] = await Promise.all([
          axiosInstance.get(`${BASE_URL}/api/crm/task-groups/`),
          axiosInstance.get(`${BASE_URL}/api/crm/users/`),
          axiosInstance.get(`${BASE_URL}/api/crm/segments/`),
        ]);
        setTaskList(tgRes.data.task_groups || []);
        setStaffList(userRes.data.users || []);
        setSegmentList(segRes.data.segments || []);
      } catch (err) {
        // quiet fail on options
      }
    };
    loadFilters();
  }, []);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`${BASE_URL}/api/crm/reports/performance/`, {
        params: {
          task_group_id: taskGroupId || undefined,
          staff_id: staffId || undefined,
          segment: segment || undefined,
          status: statusVal || undefined,
          priority: priority || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
        },
      });
      setReportData(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to load performance report.");
    } finally {
      setLoading(false);
    }
  }, [taskGroupId, staffId, segment, statusVal, priority, startDate, endDate]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const resetFilters = () => {
    setTaskGroupId("");
    setStaffId("");
    setSegment("");
    setStatusVal("");
    setPriority("");
    setStartDate("");
    setEndDate("");
  };

  const exportToExcel = () => {
    if (!reportData.table_rows || reportData.table_rows.length === 0) {
      toast.warning("No data to export.");
      return;
    }

    const exportRows = reportData.table_rows.map((r, i) => ({
      "Sr No": i + 1,
      "Staff Member": r.staff_name,
      "Task Group": r.task_title,
      "Company Name": r.company_name,
      "Contact Person": r.contact_person,
      "Assigned Date": r.assigned_date || "",
      "Current Status": r.current_status,
      "Next Follow-up": r.next_followup || "",
      "Overdue Status": r.overdue_status,
      "Last Updated": r.last_updated || "",
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Performance Report");
    XLSX.writeFile(wb, `CRM_Performance_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Report downloaded as Excel successfully!");
  };

  const { summary, charts, table_rows } = reportData;

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

  return (
    <div className="p-6 bg-slate-50 min-h-screen space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FaChartBar className="text-blue-600" /> Performance Reports
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Comprehensive audit metrics, staff productivity KPIs, and completion analytics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-sm transition"
          >
            <FaDownload /> Export to Excel
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <FaFilter size={12} className="text-blue-600" /> Filter Performance Records
          </span>
          <button
            onClick={resetFilters}
            className="text-xs text-slate-500 hover:text-blue-600 font-semibold flex items-center gap-1 transition"
          >
            <FaRedo size={10} /> Reset Filters
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
          {/* Task Group */}
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Task Group</label>
            <select
              value={taskGroupId}
              onChange={(e) => setTaskGroupId(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">All Tasks</option>
              {taskList.map((tg) => (
                <option key={tg.id} value={tg.id}>{tg.title}</option>
              ))}
            </select>
          </div>

          {/* Staff Member */}
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Staff Member</label>
            <select
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">All Staff</option>
              {staffList.map((st) => (
                <option key={st.id} value={st.id}>{st.name || st.username}</option>
              ))}
            </select>
          </div>

          {/* Segment */}
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Segment</label>
            <select
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">All Segments</option>
              {segmentList.map((sg) => (
                <option key={sg.id} value={sg.name}>{sg.name}</option>
              ))}
            </select>
          </div>

          {/* Activity Status */}
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Activity Status</label>
            <select
              value={statusVal}
              onChange={(e) => setStatusVal(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">All Statuses</option>
              <option value="Completed">Completed</option>
              <option value="Pending">Pending</option>
              <option value="Follow-up Required">Follow-up Required</option>
              <option value="Callback Required">Callback Required</option>
              <option value="No Answer">No Answer</option>
              <option value="Rejected">Rejected</option>
              <option value="Not Interested">Not Interested</option>
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">All Priorities</option>
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Normal">Normal</option>
              <option value="Low">Low</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[11px] font-bold uppercase text-slate-500">Total Assigned</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{summary.total_assigned}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[11px] font-bold uppercase text-emerald-600">Completed</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{summary.completed}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[11px] font-bold uppercase text-blue-600">Pending</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{summary.pending}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[11px] font-bold uppercase text-rose-600">Rejected / Lost</p>
          <p className="text-2xl font-bold text-rose-600 mt-1">{summary.rejected}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[11px] font-bold uppercase text-amber-600">Overdue Follow-ups</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{summary.overdue}</p>
        </div>

        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-4 rounded-xl shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-100">Completion Rate</p>
          <p className="text-2xl font-extrabold mt-1">{summary.completion_percentage}%</p>
        </div>
      </div>

      {/* Visual Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Breakdown Card */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
            <FaChartPie className="text-blue-600" /> Activity Status Distribution
          </h3>
          <div className="space-y-3">
            {charts.status_distribution?.map((item) => {
              const pct = summary.total_assigned > 0
                ? Math.round((item.value / summary.total_assigned) * 100)
                : 0;
              return (
                <div key={item.name} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>{item.name}</span>
                    <span className="text-slate-500">{item.value} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.name === "Completed" ? "bg-emerald-500" :
                          item.name === "Pending" ? "bg-blue-500" :
                            item.name === "Rejected" ? "bg-rose-500" :
                              "bg-amber-500"
                        }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Staff-wise Performance Breakdown */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
            <FaUserCheck className="text-blue-600" /> Staff Productivity Breakdown
          </h3>
          {charts.staff_performance?.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">No staff performance data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Staff Member</th>
                    <th className="py-2 px-3 text-center">Total</th>
                    <th className="py-2 px-3 text-center">Done</th>
                    <th className="py-2 px-3 text-center">Pending</th>
                    <th className="py-2 px-3 text-center">Overdue</th>
                    <th className="py-2 px-3 text-right">Completion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {charts.staff_performance?.map((s) => {
                    const rate = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
                    return (
                      <tr key={s.name} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-slate-800">{s.name}</td>
                        <td className="py-2 px-3 text-center text-slate-600">{s.total}</td>
                        <td className="py-2 px-3 text-center text-emerald-600 font-semibold">{s.completed}</td>
                        <td className="py-2 px-3 text-center text-blue-600">{s.pending}</td>
                        <td className="py-2 px-3 text-center text-rose-600">{s.overdue}</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">{rate}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Detailed Records Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 text-sm">Detailed Performance Audit Table</h2>
          <span className="text-xs text-slate-500 font-medium">
            Showing top {table_rows.length} records
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center">
            <FaSpinner className="animate-spin text-3xl text-blue-600 mb-2" />
            <p className="text-sm">Calculating performance metrics...</p>
          </div>
        ) : table_rows.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <p className="text-base font-semibold text-slate-700">No records found matching filters.</p>
            <p className="text-sm mt-1">Try resetting or broadening your filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100/75 text-slate-600 uppercase text-xs font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Staff Member</th>
                  <th className="px-6 py-3.5">Task Group</th>
                  <th className="px-6 py-3.5">Company & Contact</th>
                  <th className="px-6 py-3.5">Assigned Date</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Follow-Up Schedule</th>
                  <th className="px-6 py-3.5">Overdue Flag</th>
                  <th className="px-6 py-3.5">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {table_rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/75 transition">
                    <td className="px-6 py-4 font-semibold text-slate-900">{row.staff_name}</td>
                    <td className="px-6 py-4 text-slate-700">{row.task_title}</td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800">{row.company_name}</div>
                      <div className="text-xs text-slate-500">{row.contact_person}</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">{row.assigned_date || "N/A"}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full border ${getStatusBadge(row.current_status)}`}>
                        {row.current_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-700">{row.next_followup || "N/A"}</td>
                    <td className="px-6 py-4">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${row.overdue_status === "Overdue" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                        }`}>
                        {row.overdue_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {row.last_updated ? new Date(row.last_updated).toLocaleString() : "Never"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

