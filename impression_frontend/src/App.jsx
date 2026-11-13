
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import MainLayout from "./pages/MainLayout";
import UserDetailsForm from "./pages/UserDetailsForm";
import ProductPage from "./pages/ProductPage";
import WarehouseList from "./pages/WarehouseList";
import AddWarehouse from "./pages/AddWarehouse";
import UserWarehouse from "./pages/UserWarehouse";
import ProductWarehouse from "./pages/ProductWarehouse";
import UploadFile from "./pages/UploadFile";
import DataMapping from "./pages/DataMapping";
import CourierTracking from "./pages/CourierTracking";
import CampaignView from "./pages/CampaignView";
import TrackMap from "./pages/TrackMap";
import RemoveData from "./pages/RemoveData";
import AddRole from "./pages/AddRole";
import Permissions from "./pages/Permissions";
import StockCount from "./pages/StockCount";
import StockTally from "./pages/StockTally";
import EditWarehouse from "./pages/EditWarehouse";
import EditUser from "./pages/EditUsers";
import PrivateRoute from "./pages/PrivateRoute";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import CreateSuperadmin from "./pages/CreateSuperadmin";
import CreatePermission from "./pages/Create_permission";
import AddPermission from "./pages/Add_permission";
import { useRef } from "react";
import ChangePassword from "./pages/ChangePassword"
import ChartGrid from "./pages/ChartGrid";
import BASE_URL from "./pages/config";
import Companies from "./pages/Company";
import { FaAddressCard } from "react-icons/fa";
import Company from "./pages/AddCompany";
import EditCompany from "./pages/EditCompany";
import ReportDashboard from "./pages/Reports";
import ReportSettings from "./pages/ReportSettings";
import EditReport from "./pages/EditReport";
import ViewReport from "./pages/ViewReport";
import CreateReport from "./pages/CreateReport";
import StaticReport from "./pages/StaticReport";
import LeadGeneration from "./pages/LeadGeneration";
import TaskManager from "./pages/TaskManager";
import NewSegment from "./pages/NewSegment";

// Custom CRM Modules inside Lead Generation
import CRMDashboard from "./pages/crm/CRMDashboard";
import CRMUserManagement from "./pages/crm/CRMUserManagement";
import CRMAccessLogs from "./pages/crm/CRMAccessLogs";
import CRMSegmentManagement from "./pages/crm/CRMSegmentManagement";
import CRMLeadManagement from "./pages/crm/CRMLeadManagement";
import CRMLeadAssignment from "./pages/crm/CRMLeadAssignment";
import CRMTaskManagement from "./pages/crm/CRMTaskManagement";
import CRMMyWorkDashboard from "./pages/crm/CRMMyWorkDashboard";
import CRMPerformanceReports from "./pages/crm/CRMPerformanceReports";
import CRMQuickLeadSearch from "./pages/crm/CRMQuickLeadSearch";

