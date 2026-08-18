// import { Outlet, Link } from "react-router-dom";
// import { useState, useEffect } from "react";
// import {
//   FaBars, FaSignOutAlt, FaMoon, FaSun,
//   FaBox, FaChartBar, FaUsers, FaUpload, FaKey, FaDatabase,
//   FaPlus, FaCheckSquare, FaUserPlus, FaUserShield, FaTools,
//   FaTimes, FaBuilding // Added for close button
// } from "react-icons/fa";
// import axios from "axios";
// import BASE_URL from "./config";
// import logo from '../../src/impression.png'
// import { toast, ToastContainer } from "react-toastify";
// import "react-toastify/dist/ReactToastify.css";
// export default function MainLayout({ user }) {
  
//   const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
//   const [darkMode, setDarkMode] = useState(false);
//   const [permissionsOpen, setPermissionsOpen] = useState(false);
//   const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
//   const [companies, setCompanies] = useState([]); // NEW
// const [selectedCompany, setSelectedCompany] = useState(null); // NEW


// useEffect(() => {
//   const fetchUserAndCompanies = async () => {
//     const token = localStorage.getItem("authToken");
//     if (!token) return;

//     try {
//       // Step 1: Fetch user info from ${BASE_URL}/api/users/me
//       const userRes = await axios.get(`${BASE_URL}/api/users/me/`, {
//         headers: { Authorization: `Token ${token}` },
//       });
//       const currentUser = userRes.data;

//       // Store user in state or update your user context
//       // Assuming you have setUser or similar
//       // setUser(currentUser);

//       if (currentUser.role === "superadmin") {
//         // Step 2a: For superadmin, fetch all companies
//         const companiesRes = await axios.get(`${BASE_URL}/api/companies/`, {
//           headers: { Authorization: `Token ${token}` },
//         });
//         setCompanies(companiesRes.data);
//         setSelectedCompany(null); // no pre-selection, dropdown controls it
//       } else {
//         // Step 2b: For admin or user, get their single company id
//         const userCompanyId = currentUser.company; // or currentUser.companies[0] if array

//         // Step 3: Fetch that single company details (for logo)
//         const companyRes = await axios.get(
//           `${BASE_URL}/api/companies/${userCompanyId}/`,
//           {
//             headers: { Authorization: `Token ${token}` },
//           }
//         );
//         setCompanies([companyRes.data]); // optional: store array with one item
//         setSelectedCompany(companyRes.data); // auto-set selectedCompany to their company
//       }
//     } catch (error) {
//       console.error("Error fetching user or companies:", error);
//     }
//   };

//   fetchUserAndCompanies();
// }, []);

// useEffect(() => {
//   const fetchCompanies = async () => {
//     const token = localStorage.getItem("authToken");
//     if (token) {
//       try {
//         const response = await axios.get(`${BASE_URL}/api/companies/`, {
//           headers: {
//             Authorization: `Token ${token}`,
//           },
//         });
//         setCompanies(response.data);
//         if (response.data.length > 0) {
//           // setSelectedCompany(response.data[0]); // Default to first company
//         }
//       } catch (error) {
//         console.error("Error fetching companies:", error);
//       }
//     }
//   };

//   fetchCompanies();
// }, []);



//   const techadminSidebar = [
//     { icon: FaBuilding, text: "Company", path: "/company" },

//     { icon: FaUserShield, text: "Users", path: "/users" },
    
//     { 
//       icon: FaTools, 
//       text: "Permissions", 
//       path: "#", // Not needed here anymore, just for the onClick event
//       onClick: (e) => {
//         e.preventDefault(); // Prevent navigation
//         setPermissionsOpen(!permissionsOpen); // Toggle the submenu
//       },
//       subMenu: [
//         { icon: FaPlus, text: "Create Permission", path: "/create-permission" },
//         { icon: FaCheckSquare, text: "Add Permission", path: "/add-permission" },
//       ]
//     }
// ,    
//     { icon: FaUserPlus, text: "Add Role", path: "/add-role" },

