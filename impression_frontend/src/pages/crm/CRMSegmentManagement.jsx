import React, { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "react-toastify";
import {
  FaLayerGroup, FaPlus, FaSearch, FaEdit, FaTrash,
  FaCheck, FaTimes, FaSpinner, FaExchangeAlt, FaShieldAlt
} from "react-icons/fa";
import BASE_URL from "../config";
import axiosInstance from "../axiosconfig";

const EMPTY_FORM = {
  name: "",
  description: "",
  is_active: true,
};

export default function CRMSegmentManagement({ user: propUser }) {
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [canManage, setCanManage] = useState(false);

  // Add / Edit Modal
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingSegment, setEditingSegment] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Safe Deletion Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [segmentToDelete, setSegmentToDelete] = useState(null);
  const [deleteAction, setDeleteAction] = useState("UNASSIGNED"); // 'MOVED' or 'UNASSIGNED'
  const [targetSegmentId, setTargetSegmentId] = useState("");
  const [deleting, setDeleting] = useState(false);

  const fetchSegments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`${BASE_URL}/api/crm/segments/`, {
        params: { search, status: statusFilter },
      });
      setSegments(res.data.segments || []);
      setCanManage(res.data.can_manage || false);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to load segments.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchSegments();
  }, [fetchSegments]);

  // Duplicate active validation logic
  const duplicateValidation = useMemo(() => {
    const trimmed = (formData.name || "").trim();
    if (!trimmed) {
      return { hasActiveConflict: false, hasInactiveMatch: false, trimmed: "" };
    }
    const lower = trimmed.toLowerCase();
    const excludeId = editingSegment?.id;

    const hasActiveConflict = segments.some(
      (s) =>
        Boolean(s.is_active) &&
        (s.name || "").trim().toLowerCase() === lower &&
        s.id !== excludeId
    );

    const hasInactiveMatch = segments.some(
      (s) =>
        !s.is_active &&
        (s.name || "").trim().toLowerCase() === lower &&
        s.id !== excludeId
    );

    return { hasActiveConflict, hasInactiveMatch, trimmed };
  }, [formData.name, segments, editingSegment]);

  const handleOpenAdd = () => {
    setEditingSegment(null);
    setFormData(EMPTY_FORM);
    setShowFormModal(true);
  };

  const handleOpenEdit = (segment) => {
    setEditingSegment(segment);
    setFormData({
      name: segment.name || "",
      description: segment.description || "",
      is_active: segment.is_active !== false,
    });
    setShowFormModal(true);
  };

  const handleSaveSegment = async (e) => {
    e.preventDefault();
    const trimmedName = (formData.name || "").trim();
    if (!trimmedName) {
      toast.warning("Please enter a segment name.");
      return;
    }

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
      fetchSegments();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save segment.");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDelete = (segment) => {
    setSegmentToDelete(segment);
    setDeleteAction("UNASSIGNED");
    setTargetSegmentId("");
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!segmentToDelete) return;
    if (deleteAction === "MOVED" && !targetSegmentId) {
      toast.warning("Please select a target segment to move the leads to.");
      return;
    }

    setDeleting(true);
    try {
      const res = await axiosInstance.post(
        `${BASE_URL}/api/crm/segments/${segmentToDelete.id}/safe-delete/`,
        {
          action: deleteAction,
          target_segment_id: targetSegmentId || null,
        }
      );
      toast.success(res.data.message || "Segment deleted safely.");
      setShowDeleteModal(false);
      setSegmentToDelete(null);
      fetchSegments();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete segment.");
    } finally {
      setDeleting(false);
    }
  };

  const otherActiveSegments = useMemo(() => {
    if (!segmentToDelete) return [];
    return segments.filter((s) => s.id !== segmentToDelete.id && s.is_active);
  }, [segments, segmentToDelete]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <FaLayerGroup className="text-blue-600" />
            Segment Management
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Organize leads by segments, track lead counts, and execute safe deletions with lead migration.
          </p>
        </div>
        {canManage && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition"
          >
            <FaPlus />
            Add Segment
          </button>
        )}
      </div>

      {/* Search & Filter */}
      <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <FaSearch className="absolute left-3 top-3 text-gray-400 text-xs" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search segments by name or description..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
        >
          <option value="">All Statuses</option>
          <option value="Active">Active Segments</option>
          <option value="Inactive">Inactive Segments</option>
        </select>
      </div>

      {/* Segments Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 flex justify-center items-center gap-2">
            <FaSpinner className="animate-spin text-blue-600" />
            Loading segments...
          </div>
        ) : segments.length === 0 ? (
          <div className="p-8 text-center text-gray-400 italic">No segments found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 uppercase tracking-wider font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-4">Segment Name</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-center">Total Leads</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Created Date</th>
                  {canManage && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {segments.map((seg) => (
                  <tr key={seg.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-750 transition">
                    <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">
                      {seg.name}
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs max-w-sm truncate">
                      {seg.description || "—"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                        {seg.total_leads || 0} leads
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-2xs font-semibold ${
                        seg.is_active
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                      }`}>
                        {seg.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs">
                      {seg.created_at ? new Date(seg.created_at).toLocaleDateString() : "—"}
                    </td>
                    {canManage && (
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenEdit(seg)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-700 rounded transition"
                          title="Edit Segment"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(seg)}
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-gray-700 rounded transition"
                          title="Safe Delete Segment"
                        >
                          <FaTrash />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: Add / Edit Segment */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                {editingSegment ? "Edit Segment" : "Add New Segment"}
              </h3>
              <button onClick={() => setShowFormModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSaveSegment} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Segment Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. CCTV & Surveillance"
                  className={`w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 ${
                    duplicateValidation.hasActiveConflict && (!editingSegment || formData.is_active)
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                  }`}
                  autoFocus
                />
                {duplicateValidation.hasActiveConflict && (!editingSegment || formData.is_active) && (
                  <p className="mt-1 text-2xs font-semibold text-red-600 dark:text-red-400">
                    Segment "{duplicateValidation.trimmed}" already exists and is Active.
                  </p>
                )}
                {!editingSegment && !duplicateValidation.hasActiveConflict && duplicateValidation.hasInactiveMatch && (
                  <p className="mt-1 text-2xs font-semibold text-blue-600 dark:text-blue-400">
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
                  placeholder="Optional description of this segment..."
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700">
                <div>
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 block">Active Status</span>
                  <span className="text-[11px] text-gray-500">Active segments appear in lead creation & filters</span>
                </div>
                <input
                  type="checkbox"
                  checked={!editingSegment && duplicateValidation.hasInactiveMatch ? true : formData.is_active}
                  disabled={!editingSegment && duplicateValidation.hasInactiveMatch}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 text-blue-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || (duplicateValidation.hasActiveConflict && (!editingSegment || formData.is_active))}
                  className="px-5 py-2 text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingSegment ? "Save Changes" : "Create Segment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Important Safe Segment Deletion Modal */}
      {showDeleteModal && segmentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center gap-3 text-red-600 pb-3 border-b border-gray-200 dark:border-gray-700">
              <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-xl">
                <FaTrash className="text-lg" />
              </div>
              <div>
                <h4 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">Delete Segment</h4>
                <p className="text-xs text-gray-500">Zero Lead Deletion Guarantee</p>
              </div>
            </div>

            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 text-xs space-y-1">
              <span className="font-bold text-amber-900 dark:text-amber-200 block">
                Associated Leads: {segmentToDelete.total_leads || 0} leads
              </span>
              <p className="text-amber-800 dark:text-amber-300">
                You are about to delete segment <strong>"{segmentToDelete.name}"</strong>. The associated lead records will <strong>never be deleted</strong>.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
                What would you like to do with the associated leads?
              </label>

              <div className="space-y-2 text-xs sm:text-sm">
                <label className="flex items-start gap-2.5 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750">
                  <input
                    type="radio"
                    name="deleteAction"
                    value="UNASSIGNED"
                    checked={deleteAction === "UNASSIGNED"}
                    onChange={() => setDeleteAction("UNASSIGNED")}
                    className="mt-0.5 text-blue-600"
                  />
                  <div>
                    <span className="font-semibold text-gray-900 dark:text-white block">Keep all leads without any segment (Unassigned)</span>
                    <span className="text-gray-500 text-xs">Leads will remain in the CRM under 'Unassigned'.</span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750">
                  <input
                    type="radio"
                    name="deleteAction"
                    value="MOVED"
                    checked={deleteAction === "MOVED"}
                    onChange={() => setDeleteAction("MOVED")}
                    className="mt-0.5 text-blue-600"
                  />
                  <div className="flex-1">
                    <span className="font-semibold text-gray-900 dark:text-white block">Move all leads to another existing segment</span>
                    <span className="text-gray-500 text-xs block mb-2">Reassign all associated leads to another active segment.</span>

                    {deleteAction === "MOVED" && (
                      <select
                        value={targetSegmentId}
                        onChange={(e) => setTargetSegmentId(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white mt-1"
                      >
                        <option value="">Select destination segment...</option>
                        {otherActiveSegments.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting || (deleteAction === "MOVED" && !targetSegmentId)}
                className="px-5 py-2 text-xs sm:text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Confirm Safe Deletion"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

