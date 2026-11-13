import React, { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "react-toastify";
import {
  FaUserShield, FaPlus, FaSearch, FaEdit, FaTrash,
  FaKey, FaCheck, FaTimes, FaSpinner, FaFilter,
  FaUserCheck, FaUserTimes, FaLock, FaSyncAlt
} from "react-icons/fa";
import BASE_URL from "../config";
import axiosInstance from "../axiosconfig";

const EMPTY_USER = {
  username: "",
  password: "",
  first_name: "",
  last_name: "",
  email: "",
  mobile: "",
  role: "Sales Executive",
  reporting_manager_id: "",
  approval_required: false,
  account_status: "Active",
};

const MODULE_LIST = [
  { key: "dashboard", label: "CRM Dashboard" },
  { key: "users", label: "User & Role Management" },
  // Temporarily hidden: Login Approval & Access Logs not in current release
  // { key: "access_logs", label: "Login Approval & Access Logs" },
  { key: "segments", label: "Segment Management" },
  { key: "leads", label: "Lead Management" },
  { key: "assignments", label: "Lead Assignment" },
  { key: "tasks", label: "Task Management" },
  { key: "my_work", label: "My Work Dashboard" },
  { key: "reports", label: "Performance Reports" },
  { key: "quick_search", label: "Quick Lead Search" },
];

const ACTION_LIST = [
  { key: "view", label: "View" },
  { key: "create", label: "Create" },
  { key: "edit", label: "Edit" },
  { key: "delete", label: "Delete" },
  { key: "import", label: "Import" },
  { key: "export", label: "Export" },
  { key: "assign", label: "Assign" },
  { key: "approve", label: "Approve" },
  { key: "reports", label: "Reports" },
];

export default function CRMUserManagement({ user: propUser }) {
  const [users, setUsers] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [availableManagers, setAvailableManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modals
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState(EMPTY_USER);
  const [saving, setSaving] = useState(false);

  // Role & Permissions Modal
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [selectedRoleForPerms, setSelectedRoleForPerms] = useState("");
  const [permissionsMatrix, setPermissionsMatrix] = useState({});
  const [savingPerms, setSavingPerms] = useState(false);

  // Password Reset Modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordTargetUser, setPasswordTargetUser] = useState(null);
  const [newPassword, setNewPassword] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`${BASE_URL}/api/crm/users/`, {
        params: { search, role: roleFilter, status: statusFilter },
      });
      setUsers(res.data.users || []);
      setAvailableRoles(res.data.available_roles || []);
      setAvailableManagers(res.data.available_managers || []);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to load staff list.");
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter]);

  const fetchRolesAndPermissions = useCallback(async () => {
    try {
      const res = await axiosInstance.get(`${BASE_URL}/api/crm/roles/`);
      setPermissionsMatrix(res.data.permissions_matrix || {});
      if (res.data.roles && res.data.roles.length > 0 && !selectedRoleForPerms) {
        setSelectedRoleForPerms(res.data.roles[0].role);
      }
    } catch (err) {
      // silent
    }
  }, [selectedRoleForPerms]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormData(EMPTY_USER);
    setShowUserModal(true);
  };

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setFormData({
      username: user.username || "",
      password: "",
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      mobile: user.mobile || "",
      role: user.role || "Sales Executive",
      reporting_manager_id: user.reporting_manager_id || "",
      approval_required: Boolean(user.approval_required),
      account_status: user.account_status || "Active",
    });
    setShowUserModal(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingUser) {
        await axiosInstance.put(`${BASE_URL}/api/crm/users/${editingUser.id}/`, formData);
        toast.success("User updated successfully.");
      } else {
        await axiosInstance.post(`${BASE_URL}/api/crm/users/`, formData);
        toast.success("User created successfully.");
      }
      setShowUserModal(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save user.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (user) => {
    const nextStatus = user.account_status.toLowerCase() === "active" ? "Inactive" : "Active";
    try {
      await axiosInstance.patch(`${BASE_URL}/api/crm/users/${user.id}/`, { account_status: nextStatus });
      toast.success(`User set to ${nextStatus}.`);
      fetchUsers();
    } catch (err) {
      toast.error("Failed to update status.");
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    try {
      await axiosInstance.patch(`${BASE_URL}/api/crm/users/${passwordTargetUser.id}/`, { password: newPassword });
      toast.success("Password updated successfully.");
      setShowPasswordModal(false);
      setNewPassword("");
    } catch (err) {
      toast.error("Failed to reset password.");
    }
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    try {
      await axiosInstance.post(`${BASE_URL}/api/crm/roles/`, { role: newRoleName.trim() });
      toast.success(`Role '${newRoleName}' created.`);
      setNewRoleName("");
      fetchRolesAndPermissions();
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create role.");
    }
  };

  const handleTogglePermission = (moduleKey, actionKey) => {
    const permKey = `${moduleKey}.${actionKey}`;
    const rolePerms = { ...(permissionsMatrix[selectedRoleForPerms] || {}) };
    rolePerms[permKey] = !rolePerms[permKey];

    setPermissionsMatrix({
      ...permissionsMatrix,
      [selectedRoleForPerms]: rolePerms,
    });
  };

  const handleSavePermissions = async () => {
    setSavingPerms(true);
    try {
      await axiosInstance.post(`${BASE_URL}/api/crm/permissions/save/`, {
        target_type: "role",
        target_id: selectedRoleForPerms,
        permissions: permissionsMatrix[selectedRoleForPerms] || {},
      });
      toast.success(`Permissions saved for role '${selectedRoleForPerms}'.`);
    } catch (err) {
      toast.error("Failed to save permissions.");
    } finally {
      setSavingPerms(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <FaUserShield className="text-blue-600" />
            User & Role Management
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Create, edit, activate/deactivate staff, and configure module-level permissions matrix.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchRolesAndPermissions();
              setShowRoleModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-100 transition"
          >
            <FaUserShield />
            Role & Permissions Matrix
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition"
          >
            <FaPlus />
            Add Staff Member
          </button>
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
            placeholder="Search by name, username, mobile, role..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
        >
          <option value="">All Roles</option>
          {availableRoles.map((r, i) => (
            <option key={i} value={r}>{r}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
        >
          <option value="">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 flex justify-center items-center gap-2">
            <FaSpinner className="animate-spin text-blue-600" />
            Loading staff members...
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-gray-400 italic">No staff members found matching criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 uppercase tracking-wider font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-4">Staff Name</th>
                  <th className="py-3 px-4">Username</th>
                  <th className="py-3 px-4">Mobile</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Reporting Manager</th>
                  {/* Temporarily hidden: Login Approval not required in current release */}
                  {/* <th className="py-3 px-4 text-center">Approval Req.</th> */}
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-750 transition">
                    <td className="py-3 px-4 font-semibold text-gray-900 dark:text-white">
                      {u.full_name}
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300 font-mono text-xs">
                      {u.username}
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300">
                      {u.mobile || "—"}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300">
                      {u.reporting_manager_name || "—"}
                    </td>
                    {/* Temporarily hidden: Login Approval not required in current release */}
                    {/* <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-2xs font-bold ${u.approval_required ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                        }`}>
                        {u.approval_required ? "Yes" : "No"}
                      </span>
                    </td> */}
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleToggleStatus(u)}
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold cursor-pointer transition ${u.account_status.toLowerCase() === "active"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 hover:bg-emerald-200"
                            : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 hover:bg-red-200"
                          }`}
                        title="Click to toggle status"
                      >
                        {u.account_status}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenEdit(u)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-700 rounded transition"
                        title="Edit User"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => {
                          setPasswordTargetUser(u);
                          setShowPasswordModal(true);
                        }}
                        className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-gray-700 rounded transition"
                        title="Reset Password"
                      >
                        <FaKey />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: Add / Edit User */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                {editingUser ? "Edit Staff Member" : "Add New Staff Member"}
              </h3>
              <button onClick={() => setShowUserModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Username</label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingUser)}
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Mobile Number</label>
                  <input
                    type="text"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    placeholder="10-digit mobile"
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  >
                    {availableRoles.map((r, i) => (
                      <option key={i} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Reporting Manager</label>
                  <select
                    value={formData.reporting_manager_id}
                    onChange={(e) => setFormData({ ...formData, reporting_manager_id: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  >
                    <option value="">None (Top Level)</option>
                    {availableManagers.filter(m => !editingUser || m.id !== editingUser.id).map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Temporarily hidden: Login Approval not required in current release */}
              {/* <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700">
                <div>
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 block">Approval Required</span>
                  <span className="text-[11px] text-gray-500">Requires administrative approval for CRM access</span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.approval_required}
                  onChange={(e) => setFormData({ ...formData, approval_required: e.target.checked })}
                  className="h-4 w-4 text-blue-600 rounded cursor-pointer"
                />
              </div> */}

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingUser ? "Save Changes" : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Role & Permissions Matrix */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl border border-gray-200 dark:border-gray-700 overflow-hidden my-auto max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900 flex-shrink-0">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FaUserShield className="text-indigo-600" />
                Role & Permissions Matrix
              </h3>
              <button onClick={() => setShowRoleModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                <FaTimes />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Create Custom Role */}
              <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs sm:text-sm">
                  <span className="font-bold text-indigo-900 dark:text-indigo-200 block">Create Custom Role</span>
                  <span className="text-gray-500 dark:text-gray-400 text-xs">Define a new staff role in the CRM.</span>
                </div>
                <form onSubmit={handleCreateRole} className="flex gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    required
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="e.g. Sales Executive"
                    className="px-3 py-1.5 text-xs sm:text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button type="submit" className="px-3 py-1.5 text-xs sm:text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg whitespace-nowrap">
                    Add Role
                  </button>
                </form>
              </div>

              {/* Select Role to Configure */}
              <div className="flex items-center gap-3">
                <span className="text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-300">Configuring Role:</span>
                <select
                  value={selectedRoleForPerms}
                  onChange={(e) => setSelectedRoleForPerms(e.target.value)}
                  className="px-3 py-1.5 text-xs sm:text-sm font-semibold bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                >
                  {availableRoles.map((r, i) => (
                    <option key={i} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Permissions Checkbox Grid */}
              <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">
                    <tr>
                      <th className="py-2.5 px-3 font-bold">Module</th>
                      {ACTION_LIST.map((act) => (
                        <th key={act.key} className="py-2.5 px-2 text-center font-bold">
                          {act.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {MODULE_LIST.map((mod) => (
                      <tr key={mod.key} className="hover:bg-gray-50/50 dark:hover:bg-gray-750">
                        <td className="py-2 px-3 font-semibold text-gray-800 dark:text-gray-200">
                          {mod.label}
                        </td>
                        {ACTION_LIST.map((act) => {
                          const permKey = `${mod.key}.${act.key}`;
                          const isChecked = Boolean(permissionsMatrix[selectedRoleForPerms]?.[permKey]);
                          return (
                            <td key={act.key} className="py-2 px-2 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleTogglePermission(mod.key, act.key)}
                                className="h-4 w-4 text-indigo-600 rounded cursor-pointer"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
              <span className="text-xs text-gray-500">Changes apply to all staff members with the '{selectedRoleForPerms}' role.</span>
              <button
                onClick={handleSavePermissions}
                disabled={savingPerms}
                className="px-5 py-2 text-xs sm:text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50"
              >
                {savingPerms ? "Saving..." : "Save Role Permissions"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Password Reset */}
      {showPasswordModal && passwordTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-200 dark:border-gray-700">
            <h4 className="text-base font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <FaKey className="text-amber-500" />
              Reset Password
            </h4>
            <p className="text-xs text-gray-500 mb-4">
              Enter a new secure password for <strong>{passwordTargetUser.full_name}</strong>.
            </p>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 6 chars)"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
                >
                  Save Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