export default function App() {
  const [user, setUser] = useState(null);
  const [showPrevDate, setShowPrevDate] = useState(false);
  const [showPrevDateUser, setShowPrevDateUser] = useState(false);
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("darkMode") === "true"
  );



  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("darkMode", darkMode);
  }, [darkMode]);

  useEffect(() => {
    const fetchInitialData = async () => {
      const token = localStorage.getItem("authToken");
      if (!token) return;

      try {
        // Fetch show-prev-date settings
        const settingsRes = await fetch(`${BASE_URL}/api/show-prev-date/`, {
          headers: {
            Authorization: `token ${token}`,
          },
        });

        if (!settingsRes.ok) {
          if (settingsRes.status === 401) {
            localStorage.removeItem("authToken");
            localStorage.removeItem("userRole");
            return;
          }
          console.warn("Could not load settings:", settingsRes.statusText);
        } else {
          const settingsData = await settingsRes.json();

          const userSetting = settingsData.find((s) => s.name === "show_prev_date_user");
          const adminSetting = settingsData.find((s) => s.name === "show_prev_date");

          if (userSetting) {
            const userValue = userSetting.show === true || userSetting.show === "true";
            setShowPrevDateUser(userValue);
          }

          if (adminSetting) {
            const adminValue = adminSetting.show === true || adminSetting.show === "true";
            setShowPrevDate(adminValue);
          }
        }

        // Fetch logged-in user info
        const userRes = await fetch(`${BASE_URL}/api/users/me/`, {
          headers: {
            Authorization: `token ${token}`,
          },
        });

        if (!userRes.ok) {
          if (userRes.status === 401) {
            localStorage.removeItem("authToken");
            localStorage.removeItem("userRole");
            return;
          }
          console.warn("Could not load user info:", userRes.statusText);
        } else {
          const userData = await userRes.json();
          setUser(userData);
        }
      } catch (error) {
        console.error("Error during initial fetch:", error);
      }
    };

    fetchInitialData();
  }, []);
  const allowedUserPaths = ["/stock-count", "/upload-excel", "/data-mapping", "/change-password", '/dashboard', '/campaigns/:id', '/campaign', '/new-segment', '/courier-tracking', '/track-map', '/report-dashboard', '/reports/:id', '/static-report', '/lead-generation', '/task-manager'];
  const allowedtechadminPaths = ["/users", "/create-report", "/reports/:id", "/edit-report/:id", "/create-permission", "/add-permission", '/dashboard', '/add-role', '/edit-user/:id', '/add-user', '/company', '/add-company', '/companies/edit/:id', '/report-dashboard', '/report-settings', "static-report", '/new-segment', '/lead-generation', '/task-manager'];
  const adminAllowedPaths = [
    "/dashboard",
    "/users",
    "/add-user",
    "/edit-user/:id",
    "/product",
    "/warehouse",
    "/edit-warehouse/:id",
    "/add-warehouse",
    "/user-warehouse",
    "/product-warehouse",
    "/upload-excel",
    "/stock-count",
    "/stock-tally",
    "/change-password",
    "/data-mapping",
    "/campaign",
    "/new-segment",
    "/courier-tracking",
    "/campaigns/:id",
    "/track-map",
    "/lead-generation",
    "/task-manager",
  ];

  // Ensure techadmin and user lists contain campaign where appropriate
  allowedtechadminPaths.push('/data-mapping', '/campaign', '/courier-tracking');
  allowedUserPaths && allowedUserPaths.push && allowedUserPaths.push('/campaign', '/courier-tracking');


  const RestrictedRoute = ({ children, path }) => {
    const location = useLocation();
    const hasWarnedRef = useRef(false);
    const token = localStorage.getItem("authToken");
    const storedRole = localStorage.getItem("userRole") || "";
    const rawRole = (user?.role || storedRole || "").trim().toLowerCase();
    const normalizedRole = rawRole.replace(/[\s_-]+/g, "");

    // Explicit check for Lead Generation / CRM modules: Accessible to all authorized logged-in users
    if (path && (path.startsWith("/lead-generation") || path === "/lead-generation" || path === "/task-manager" || path === "/new-segment")) {
      return children;
    }

    if (normalizedRole === "user" && !allowedUserPaths.includes(path)) {
      if (!hasWarnedRef.current) {
        toast.error("Unauthorized Access!", {
          position: "top-right",
          autoClose: 3000,
        });
        hasWarnedRef.current = true;
      }
      return <Navigate to="/dashboard" replace />;
    }

    if (normalizedRole === "techadmin" && !allowedtechadminPaths.includes(path)) {
      if (!hasWarnedRef.current) {
        toast.error("Access Denied!", {
          position: "top-right",
          autoClose: 3000,
        });
        hasWarnedRef.current = true;
      }
      return <Navigate to="/dashboard" replace />;
    }

    if (normalizedRole === "admin" && !adminAllowedPaths.includes(path)) {
      if (!hasWarnedRef.current) {
        toast.error("Access Denied!", {
          position: "top-right",
          autoClose: 3000,
        });
        hasWarnedRef.current = true;
      }
      return <Navigate to="/dashboard" replace />;
    }

    return children;
  };


  return (
    <Router>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
        <ToastContainer position="top-right" autoClose={3000} />
        <Routes>
          <Route
            path="/"
            element={
              user ? <Navigate to="/dashboard" replace /> : <Login setUser={setUser} user={user} />
            }
          />

          <Route
            path="/"
            element={
              <PrivateRoute>
                <MainLayout user={user} />
              </PrivateRoute>
            }
          >
            <Route path="dashboard" element={<RestrictedRoute path="/dashboard"><Dashboard user={user} /></RestrictedRoute>} />
            <Route path="users" element={<RestrictedRoute path="/users"><Users /></RestrictedRoute>} />
            <Route path="add-user" element={<RestrictedRoute path="/add-user"><UserDetailsForm /></RestrictedRoute>} />
            <Route path="product" element={<RestrictedRoute path="/product"><ProductPage /></RestrictedRoute>} />
            <Route path="warehouse" element={<RestrictedRoute path="/warehouse"><WarehouseList /></RestrictedRoute>} />
            <Route path="add-warehouse" element={<RestrictedRoute path="/add-warehouse"><AddWarehouse /></RestrictedRoute>} />
            <Route path="user-warehouse" element={<RestrictedRoute path="/user-warehouse"><UserWarehouse /></RestrictedRoute>} />
            <Route path="product-warehouse" element={<RestrictedRoute path="/product-warehouse"><ProductWarehouse /></RestrictedRoute>} />
            <Route path="upload-excel" element={<UploadFile user={user} />} />
            <Route path="data-mapping" element={<RestrictedRoute path="/data-mapping"><DataMapping /></RestrictedRoute>} />
            <Route path="campaign" element={<RestrictedRoute path="/campaign"><CampaignView /></RestrictedRoute>} />

            {/* Custom CRM Modules inside Lead Generation */}
            <Route path="lead-generation/dashboard" element={<RestrictedRoute path="/lead-generation/dashboard"><CRMDashboard user={user} /></RestrictedRoute>} />
            <Route path="lead-generation/users" element={<RestrictedRoute path="/lead-generation/users"><CRMUserManagement user={user} /></RestrictedRoute>} />
            {/* Temporarily hidden: Login Approval & Access Logs not required in current release */}
            <Route path="lead-generation/access-logs" element={<Navigate to="/lead-generation/dashboard" replace />} />
            {/* <Route path="lead-generation/access-logs" element={<RestrictedRoute path="/lead-generation/access-logs"><CRMAccessLogs user={user} /></RestrictedRoute>} /> */}
            <Route path="lead-generation/segments" element={<RestrictedRoute path="/lead-generation/segments"><CRMSegmentManagement user={user} /></RestrictedRoute>} />
            <Route path="lead-generation/leads" element={<RestrictedRoute path="/lead-generation/leads"><CRMLeadManagement user={user} /></RestrictedRoute>} />
            <Route path="lead-generation/assignments" element={<RestrictedRoute path="/lead-generation/assignments"><CRMLeadAssignment user={user} /></RestrictedRoute>} />
            <Route path="lead-generation/tasks" element={<RestrictedRoute path="/lead-generation/tasks"><CRMTaskManagement user={user} /></RestrictedRoute>} />
            <Route path="lead-generation/my-work" element={<RestrictedRoute path="/lead-generation/my-work"><CRMMyWorkDashboard user={user} /></RestrictedRoute>} />
            <Route path="lead-generation/reports" element={<RestrictedRoute path="/lead-generation/reports"><CRMPerformanceReports user={user} /></RestrictedRoute>} />
            <Route path="lead-generation/quick-search" element={<RestrictedRoute path="/lead-generation/quick-search"><CRMQuickLeadSearch user={user} /></RestrictedRoute>} />

            {/* Backward-compatible redirects */}
            <Route path="lead-generation" element={<Navigate to="/lead-generation/dashboard" replace />} />
            <Route path="task-manager" element={<Navigate to="/lead-generation/my-work" replace />} />
            <Route path="new-segment" element={<Navigate to="/lead-generation/segments" replace />} />
            <Route
              path="courier-tracking"
              element={
                <RestrictedRoute path="/courier-tracking">
                  <CourierTracking showOnlyActive={true} />
                </RestrictedRoute>
              }
            />

            <Route path="campaigns/:id" element={<RestrictedRoute path="/campaigns/:id"><CampaignView /></RestrictedRoute>} />
            <Route path="track-map" element={<RestrictedRoute path="/track-map"><TrackMap /></RestrictedRoute>} />
            <Route path="remove-data" element={<RestrictedRoute path="/remove-data"><RemoveData /></RestrictedRoute>} />
            <Route path="add-role" element={<RestrictedRoute path="/add-role"><AddRole /></RestrictedRoute>} />
            <Route path="report-dashboard" element={<RestrictedRoute path="/report-dashboard"><ReportDashboard /></RestrictedRoute>} />

            <Route path="permissions" element={<RestrictedRoute path="/permissions"><Permissions user={user} /></RestrictedRoute>} />
            <Route path="create-superadmin" element={<RestrictedRoute path="/create-superadmin"><CreateSuperadmin user={user} /></RestrictedRoute>} />
            <Route path="stock-count" element={
              <StockCount
                user={user}
                showPrevDate={showPrevDate}
                showPrevDateUser={showPrevDateUser}
                setShowPrevDate={setShowPrevDate}
                setShowPrevDateUser={setShowPrevDateUser}
              />
            } />
            <Route path="stock-tally" element={<RestrictedRoute path="/stock-tally"><StockTally /></RestrictedRoute>} />
            <Route path="company" element={<RestrictedRoute path="/company"><Companies /></RestrictedRoute>} />

            <Route path="edit-warehouse/:id" element={<RestrictedRoute path="/edit-warehouse/:id"><EditWarehouse /></RestrictedRoute>} />
            <Route path="create-permission" element={<RestrictedRoute path="/create-permission"><CreatePermission /></RestrictedRoute>} />
            <Route path="add-permission" element={<RestrictedRoute path="/add-permission"><AddPermission /></RestrictedRoute>} />
            <Route path="add-company" element={<RestrictedRoute path="/add-company"><Company /></RestrictedRoute>} />
            <Route path="report-settings" element={<RestrictedRoute path="/report-settings"><ReportSettings /></RestrictedRoute>} />
            <Route path="reports/:id" element={<RestrictedRoute path="/reports/:id"><ViewReport /></RestrictedRoute>} />
            <Route path="edit-report/:id" element={<RestrictedRoute path="/edit-report/:id"><EditReport /></RestrictedRoute>} />
            <Route path="create-report" element={<RestrictedRoute path="/create-report"><CreateReport /></RestrictedRoute>} />
            <Route path="static-report" element={<RestrictedRoute path="/static-report"><StaticReport /></RestrictedRoute>} />





            <Route
              path="companies/edit/:id"
              element={
                <RestrictedRoute path="/companies/edit/:id">
                  <EditCompany />
                </RestrictedRoute>
              }
            />

            <Route path="edit-user/:id" element={<RestrictedRoute path="/edit-user/:id"><EditUser /></RestrictedRoute>} />
            <Route path="change-password" element={<RestrictedRoute path="/change-password"><ChangePassword /></RestrictedRoute>} />
            <Route path="*" element={<div className="p-8 text-center">Page Not Found</div>} />
          </Route>
        </Routes>
      </div>
    </Router>
  );
}