//     { icon: FaDatabase, text: "Data Mapping", path: "/data-mapping" },
//     { icon: FaAddressCard, text: "Courier Tracking", path: "/courier-tracking" },

//   ];

//   const userSidebar = [
//     { icon: FaChartBar, text: "Stock Count", path: "/stock-count" },
//     { icon: FaUpload, text: "Upload Excel", path: "/upload-excel" },
//     { icon: FaKey, text: "Change Password", path: "/change-password" },
//   ];
//   { icon: FaDatabase, text: "Data Mapping", path: "/data-mapping" },
//   { icon: FaAddressCard, text: "Courier Tracking", path: "/courier-tracking" },

//   const Sidebar = [
//     { icon: FaUsers, text: "Users", path: "/users" },
//     { icon: FaUsers, text: "User - Warehouse", path: "/user-warehouse" },
//     { icon: FaBox, text: "Product", path: "/product" },
//     { icon: FaChartBar, text: "Warehouse", path: "/warehouse" },
//     { icon: FaBox, text: "Product - Warehouse", path: "/product-warehouse" },
//     { icon: FaChartBar, text: "Stock Count", path: "/stock-count" },
//     { icon: FaChartBar, text: "Stock Tally", path: "/stock-tally" },
//     { icon: FaUpload, text: "Upload Excel", path: "/upload-excel" },
//     { icon: FaDatabase, text: "Remove Data", path: "/remove-data" },
//     { icon: FaKey, text: "Change Password", path: "/change-password" },
//     { icon: FaDatabase, text: "Data Mapping", path: "/data-mapping" },
//     { icon: FaAddressCard, text: "Courier Tracking", path: "/courier-tracking" },
//   ];

//   const sidebarItems = user?.role === "techadmin" ? techadminSidebar : (user?.role === "User" ? userSidebar : Sidebar);

//   const handleLogout = async () => {
//     const token = localStorage.getItem("authToken");
//     if (token) {
//       try {
//         const response = await axios.post(
//           `${BASE_URL}/api/logout/`,
//           {},
//           {
//             headers: {
//               Authorization: `Token ${token}`,
//             },
//           }
//         );

//         if (response.status === 200) {
//           localStorage.removeItem("authToken");
//           window.location.href = "/";
//         }
//       } catch (error) {
//       }
//     }
//   };
  



//   useEffect(() => {
//     const handleResize = () => {
//       const mobile = window.innerWidth <= 768;
//       setIsMobile(mobile);
//       setSidebarOpen(!mobile); // Collapse sidebar on mobile by default
//     };

//     window.addEventListener("resize", handleResize);
//     handleResize(); // Initial check
//     return () => window.removeEventListener("resize", handleResize);
//   }, []);

//   const toggleSidebar = () => {
//     setSidebarOpen(!sidebarOpen);
//     if (permissionsOpen) setPermissionsOpen(false); // Close submenu when toggling sidebar
//   };

//   return (
//     <div className={`${darkMode ? "dark" : ""} flex flex-col min-h-screen relative`}>
//       {/* Sidebar */}
//       <div
//         className={`fixed top-0 left-0 h-screen bg-gradient-to-b from-gray-800 to-gray-900 text-white p-4 flex flex-col shadow-lg overflow-y-auto rounded-r-lg transition-transform duration-500 ease-in-out z-50
//           ${isMobile ? (sidebarOpen ? "w-3/4 translate-x-0" : "w-full -translate-x-full") : (sidebarOpen ? "w-64" : "w-17")}`}
//       >

        
//         {/* Sidebar Header (with Close Button on Mobile) */}
//         <div className="flex items-center justify-between mb-6">

//           {/* <img
//             src={logo}
//             alt="Flux Logo"
//             className={`transition-all duration-500 ease-in-out object-contain ${
//               sidebarOpen ? "w-48 h-auto opacity-100" : "w-12 h-12 opacity-80"
//             } transform ${sidebarOpen ? "scale-100" : "scale-90"} ${isMobile ? "w-48" : ""}`}
//           /> */}
//     {selectedCompany?.logo && (
//   <img
//     src={selectedCompany.logo}
//     alt="Company Logo"
//     className={`
//       transition-all duration-500 ease-in-out
//       object-contain
//       max-w-full max-h-[100px]
//       ${sidebarOpen ? "opacity-100 scale-100" : "opacity-80 scale-90"}
//       transform
//       ${isMobile ? "w-48" : "w-auto"}
//     `}
//   />
// )}



