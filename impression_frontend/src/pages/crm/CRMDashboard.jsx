import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FaChartLine, FaUsers, FaUserCheck, FaLayerGroup,
  FaAddressBook, FaTasks, FaCalendarCheck, FaClock,
  FaExclamationTriangle, FaUserClock, FaSyncAlt, FaArrowRight,
  FaCheckCircle, FaSpinner
} from "react-icons/fa";
import BASE_URL from "../config";
import axiosInstance from "../axiosconfig";

export default function CRMDashboard({ user }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`${BASE_URL}/api/crm/dashboard/summary/`);
      setData(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to load CRM dashboard metrics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-500">
        <FaSpinner className="animate-spin text-4xl text-blue-600 mb-3" />
        <p className="text-sm font-medium">Loading CRM Dashboard...</p>
      </div>
    );
  }

  const isAdmin = data?.is_admin;
  const kpis = data?.kpis || {};

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <FaChartLine className="text-blue-600" />
            CRM Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Real-time customer relationship metrics, task groups, and activity tracking.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchDashboardData}
            className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            <FaSyncAlt />
            Refresh
          </button>
          <Link
            to="/lead-generation/my-work"
            className="flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition"
          >
            <FaCalendarCheck />
            My Work
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      {isAdmin ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
            <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Total Leads</span>
              <FaAddressBook className="text-lg" />
            </div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">{kpis.total_leads || 0}</div>
            <Link to="/lead-generation/leads" className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-flex items-center gap-1">
              View all leads <FaArrowRight className="text-[9px]" />
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
            <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Segments</span>
              <FaLayerGroup className="text-lg" />
            </div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">{kpis.total_segments || 0}</div>
            <Link to="/lead-generation/segments" className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline mt-2 inline-flex items-center gap-1">
              Manage segments <FaArrowRight className="text-[9px]" />
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Active Staff</span>
              <FaUsers className="text-lg" />
            </div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">{kpis.active_staff || 0} / {kpis.total_staff || 0}</div>
            <Link to="/lead-generation/users" className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline mt-2 inline-flex items-center gap-1">
              Staff directory <FaArrowRight className="text-[9px]" />
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
            <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Assigned Leads</span>
              <FaUserCheck className="text-lg" />
            </div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">{kpis.total_assigned_leads || 0}</div>
            <Link to="/lead-generation/assignments" className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline mt-2 inline-flex items-center gap-1">
              Manage assignments <FaArrowRight className="text-[9px]" />
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
            <div className="flex items-center justify-between text-sky-600 dark:text-sky-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Task Groups</span>
              <FaTasks className="text-lg" />
            </div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">{kpis.total_tasks || 0}</div>
            <Link to="/lead-generation/tasks" className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline mt-2 inline-flex items-center gap-1">
              View task groups <FaArrowRight className="text-[9px]" />
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Completed</span>
              <FaCheckCircle className="text-lg" />
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{kpis.completed_activities || 0}</div>
            <div className="text-[11px] text-gray-400 mt-2">Activities completed</div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
            <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Pending</span>
              <FaClock className="text-lg" />
            </div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{kpis.pending_activities || 0}</div>
            <div className="text-[11px] text-gray-400 mt-2">Pending activities</div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
            <div className="flex items-center justify-between text-red-600 dark:text-red-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Overdue Follow-ups</span>
              <FaExclamationTriangle className="text-lg" />
            </div>
            <div className="text-2xl font-black text-red-600 dark:text-red-400">{kpis.overdue_followups || 0}</div>
            <div className="text-[11px] text-gray-400 mt-2">Follow-ups overdue</div>
          </div>

          {/* Temporarily hidden: Login Approval & Access Requests not required in current release */}
          {/* <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
            <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Access Requests</span>
              <FaUserClock className="text-lg" />
            </div>
            <div className="text-2xl font-black text-blue-600 dark:text-blue-400">{kpis.pending_access_requests || 0}</div>
            <Link to="/lead-generation/access-logs" className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-flex items-center gap-1">
              Review requests <FaArrowRight className="text-[9px]" />
            </Link>
          </div> */}
        </div>
      ) : (
        /* Staff Scoped Dashboard */
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
            <div className="flex items-center justify-between text-blue-600 mb-2">
              <span className="text-xs font-bold uppercase text-gray-500">My Assigned Leads</span>
              <FaAddressBook className="text-xl" />
            </div>
            <div className="text-3xl font-black text-gray-900 dark:text-white">{kpis.my_assigned_leads || 0}</div>
            <Link to="/lead-generation/leads" className="text-xs text-blue-600 hover:underline mt-2 inline-block">
              View my leads →
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
            <div className="flex items-center justify-between text-purple-600 mb-2">
              <span className="text-xs font-bold uppercase text-gray-500">Today's Tasks</span>
              <FaTasks className="text-xl" />
            </div>
            <div className="text-3xl font-black text-gray-900 dark:text-white">{kpis.my_today_tasks || 0}</div>
            <Link to="/lead-generation/my-work" className="text-xs text-purple-600 hover:underline mt-2 inline-block">
              Open My Work →
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
            <div className="flex items-center justify-between text-amber-600 mb-2">
              <span className="text-xs font-bold uppercase text-gray-500">Pending Activities</span>
              <FaClock className="text-xl" />
            </div>
            <div className="text-3xl font-black text-amber-600">{kpis.pending_activities || 0}</div>
            <span className="text-xs text-gray-400 mt-2 block">Awaiting action</span>
          </div>

          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
            <div className="flex items-center justify-between text-red-600 mb-2">
              <span className="text-xs font-bold uppercase text-gray-500">Overdue Follow-ups</span>
              <FaExclamationTriangle className="text-xl" />
            </div>
            <div className="text-3xl font-black text-red-600">{kpis.overdue_followups || 0}</div>
            <Link to="/lead-generation/my-work" className="text-xs text-red-600 hover:underline mt-2 inline-block">
              Handle overdue →
            </Link>
          </div>
        </div>
      )}

      {/* Sections: Recent Activities & Segment Distribution */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activities */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FaClock className="text-blue-600" />
                Recent Lead Activities
              </h2>
              <Link to="/lead-generation/reports" className="text-xs text-blue-600 hover:underline">
                View all reports
              </Link>
            </div>
            {data?.recent_activities && data.recent_activities.length > 0 ? (
              <div className="divide-y divide-gray-100 dark:divide-gray-700 text-xs sm:text-sm">
                {data.recent_activities.map((act) => (
                  <div key={act.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-gray-900 dark:text-white">{act.lead_name}</span>
                      <span className="text-gray-400 ml-2">by {act.staff_name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${act.status === 'Completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' :
                          act.status === 'Rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' :
                            'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                        }`}>
                        {act.status}
                      </span>
                      <span className="text-gray-400 text-xs">{act.updated_at ? new Date(act.updated_at).toLocaleDateString() : ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 py-6 text-center italic">No recent activities recorded.</p>
            )}
          </div>

          {/* Segment Distribution */}
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FaLayerGroup className="text-indigo-600" />
                Segment Distribution
              </h2>
              <Link to="/lead-generation/segments" className="text-xs text-indigo-600 hover:underline">
                Segments
              </Link>
            </div>
            {data?.segment_distribution && data.segment_distribution.length > 0 ? (
              <div className="space-y-3">
                {data.segment_distribution.map((seg, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      <span>{seg.name}</span>
                      <span>{seg.value} leads</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-indigo-600 h-2 rounded-full"
                        style={{ width: `${Math.min(100, (seg.value / (kpis.total_leads || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 py-6 text-center italic">No segment distribution data.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

