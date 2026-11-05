import React, { useEffect, useState } from "react";
import { Switch } from "@headlessui/react";
import { toast } from "react-hot-toast";
import axiosInstance from "./axiosconfig";
import { FaTrash } from "react-icons/fa";
import BASE_URL from "./config";


export default function PermissionsManager() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [newPermission, setNewPermission] = useState("");
  const [newPermissionCode, setNewPermissionCode] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState(null); // State for dropdown
  const [assignToAll, setAssignToAll] = useState(true); // State for toggle
  const [users, setUsers] = useState([]);
  const [rolePermissionIds, setRolePermissionIds] = useState([]);
  const [userPermissions, setUserPermissions] = useState({});

  // Fetch roles and permissions on initial load
  useEffect(() => {
    fetchPermissions();
    axiosInstance.get(`${BASE_URL}/api/roles/get`).then((res) => setRoles(res.data));
  }, []);

  // Fetch users and permissions for the selected role when the role changes
  useEffect(() => {
    if (selectedRoleId) {
      axiosInstance.get(`${BASE_URL}/api/roles/${selectedRoleId}/users/`).then((res) => setUsers(res.data));
      axiosInstance.get(`${BASE_URL}/api/get_role_permissions/${selectedRoleId}/`).then((res) => {
        setRolePermissionIds(res.data.assigned_permissions || []);
      });
    }
  }, [selectedRoleId]);

  useEffect(() => {
    if (users.length > 0) {
      loadUserOverrides();
    }
  }, [users]);

  const fetchPermissions = () => {
    axiosInstance.get(`${BASE_URL}/api/permissions/`).then((res) => setPermissions(res.data));
  };

  const createPermission = (e) => {
    e.preventDefault();
    if (!newPermission.trim() || !newPermissionCode.trim()) {
      toast.error("Both name and code are required.");
      return;
    }

    axiosInstance
      .post(`${BASE_URL}/api/permissions/`, {
        name: newPermission,
        code: newPermissionCode,
      })
      .then(() => {
        toast.success("Permission created!");
        setNewPermission("");
        setNewPermissionCode("");
        fetchPermissions();
      })
      .catch((err) => {
        toast.error("Failed to create permission.");
        console.error(err.response?.data || err.message);
      });
  };

  const deletePermission = (id) => {
    if (window.confirm("Are you sure you want to delete this permission?")) {
      axiosInstance
        .delete(`${BASE_URL}/api/permissions/${id}/`)
        .then(() => {
          toast.success("Permission deleted!");
          fetchPermissions();
        })
        .catch(() => toast.error("Failed to delete permission."));
    }
  };

  const handlePermissionToggle = (permissionId, isChecked) => {
    const updatedPermissions = isChecked
      ? [...rolePermissionIds, permissionId]
      : rolePermissionIds.filter(id => id !== permissionId);

    setRolePermissionIds(updatedPermissions);

    axiosInstance
      .post(`${BASE_URL}/api/permissions/assign/`, {
        role_id: selectedRoleId,
        permission_ids: [permissionId],
        assign_to_all_role_users: assignToAll,
      })
      .then(() => {
        toast.success(isChecked ? "Permission assigned!" : "Permission removed!");
      })
      .catch((error) => {
        toast.error("Error updating permission!");
      });
  };

  const handleUserPermissionToggle = (userId, permissionId, isChecked) => {
    const updatedPermissions = isChecked
      ? [...(userPermissions[userId] || []), permissionId]
      : userPermissions[userId]?.filter(id => id !== permissionId);

    setUserPermissions(prev => ({
      ...prev,
      [userId]: updatedPermissions,
    }));

    axiosInstance
      .post(`${BASE_URL}/api/permissions/toggle/`, {
        role_id: selectedRoleId,
        user_ids: [userId],
        permission_id: permissionId,
        allow: isChecked,
      })
      .then(() => {
        toast.success(isChecked ? "User permission assigned!" : "User permission removed!");
      })
      .catch(() => toast.error("Error updating user permission!"));
  };

  const loadUserOverrides = () => {
    const promises = users.map((user) =>
      axiosInstance.get(`${BASE_URL}/api/users/${user.id}/effective-permissions/`).then((res) => ({
        uid: user.id,
        permissions: res.data.effective_permissions || [],
      }))
    );

    Promise.all(promises).then((results) => {
      const map = {};
      results.forEach((r) => {
        map[r.uid] = r.permissions;
      });
      setUserPermissions(map);
    });
  };

  return (
    <div className="p-6 w-full space-y-6 bg-white rounded shadow ">
      <h1 className="text-2xl font-bold">Permissions Manager</h1>

      {/* Add Permission */}
      <form onSubmit={createPermission} className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input
          type="text"
          className="border p-2 rounded w-full"
          placeholder="Permission name (e.g. Edit Product)"
          value={newPermission}
          onChange={(e) => setNewPermission(e.target.value)}
        />
        <input
          type="text"
          className="border p-2 rounded w-full"
          placeholder="Permission code (e.g. edit_product)"
          value={newPermissionCode}
          onChange={(e) => setNewPermissionCode(e.target.value)}
        />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Create
        </button>
      </form>

      {/* Permissions Table */}
      <div className="bg-white shadow-md rounded overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="px-4 py-2">Permission</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {permissions.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-2">{p.name}</td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => deletePermission(p.id)}
                    className="text-red-600 hover:text-red-800"
                    title="Delete"
                  >
                    <FaTrash />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Role Selector */}
      <div>
        <label className="block font-semibold">Select Role:</label>
        <select
          className="mt-1 p-2 border rounded w-full"
          value={selectedRoleId || ""}
          onChange={(e) => setSelectedRoleId(e.target.value)}
        >
          <option value="" disabled>Select role</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>{role.role}</option>
          ))}
        </select>
      </div>

      {/* Assign to all switch */}
      <div className="flex items-center justify-between">
        <span className="font-medium">Assign to all users of role</span>
        <Switch
          checked={assignToAll}
          onChange={setAssignToAll}
          className={`${assignToAll ? "bg-blue-600" : "bg-gray-300"} relative inline-flex h-6 w-11 items-center rounded-full`}
        >
          <span className={`${assignToAll ? "translate-x-6" : "translate-x-1"} inline-block h-4 w-4 transform rounded-full bg-white transition`} />
        </Switch>
      </div>

      {/* Role or User Permissions */}
      {selectedRoleId && (
        <div className="bg-white shadow rounded p-4">
          {assignToAll ? (
            <div>
              <h2 className="font-semibold mb-2">Role Permissions</h2>
              {permissions.map((p) => (
                <label key={p.id} className="flex items-center space-x-2 mb-1">
                  <input
                    type="checkbox"
                    checked={rolePermissionIds.includes(p.id)}
                    onChange={(e) => handlePermissionToggle(p.id, e.target.checked)}
                  />
                  <span>{p.name}</span>
                </label>
              ))}
            </div>
          ) : (
            <div>
              <h2 className="font-semibold mb-2">User Permissions</h2>
              {users.map((user) => (
                <div key={user.id} className="border-b py-2">
                  <p className="font-medium">{user.username}</p>
                  <div className="pl-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {permissions.map((p) => (
                      <label key={p.id} className="flex items-center space-x-1">
                        <input
                          type="checkbox"
                          checked={userPermissions[user.id]?.includes(p.id) || false}
                          onChange={(e) => handleUserPermissionToggle(user.id, p.id, e.target.checked)}
                        />
                        <span className="text-sm">{p.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