//           {isMobile && (
//             <button
//               onClick={toggleSidebar}
//               className="text-white text-2xl hover:text-white-500 transition-colors duration-300"
//             >
//               <FaTimes />
//             </button>
//           )}
//         </div>

//         <hr className="border-gray-600 mb-4" />

// {(sidebarOpen || isMobile) &&
//   user?.role === "superadmin" &&
//   user?.companies?.length >=0 && (
//     <div className="mb-4 text-sm">
//       <select
//         value={selectedCompany?.id || ""}
//         onChange={(e) => {
//           const selected = companies.find(
//             (c) => c.id === parseInt(e.target.value)
//           );
//           setSelectedCompany(selected);
//         }}
//         className="w-full bg-gray-700 text-white border border-gray-600 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
//       >
//         <option value="">Select Company</option>
//         {companies
//           .filter((company) => user.companies.includes(company.id))
//           .map((company) => (
//             <option key={company.id} value={company.id}>
//               {company.name.toUpperCase()}
//             </option>
//           ))}
//       </select>
//     </div>
// )}



// <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">


//         {/* Navigation Items */}
//         <nav className="flex flex-col space-y-2 text-sm ">
//         {sidebarItems.map(({ icon: Icon, text, path, onClick, subMenu }, idx) => (
//   <div key={idx} className="relative group">
//     {/* Main Sidebar Item */}
//     <Link
//       to={path}
//      onClick={(e) => {
//   if (text === "Permissions") {
//     e.preventDefault();
//     setPermissionsOpen(!permissionsOpen);
//     return;
//   }

//   // Company validation for superadmin
//   if (
//     user?.role === "superadmin" &&
//     !selectedCompany &&
//     !["/change-password"].includes(path)
//   ) {
//     e.preventDefault();
//     toast.error("Please select a company first.");
//     return;
//   }

//   // If all good, allow navigation
//   if (isMobile) toggleSidebar();
// }}

//       className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-700 hover:shadow-md transition-all duration-300 ease-in-out transform hover:scale-105"
//     >
//       <div className="relative">
//         <Icon
//           className={`transition-all duration-300 ease-in-out ${sidebarOpen || isMobile ? "text-lg" : "text-md"} text-white-400 hover:text-white-500`}
//         />
//       </div>
//       {(sidebarOpen || isMobile) && (
//         <span className="transition-all duration-500 ease-in-out font-medium text-gray-100 whitespace-nowrap overflow-hidden">
//           {text}
//         </span>
//       )}
//     </Link>

//     {/* Submenu for "Permissions" */}
//     {text === "Permissions" && permissionsOpen && subMenu && (
//       <div className={`${sidebarOpen || isMobile ? "ml-6" : "ml-1"} space-y-2 mt-2`}>
//         {subMenu.map((item, index) => (
//           <div key={index} className="relative group">
//             <Link
//               to={item.path}
//               onClick={() => isMobile && toggleSidebar()} // Close sidebar on mobile if submenu item clicked
//               className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-700 hover:shadow-sm transition-all duration-300 ease-in-out transform hover:scale-105"
//             >
//               <div className="relative">
//                 <item.icon
//                   className={`text-sm transition-all duration-300 ease-in-out ${sidebarOpen || isMobile ? "text-base" : "text-sm"} text-white-200 hover:text-white-300`}
//                 />
//               </div>
//               {(sidebarOpen || isMobile) && (
//                 <span className="transition-all duration-500 ease-in-out font-medium text-gray-200 whitespace-nowrap overflow-hidden">
//                   {item.text}
//                 </span>
//               )}
//             </Link>
//           </div>
//         ))}
//       </div>
//     )}
//   </div>
// ))}

