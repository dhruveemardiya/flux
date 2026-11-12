import React, { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "react-toastify";
import {
  FaLayerGroup,
  FaPlus,
  FaSearch,
  FaSyncAlt,
  FaRegEdit,
  FaRegTrashAlt,
  FaTimes,
  FaLock,
  FaCheckCircle,
  FaTimesCircle,
  FaExclamationTriangle,
} from "react-icons/fa";
import BASE_URL from "./config";
import axiosInstance from "./axiosconfig";

const EMPTY_FORM = {
  name: "",
  description: "",
  is_active: true,
};

export default function NewSegment({ user: propUser }) {
  const [verifiedUser, setVerifiedUser] = useState(null);
  const [userLoaded, setUserLoaded] = useState(false);
  const [serverCanManage, setServerCanManage] = useState(null);

  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | active | inactive

  // Modal states (Admin only)
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingSegment, setEditingSegment] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [segmentToDelete, setSegmentToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Authoritative role resolution from /api/users/me/ + API can_manage flag
  // Strictly ONLY Admin and Super Admin can create, edit, or delete segments.
  // Tech Admin, User, Staff, and all other roles are read-only.
  const isSegmentAdmin = useMemo(() => {
    if (!userLoaded || !verifiedUser) return false;
    const rawRole = String(verifiedUser.role || "").trim().toLowerCase();
    const normalizedRole = rawRole.replace(/[\s_-]+/g, "");
    if (!["admin", "superadmin"].includes(normalizedRole)) return false;
    if (serverCanManage === false) return false;
    return true;
  }, [userLoaded, verifiedUser, serverCanManage]);

  const effectiveRoleLabel = useMemo(() => {
    return verifiedUser?.role || propUser?.role || localStorage.getItem("userRole") || "";
  }, [verifiedUser, propUser]);

  const fetchVerifiedUser = useCallback(async () => {
    try {
      const res = await axiosInstance.get(`${BASE_URL}/api/users/me/`);
      setVerifiedUser(res.data || null);
    } catch (err) {
      console.error("Failed to verify current user role:", err);
      setVerifiedUser(null);
    } finally {
      setUserLoaded(true);
    }
  }, []);

  const fetchSegments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`${BASE_URL}/api/segments/`);
      setSegments(res.data?.segments || []);
      if (typeof res.data?.can_manage === "boolean") {
        setServerCanManage(res.data.can_manage);
      }
    } catch (err) {
      console.error("Failed to fetch segments:", err);
      toast.error(err.response?.data?.error || "Failed to load segments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVerifiedUser();
    fetchSegments();
  }, [fetchVerifiedUser, fetchSegments]);

  const filteredSegments = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return (segments || []).filter((seg) => {
      if (statusFilter === "active" && !seg.is_active) return false;
      if (statusFilter === "inactive" && seg.is_active) return false;
      if (!q) return true;
      return (
        (seg.name && seg.name.toLowerCase().includes(q)) ||
        (seg.description && seg.description.toLowerCase().includes(q)) ||
        (seg.created_by_name && seg.created_by_name.toLowerCase().includes(q))
      );
    });
  }, [segments, searchTerm, statusFilter]);

  const handleOpenAdd = () => {
    if (!isSegmentAdmin) {
      toast.error("Permission denied. Only Admin and Super Admin can create segments.");
      return;
    }
    setEditingSegment(null);
    setFormData(EMPTY_FORM);
    setShowFormModal(true);
  };

  const handleOpenEdit = (segment) => {
    if (!isSegmentAdmin) {
      toast.error("Permission denied. Only Admin and Super Admin can edit segments.");
      return;
    }
    setEditingSegment(segment);
    setFormData({
      name: segment.name || "",
      description: segment.description || "",
      is_active: segment.is_active !== false,
    });
    setShowFormModal(true);
  };

  const duplicateValidation = useMemo(() => {
    const trimmed = (formData.name || "").trim();
    if (!trimmed) {
      return { hasActiveConflict: false, hasInactiveMatch: false, trimmed: "" };
    }
    const lower = trimmed.toLowerCase();
    const excludeId = editingSegment?.id;
    const hasActiveConflict = (segments || []).some(
      (seg) =>
        Boolean(seg.is_active) &&
        (seg.name || "").trim().toLowerCase() === lower &&
        seg.id !== excludeId
    );
    const hasInactiveMatch = (segments || []).some(
      (seg) =>
        !seg.is_active &&
        (seg.name || "").trim().toLowerCase() === lower &&
        seg.id !== excludeId
    );
    return { hasActiveConflict, hasInactiveMatch, trimmed };
  }, [formData.name, segments, editingSegment]);

  const handleSaveSegment = async (e) => {
    e.preventDefault();
    if (!isSegmentAdmin) {
      toast.error("Permission denied. Only Admin and Super Admin can create or edit segments.");
      return;
    }

    const trimmedName = (formData.name || "").trim();
    if (!trimmedName) {
      toast.warning("Please enter a segment name.");
      return;
    }

    // Frontend duplicate validation: only one Active segment with the same name is allowed at a time.
    if (!editingSegment && duplicateValidation.hasActiveConflict) {
      toast.error(`Segment "${trimmedName}" already exists and is Active.`);
      return;
    }
    if (editingSegment && Boolean(formData.is_active) && duplicateValidation.hasActiveConflict) {
      toast.error(`An active segment named "${trimmedName}" already exists. Only one Active segment with the same name is allowed.`);
      return;
    }

    setSaving(true);
    try {
      const effectiveIsActive =
        !editingSegment && duplicateValidation.hasInactiveMatch
          ? true
          : Boolean(formData.is_active);
      const payload = {
        name: trimmedName,
        description: (formData.description || "").trim(),
        is_active: effectiveIsActive,
      };

      if (editingSegment) {
        await axiosInstance.put(`${BASE_URL}/api/segments/${editingSegment.id}/`, payload);
        toast.success("Segment updated successfully.");
      } else {
        await axiosInstance.post(`${BASE_URL}/api/segments/`, payload);
        toast.success("Segment created successfully.");
      }
      setShowFormModal(false);
      setEditingSegment(null);
      setFormData(EMPTY_FORM);
      fetchSegments();
    } catch (err) {
      const msg = err.response?.data?.error || "Failed to save segment.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDelete = (segment) => {
    if (!isSegmentAdmin) {
      toast.error("Permission denied. Only Admin and Super Admin can delete segments.");
      return;
    }
    setSegmentToDelete(segment);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!isSegmentAdmin || !segmentToDelete) {
      toast.error("Permission denied. Only Admin and Super Admin can delete segments.");
      return;
    }

    setDeleting(true);
    try {
      await axiosInstance.delete(`${BASE_URL}/api/segments/${segmentToDelete.id}/`);
      toast.success(`Segment "${segmentToDelete.name}" deleted successfully.`);
      setShowDeleteModal(false);
      setSegmentToDelete(null);
      fetchSegments();
    } catch (err) {
      const msg = err.response?.data?.error || "Failed to delete segment.";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const activeCount = useMemo(() => segments.filter((s) => s.is_active).length, [segments]);
  const inactiveCount = useMemo(() => segments.filter((s) => !s.is_active).length, [segments]);

  return (
    <div className="w-full max-w-full min-w-0 p-3 sm:p-4 md:p-5 bg-white dark:bg-gray-900 shadow-lg rounded-xl">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300">
            <FaLayerGroup className="text-base sm:text-lg" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white tracking-tight">
              New Segment
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isSegmentAdmin
                ? "Create, edit, and manage lead segments available in Manual Lead Generation."
                : "View existing lead segments used in Manual Lead Generation."}
            </p>
          </div>
        </div>

        {userLoaded && !isSegmentAdmin && (
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800"
            title={`Signed in as ${effectiveRoleLabel || "Non-Admin"}`}
          >
            <FaLock className="text-[11px]" />
            <span>View Only — Only Admin and Super Admin can create, edit, or delete segments</span>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {isSegmentAdmin && (
          <button
            type="button"
            onClick={handleOpenAdd}
            className="h-9 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-md flex items-center gap-1.5 shadow-sm text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-500 shrink-0"
          >
            <FaPlus className="text-xs" />
            <span>Add Segment</span>
          </button>
        )}

        <button
          type="button"
          onClick={fetchSegments}
          title="Refresh Segments"
          aria-label="Refresh Segments"
          className="h-9 w-9 bg-white hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm flex items-center justify-center transition shrink-0"
        >
          <FaSyncAlt className={`text-xs ${loading ? "animate-spin" : ""}`} />
        </button>

        {/* Status Filter Tabs */}
        {[
          { key: "all", label: "All", count: segments.length },
          { key: "active", label: "Active", count: activeCount },
          { key: "inactive", label: "Inactive", count: inactiveCount },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatusFilter(tab.key)}
            className={`px-2.5 h-9 rounded-md text-xs font-medium transition whitespace-nowrap flex items-center shrink-0 ${statusFilter === tab.key
              ? "bg-blue-600 text-white shadow-sm font-semibold"
              : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
          >
            <span>{tab.label}</span>
            <span className="ml-1 opacity-80 font-normal">({tab.count})</span>
          </button>
        ))}

        {/* Search Input */}
        <div className="relative flex-1 min-w-[180px] sm:max-w-[260px] ml-auto w-full sm:w-auto">
          <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none" />
          <input
            type="text"
            placeholder="Search segments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-9 pl-8 pr-3 text-xs border rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Segments Table */}
      <div className="w-full max-w-full overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800">
        <table className="w-full text-xs sm:text-sm text-left text-gray-600 dark:text-gray-300">
          <thead className="bg-gray-50 dark:bg-gray-700/60 text-gray-700 dark:text-gray-200 font-semibold border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-3 sm:px-4 py-3 w-12">#</th>
              <th className="px-3 sm:px-4 py-3 min-w-[180px]">Segment Name</th>
              <th className="px-3 sm:px-4 py-3 min-w-[220px]">Description</th>
              <th className="px-3 sm:px-4 py-3 text-center whitespace-nowrap">Leads</th>
              <th className="px-3 sm:px-4 py-3 text-center whitespace-nowrap">Status</th>
              <th className="px-3 sm:px-4 py-3 whitespace-nowrap">Created By</th>
              <th className="px-3 sm:px-4 py-3 whitespace-nowrap">Created Date</th>
              {isSegmentAdmin && (
                <th className="px-3 sm:px-4 py-3 text-center whitespace-nowrap min-w-[100px]">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td
                  colSpan={isSegmentAdmin ? 8 : 7}
                  className="text-center py-8 text-gray-500 dark:text-gray-400"
                >
                  <div className="flex items-center justify-center gap-2">
                    <FaSyncAlt className="animate-spin text-blue-500" />
                    <span>Loading segments...</span>
                  </div>
                </td>
              </tr>
            ) : filteredSegments.length === 0 ? (
              <tr>
                <td
                  colSpan={isSegmentAdmin ? 8 : 7}
                  className="text-center py-8 text-gray-500 dark:text-gray-400"
                >
                  {searchTerm || statusFilter !== "all"
                    ? "No segments match your filter criteria."
                    : "No segments found."}
                </td>
              </tr>
            ) : (
              filteredSegments.map((seg, idx) => (
                <tr
                  key={seg.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/60 transition"
                >
                  <td className="px-3 sm:px-4 py-3 text-gray-400 font-mono text-xs">
                    {idx + 1}
                  </td>
                  <td className="px-3 sm:px-4 py-3 font-semibold text-gray-900 dark:text-white">
                    <span className="inline-flex items-center gap-1.5">
                      <FaLayerGroup className="text-blue-500 text-xs flex-shrink-0" />
                      <span>{seg.name}</span>
                    </span>
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-xs text-gray-600 dark:text-gray-300 max-w-[300px] break-words">
                    {seg.description || <span className="text-gray-400 italic">—</span>}
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200">
                      {seg.lead_count ?? 0}
                    </span>
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-center whitespace-nowrap">
                    {seg.is_active ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                        <FaCheckCircle className="text-[10px]" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                        <FaTimesCircle className="text-[10px]" />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {seg.created_by_name || <span className="text-gray-400">System</span>}
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {seg.created_at ? new Date(seg.created_at).toLocaleDateString() : "—"}
                  </td>
                  {isSegmentAdmin && (
                    <td className="px-3 sm:px-4 py-3 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(seg)}
                          title="Edit Segment"
                          aria-label={`Edit ${seg.name}`}
                          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded-md transition"
                        >
                          <FaRegEdit className="text-sm" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDelete(seg)}
                          title="Delete Segment"
                          aria-label={`Delete ${seg.name}`}
                          className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 rounded-md transition"
                        >
                          <FaRegTrashAlt className="text-sm" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Segment Modal (Strict Admin Only) */}
      {isSegmentAdmin && showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700 overflow-hidden my-auto">
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FaLayerGroup className="text-blue-500" />
                <span>{editingSegment ? "Edit Segment" : "Add New Segment"}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowFormModal(false);
                  setEditingSegment(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSaveSegment} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Segment Name *
                </label>
                <input
                  type="text"
                  required
                  maxLength={255}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. NR IPHONE CCTV"
                  className={`w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 ${duplicateValidation.hasActiveConflict && (!editingSegment || formData.is_active)
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                    }`}
                  autoFocus
                />
                {duplicateValidation.hasActiveConflict && (!editingSegment || formData.is_active) && (
                  <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                    Segment "{duplicateValidation.trimmed}" already exists and is Active. Only one Active segment with the same name is allowed.
                  </p>
                )}
                {!editingSegment && !duplicateValidation.hasActiveConflict && duplicateValidation.hasInactiveMatch && (
                  <p className="mt-1.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                    An Inactive segment named "{duplicateValidation.trimmed}" exists. Saving will create a new Active segment while preserving the inactive record.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  rows="3"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description for this segment..."
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900/70 border border-gray-200 dark:border-gray-700">
                <div>
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 block">
                    Active Segment
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    Active segments appear in the Manual Lead Generation dropdown.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={!editingSegment && duplicateValidation.hasInactiveMatch ? true : formData.is_active}
                  disabled={!editingSegment && duplicateValidation.hasInactiveMatch}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 text-blue-600 rounded cursor-pointer disabled:opacity-60"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowFormModal(false);
                    setEditingSegment(null);
                  }}
                  className="px-4 py-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm disabled:opacity-50 transition"
                >
                  {saving ? "Saving..." : editingSegment ? "Update Segment" : "Create Segment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Strict Admin Only) */}
      {isSegmentAdmin && showDeleteModal && segmentToDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-xl shadow-2xl w-full max-w-sm my-auto border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-3">
              <FaExclamationTriangle className="text-lg" />
              <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                Delete Segment?
              </h4>
            </div>
            <p className="mb-3 text-xs sm:text-sm text-gray-600 dark:text-gray-300">
              Are you sure you want to delete segment <strong>{segmentToDelete.name}</strong>?
            </p>
            {segmentToDelete.lead_count > 0 && (
              <p className="mb-4 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5">
                {segmentToDelete.lead_count} existing lead(s) currently use this segment. Existing leads will not be deleted, but this segment will no longer be selectable as a managed segment.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setSegmentToDelete(null);
                }}
                className="px-3 sm:px-4 py-1.5 text-xs sm:text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-3 sm:px-4 py-1.5 text-xs sm:text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

