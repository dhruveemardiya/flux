import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import {
  FaUserClock, FaCheck, FaTimes, FaSearch, FaHistory,
  FaShieldAlt, FaSpinner, FaLaptop, FaCalendarAlt
} from "react-icons/fa";
import BASE_URL from "../config";
import axiosInstance from "../axiosconfig";

const TABS = [
  { key: "Pending", label: "Pending Requests" },
  { key: "Approved", label: "Approved Requests" },
  { key: "Rejected", label: "Rejected Requests" },
  { key: "Expired", label: "Expired Requests" },
  { key: "Complete History", label: "Complete Access History" },
];

export default function CRMAccessLogs({ user }) {
  const [activeTab, setActiveTab] = useState("Pending");
  const [requests, setRequests] = useState([]);
  const [accessLogs, setAccessLogs] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0, expired: 0, all: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [canApprove, setCanApprove] = useState(false);

  // Decision Modal
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [targetRequest, setTargetRequest] = useState(null);
  const [decisionType, setDecisionType] = useState("Approved");
  const [decisionNotes, setDecisionNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === "Complete History") {
        const res = await axiosInstance.get(`${BASE_URL}/api/crm/access-logs/`, {
          params: { search },
        });
        setAccessLogs(res.data.logs || []);
      } else {
        const res = await axiosInstance.get(`${BASE_URL}/api/crm/access-requests/`, {
          params: { tab: activeTab, search },
        });
        setRequests(res.data.requests || []);
        setCounts(res.data.counts || {});
        setCanApprove(res.data.can_approve || false);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to load access logs.");
    } finally {
      setLoading(false);
    }
  }, [activeTab, search]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleOpenDecision = (req, type) => {
    setTargetRequest(req);
    setDecisionType(type);
    setDecisionNotes("");
    setShowDecisionModal(true);
  };

  const handleSubmitDecision = async (e) => {
    e.preventDefault();
    if (!targetRequest) return;
    setSubmitting(true);
    try {
      await axiosInstance.post(
        `${BASE_URL}/api/crm/access-requests/${targetRequest.id}/decision/`,
        {
          decision: decisionType,
          notes: decisionNotes,
        }
      );
      toast.success(`Access request marked as ${decisionType}.`);
      setShowDecisionModal(false);
      fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to submit decision.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <FaUserClock className="text-blue-600" />
            Login Approval & Access Logs
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Review and approve staff CRM access requests, inspect device/IP details, and maintain security audit history.
          </p>
        </div>
        <div className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300 font-medium">
          Protected Administrative Module
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto gap-2">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          let badgeCount = null;
          if (tab.key === "Pending") badgeCount = counts.pending;
          if (tab.key === "Approved") badgeCount = counts.approved;
          if (tab.key === "Rejected") badgeCount = counts.rejected;
          if (tab.key === "Expired") badgeCount = counts.expired;

          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-3 px-4 text-xs sm:text-sm font-semibold whitespace-nowrap border-b-2 transition flex items-center gap-2 ${isActive
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
            >
              {tab.label}
              {badgeCount !== null && (
                <span className={`px-2 py-0.5 rounded-full text-2xs font-extrabold ${isActive ? "bg-blue-100 text-blue-800 dark:bg-blue-900/60" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                  }`}>
                  {badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs flex items-center gap-3">
        <FaSearch className="text-gray-400 text-xs ml-2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by staff name, username, IP address..."
          className="w-full text-xs sm:text-sm bg-transparent border-none text-gray-900 dark:text-white focus:outline-none"
        />
      </div>

      {/* Requests / Logs Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 flex justify-center items-center gap-2">
            <FaSpinner className="animate-spin text-blue-600" />
            Loading records...
          </div>
        ) : activeTab === "Complete History" ? (
          /* Complete History Logs Table */
          accessLogs.length === 0 ? (
            <div className="p-8 text-center text-gray-400 italic">No access logs recorded.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 uppercase tracking-wider font-semibold text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Staff Name</th>
                    <th className="py-3 px-4">Event Type</th>
                    <th className="py-3 px-4">IP Address</th>
                    <th className="py-3 px-4">Device Info</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {accessLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-750">
                      <td className="py-3 px-4 font-semibold text-gray-900 dark:text-white">
                        {log.staff_name} <span className="text-xs text-gray-400 font-mono">({log.username})</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-2xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                          {log.event_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-gray-600 dark:text-gray-300">
                        {log.ip_address || "—"}
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs max-w-xs truncate" title={log.device_info}>
                        {log.device_info || "—"}
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-300">
                        {log.actor}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-500 text-xs">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* Requests Table */
          requests.length === 0 ? (
            <div className="p-8 text-center text-gray-400 italic">No {activeTab.toLowerCase()} requests found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 uppercase tracking-wider font-semibold text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Staff Name</th>
                    <th className="py-3 px-4">Request Date & Time</th>
                    <th className="py-3 px-4">IP Address</th>
                    <th className="py-3 px-4">Device Information</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Decided By</th>
                    <th className="py-3 px-4">Decision Date</th>
                    {activeTab === "Pending" && canApprove && (
                      <th className="py-3 px-4 text-right">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {requests.map((req) => (
                    <tr key={req.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-750">
                      <td className="py-3 px-4 font-semibold text-gray-900 dark:text-white">
                        {req.staff_name} <span className="text-xs text-gray-400 font-mono">({req.username})</span>
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-300 text-xs">
                        {req.request_datetime ? new Date(req.request_datetime).toLocaleString() : "—"}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-gray-600 dark:text-gray-300">
                        {req.ip_address || "—"}
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs max-w-xs truncate" title={req.device_info}>
                        {req.device_info || "Browser / Web"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${req.status === "Approved" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" :
                            req.status === "Rejected" ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" :
                              req.status === "Expired" ? "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300" :
                                "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                          }`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-300">
                        {req.decided_by || "—"}
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs">
                        {req.decision_datetime ? new Date(req.decision_datetime).toLocaleString() : "—"}
                      </td>
                      {activeTab === "Pending" && canApprove && (
                        <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                          <button
                            onClick={() => handleOpenDecision(req, "Approved")}
                            className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded shadow-xs"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleOpenDecision(req, "Rejected")}
                            className="px-2.5 py-1 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded shadow-xs"
                          >
                            Reject
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* MODAL: Approve / Reject Decision */}
      {showDecisionModal && targetRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700">
            <h4 className="text-base font-bold text-gray-900 dark:text-white mb-2">
              {decisionType === "Approved" ? "Approve Access Request" : "Reject Access Request"}
            </h4>
            <p className="text-xs text-gray-500 mb-4">
              Confirm {decisionType.toLowerCase()} CRM access for staff member{" "}
              <strong>{targetRequest.staff_name} ({targetRequest.username})</strong>.
            </p>
            <form onSubmit={handleSubmitDecision} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Decision Notes (Optional)
                </label>
                <textarea
                  rows="3"
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  placeholder="Reason or administrative notes..."
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDecisionModal(false)}
                  className="px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-4 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-50 ${decisionType === "Approved" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
                    }`}
                >
                  {submitting ? "Saving..." : `Confirm ${decisionType}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