//         </nav>
//         </div>

//         <hr className="border-gray-600 mt-4" />
//       </div>

//       {/* Main Content */}
      // <div
      //   className={`flex-1 flex flex-col bg-gray-100 dark:bg-gray-800 transition-all duration-500 ease-in-out ${
      //     isMobile ? "" : sidebarOpen ? "ml-64" : "ml-16"
      //   }`}
      // >
//         {/* Header */}
//         <div className="sticky top-0 z-40 w-full bg-white dark:bg-gray-900 shadow-lg px-6 py-4">
//           <div className="flex justify-between items-center">
//             <button
//               onClick={toggleSidebar}
//               className="text-xl text-gray-700 dark:text-gray-300 hover:text-white-500 transition-colors duration-300"
//             >
//               <FaBars />
//             </button>

//             <div className="flex items-center gap-4">
            

//               <button
//                 onClick={() => setDarkMode(!darkMode)}
//                 className="text-gray-700 dark:text-gray-300 hover:text-white-500 transition-colors duration-300"
//               >
//                 {darkMode ? <FaSun /> : <FaMoon />}
//               </button>
//               {user ? (
//                 <span className="text-gray-700 dark:text-gray-300 font-medium">{user.username}</span>
//               ) : (
//                 <span className="text-gray-400 italic">Loading user...</span>
//               )}
//               <button
//                 className="text-red-500 hover:text-red-600 transition-colors duration-300"
//                 onClick={handleLogout}
//               >
//                 <FaSignOutAlt />
//               </button>
//             </div>
//           </div>
//         </div>

//         {/* Routed Pages */}
//         <div className="flex-1 p-6 overflow-auto">
//           <Outlet context={{ selectedCompany}} />

//         </div>

//         {/* Footer */}
        // <footer className="bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 py-4 px-6 shadow-inner mt-auto">
        //   <div className="flex justify-between items-center">
        //     <div>
        //     <p className="text-center sm:text-left">© {new Date().getFullYear()} All rights reserved | Powered by Technoadviser Private Limited</p>

        //     </div>
        //   </div>
        // </footer>
//       </div>

//       {/* Overlay for Mobile (to close sidebar on tap outside) */}
      // {isMobile && sidebarOpen && (
      //   <div
      //     className="fixed inset-0 bg-black bg-opacity-50 z-40"
      //     onClick={toggleSidebar}
      //   />
      // )}
//     </div>
//   );
// }


import { Outlet, Link, useLocation } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import {
  FaBars, FaSignOutAlt, FaMoon, FaSun,
  FaBox, FaChartBar, FaUsers, FaUpload, FaKey, FaDatabase,
  FaPlus, FaCheckSquare, FaUserPlus, FaUserShield, FaTools,
  FaTimes, FaBuilding,
  FaCog, FaAddressCard
  , FaMapMarkerAlt
} from "react-icons/fa";
import axios from "axios";
import BASE_URL from "./config";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const resolveMediaUrl = (url) => {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${BASE_URL}${url.startsWith("/") ? url : `/${url}`}`;
};

export default function MainLayout({ user: propUser }) {
  const location = useLocation();
  const [user, setUser] = useState(propUser || null);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [darkMode, setDarkMode] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [sidebarSectionsOpen, setSidebarSectionsOpen] = useState({
    inventory: true,
    account: true,
    campaign: true,
  });
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);

  useEffect(() => {
    const fetchUserAndCompanies = async () => {
      const token = localStorage.getItem("authToken");
      if (!token) return;

      try {
        // Fetch current user info
        const userRes = await axios.get(`${BASE_URL}/api/users/me/`, {
          headers: { Authorization: `Token ${token}` },
        });
        const currentUser = userRes.data;
        setUser(currentUser);

        if (currentUser.role === "superadmin") {
          const companyIds = currentUser.companies;
          if (companyIds && companyIds.length > 0) {
            const companyPromises = companyIds.map((id) =>
              axios.get(`${BASE_URL}/api/companies/${id}/`, {
                headers: { Authorization: `Token ${token}` },
              })
            );
            const companyResponses = await Promise.all(companyPromises);
            const companyData = companyResponses.map((res) => res.data);
            setCompanies(companyData);
            setSelectedCompany(companyData[0] || null);
          } else {
            setCompanies([]);
            setSelectedCompany(null);
          }
        } else {
          // For admin or user
          const userCompanyId =
            Array.isArray(currentUser.companies) && currentUser.companies.length > 0
              ? currentUser.companies[0]
              : null;
          if (userCompanyId) {
            const companyRes = await axios.get(
              `${BASE_URL}/api/companies/${userCompanyId}/`,
              { headers: { Authorization: `Token ${token}` } }
            );
            setCompanies([companyRes.data]);
            setSelectedCompany(companyRes.data);
          }
        }
      } catch (error) {
        console.error("Error fetching user or companies:", error);
      }
    };

    fetchUserAndCompanies();
  }, []);



  const sidebarSections = useMemo(() => {
    const campaignSection = {
      key: "campaign",
      title: "Campaign",
      icon: FaAddressCard,
        items: [
        { icon: FaDatabase, text: "Data Mapping", path: "/data-mapping" },
        { icon: FaAddressCard, text: "Campaign", path: "/campaign" },
        { icon: FaAddressCard, text: "Courier Tracking", path: "/courier-tracking" },
        { icon: FaMapMarkerAlt, text: "Track Map", path: "/track-map" },
      ],
    };

    const accountItems =
      user?.role === "User"
        ? [{ icon: FaKey, text: "Change Password", path: "/change-password" }]
        : [
            { icon: FaUserShield, text: "Users", path: "/users" },
            { icon: FaKey, text: "Change Password", path: "/change-password" },
          ];

    const inventorySection = (() => {
      if (user?.role === "techadmin") {
        return {
          key: "inventory",
          title: "Inventory",
          icon: FaBox,
          items: [
            { icon: FaBuilding, text: "Company", path: "/company" },
            {
              icon: FaTools,
              text: "Permissions",
              path: "#",
              onClick: (e) => {
                e.preventDefault();
                setPermissionsOpen(!permissionsOpen);
              },
              subMenu: [
                { icon: FaPlus, text: "Create Permission", path: "/create-permission" },
                { icon: FaCheckSquare, text: "Add Permission", path: "/add-permission" },
              ],
            },
            { icon: FaUserPlus, text: "Add Role", path: "/add-role" },
            { icon: FaChartBar, text: "Reports", path: "/report-dashboard" },
            { icon: FaCog, text: "Manage Reports", path: "/report-settings" },
            { icon: FaCog, text: "Static Reports", path: "/static-report" },
          ],
        };
      }

      if (user?.role === "User") {
        return {
          key: "inventory",
          title: "Inventory",
          icon: FaBox,
          items: [
            { icon: FaChartBar, text: "Stock Count", path: "/stock-count" },
            { icon: FaUpload, text: "Upload Excel", path: "/upload-excel" },
          ],
        };
      }

      const inventoryItems = [
        { icon: FaUsers, text: "User - Warehouse", path: "/user-warehouse" },
        { icon: FaBox, text: "Product", path: "/product" },
        { icon: FaChartBar, text: "Warehouse", path: "/warehouse" },
        { icon: FaBox, text: "Product - Warehouse", path: "/product-warehouse" },
        { icon: FaChartBar, text: "Stock Count", path: "/stock-count" },
        { icon: FaChartBar, text: "Stock Tally", path: "/stock-tally" },
      ];

      if (user?.role?.toLowerCase() === "superadmin") {
        inventoryItems.push(
          { icon: FaChartBar, text: "Reports", path: "/report-dashboard" },
          { icon: FaCog, text: "Manage Reports", path: "/report-settings" },
          { icon: FaCog, text: "Static Reports", path: "/static-report" },
        );
      }

      inventoryItems.push(
        { icon: FaUpload, text: "Upload Excel", path: "/upload-excel" },
        { icon: FaDatabase, text: "Remove Data", path: "/remove-data" },
      );

      return {
        key: "inventory",
        title: "Inventory",
        icon: FaBox,
        items: inventoryItems,
      };
    })();

    return [
      inventorySection,
      { key: "account", title: "Account", icon: FaUsers, items: accountItems },
      campaignSection,
    ].filter((section) => section.items.length > 0);
  }, [permissionsOpen, user?.role]);


  const handleLogout = async () => {
    const token = localStorage.getItem("authToken");
    if (token) {
      try {
        const response = await axios.post(
          `${BASE_URL}/api/logout/`,
          {},
          {
            headers: {
              Authorization: `Token ${token}`,
            },
          }
        );

        if (response.status === 200) {
          localStorage.removeItem("authToken");
          window.location.href = "/";
        }
      } catch (error) {
        // handle error if needed
      }
    }
  };

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      setSidebarOpen(!mobile);
    };

    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
    if (permissionsOpen) setPermissionsOpen(false);
  };

  const currentPath = location.pathname;

  const handleLeafClick = (event, onClick) => {
    if (onClick) onClick(event);
    if (isMobile) {
      toggleSidebar();
    }
  };

  const toggleSidebarSection = (sectionKey) => {
    setSidebarSectionsOpen((prev) => {
      const isOpen = prev[sectionKey] !== false;
      const nextState = Object.keys(prev).reduce((accumulator, key) => {
        accumulator[key] = false;
        return accumulator;
      }, {});

      if (!isOpen) {
        nextState[sectionKey] = true;
      }

      return nextState;
    });
  };

  const handleSectionHeaderClick = (sectionKey) => {
    if (!sidebarOpen && !isMobile) {
      setSidebarOpen(true);
      setSidebarSectionsOpen(() => ({
        inventory: false,
        account: false,
        campaign: false,
        [sectionKey]: true,
      }));
      return;
    }

    toggleSidebarSection(sectionKey);
  };

  return (
    <div className={`${darkMode ? "dark" : ""} flex flex-col min-h-screen relative`}>
      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-screen bg-gradient-to-b from-gray-800 to-gray-900 text-white p-4 flex flex-col shadow-lg overflow-y-auto rounded-r-lg transition-transform duration-500 ease-in-out z-50
          ${isMobile ? (sidebarOpen ? "w-3/4 translate-x-0" : "w-full -translate-x-full") : sidebarOpen ? "w-64" : "w-17"}`}
      >
        {/* Sidebar Header (with Close Button on Mobile) */}
        <div className="flex items-center justify-between mb-6">
          {selectedCompany?.logo && (
          <img
  src={resolveMediaUrl(selectedCompany.logo)}
  alt="Company Logo"
  className={`
    transition-all duration-300 ease-in-out
    object-contain
    transform
    ${isMobile ? "w-48" : sidebarOpen ? "w-40 max-h-[100px]" : "w-12 max-h-[40px]"}
  `}
/>

          )}

          {isMobile && (
            <button
              onClick={toggleSidebar}
              className="text-white text-2xl hover:text-white-500 transition-colors duration-300"
            >
              <FaTimes />
            </button>
          )}
        </div>

        <hr className="border-gray-600 mb-4" />

{(sidebarOpen || isMobile) && user?.role === "superadmin" && user?.companies?.length >= 0 && (
  <div className="mb-4 text-sm">
    <label className="block mb-2 text-white text-md">SELECT BRANCH </label>
    <select
      value={selectedCompany?.id || ""}
      onChange={(e) => {
        const comp = companies.find((c) => c.id.toString() === e.target.value);
        setSelectedCompany(comp);
      }}
      className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white"
    >
      {companies.map((company) => (
        <option key={company.id} value={company.id}>
          {company.name}
        </option>
      ))}
    </select>
  </div>
)}



        {/* Sidebar Links */}
        <nav className="flex flex-col gap-3 text-white text-sm">
          {sidebarSections.map((section) => {
            const SectionIcon = section.icon;
            const sectionOpen = sidebarSectionsOpen[section.key] !== false;

            return (
              <div key={section.key} className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => handleSectionHeaderClick(section.key)}
                  className="flex items-center justify-between gap-3 rounded-md p-2 text-left hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <SectionIcon />
                    {(sidebarOpen || isMobile) && <span className="truncate font-semibold">{section.title}</span>}
                  </div>
                </button>

                {sectionOpen && (sidebarOpen || isMobile) && (
                  <div className="ml-2 flex flex-col gap-1 border-l border-gray-700 pl-3">
                    {section.items.map(({ icon: ItemIcon, text, path, to, onClick, subMenu }, idx) => {
                      const destination = to || path;
                      const isActive = currentPath === (typeof destination === "string" ? destination : destination?.pathname);
                      return (
                        <div key={`${section.key}-${idx}`} className="flex flex-col gap-1">
                          {subMenu ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (onClick) {
                                  onClick({ preventDefault: () => {} });
                                }
                              }}
                              className="flex items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-gray-700"
                            >
                              <ItemIcon />
                              <span className="truncate">{text}</span>
                            </button>
                          ) : (
                            <Link
                              to={destination}
                              onClick={(event) => handleLeafClick(event, onClick)}
                              className={`flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-gray-700 ${
                                isActive ? "bg-gray-700 font-semibold" : ""
                              }`}
                            >
                              <ItemIcon />
                              <span className="truncate">{text}</span>
                            </Link>
                          )}

                          {subMenu && permissionsOpen && (
                            <div className="ml-5 flex flex-col gap-1">
                              {subMenu.map(({ icon: SubIcon, text: subText, path: subPath }, subIdx) => (
                                <Link
                                  key={`${subPath}-${subIdx}`}
                                  to={subPath}
                                  onClick={(event) => handleLeafClick(event)}
                                  className={`flex items-center gap-2 rounded-md p-2 transition-colors hover:bg-gray-700 ${
                                    currentPath === subPath ? "bg-gray-700 font-semibold" : ""
                                  }`}
                                >
                                  <SubIcon />
                                  <span>{subText}</span>
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

       
      </div>

      {/* Main Content */}
    <div
        className={`flex-1 flex flex-col bg-gray-100 dark:bg-gray-800 transition-all duration-300 ease-in-out ${
          isMobile ? "" : sidebarOpen ? "ml-64" : "ml-16"
        }`}
      >
        {/* Top Navbar */}
         <div className="sticky top-0 z-40 w-full bg-white dark:bg-gray-900 shadow-lg px-6 py-4">
          <div className="flex justify-between items-center">
            <button
              onClick={toggleSidebar}
              className="text-xl text-gray-700 dark:text-gray-300 hover:text-white-500 transition-colors duration-300"
            >
              <FaBars />
            </button>

            <div className="flex items-center gap-4">
            

              <button
                onClick={() => setDarkMode(!darkMode)}
                className="text-gray-700 dark:text-gray-300 hover:text-white-500 transition-colors duration-300"
              >
                {darkMode ? <FaSun /> : <FaMoon />}
              </button>
              {user ? (
                <span className="text-gray-700 dark:text-gray-300 font-medium">{user.username}</span>
              ) : (
                <span className="text-gray-400 italic">Loading user...</span>
              )}
              <button
                className="text-red-500 hover:text-red-600 transition-colors duration-300"
                onClick={handleLogout}
              >
                <FaSignOutAlt />
              </button>
            </div>
          </div>
        </div>

        {/* Content Outlet */}
               {/* Main Content Area */}
        <main className="flex-grow p-4 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 overflow-y-auto">
          <Outlet context={{ selectedCompany }} />
        </main>

        {/* Footer */}
         <footer className="bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 py-4 px-6 shadow-inner mt-auto">
          <div className="flex justify-between items-center">
            <div>
            <p className="text-center sm:text-left">© {new Date().getFullYear()} All rights reserved | Powered by Technoadviser Private Limited</p>

            </div>
          </div>
        </footer>


        {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={toggleSidebar}
        />
      )}
      </div>

      <ToastContainer position="bottom-right" />
    </div>

  );
}
