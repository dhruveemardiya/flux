

import React, { useEffect, useState, useMemo, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import Select from "react-select";
import { components } from "react-select";
import ClipLoader from "react-spinners/ClipLoader";
import { commonSelectStyles, formatLabelEllipsis } from "./Commonstyle";
import { useParams } from "react-router-dom";
import BASE_URL from "./config";
ModuleRegistry.registerModules([AllCommunityModule]);


const availableFields = ["Sales Person", "Duration", "Products", "City", "Client", "Product", "Voucher"];


const ReportBuilder = () => {

  const [showForm, setShowForm] = useState(false);
  const [reportName, setReportName] = useState("");
  const [rowHeader, setRowHeader] = useState("");
  const [columnHeader, setColumnHeader] = useState("");
  const [columnDefs, setColumnDefs] = useState([]);
  const [reports, setReports] = useState([]);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loadingTable, setLoadingTable] = useState(false);
  const [rowValues, setRowValues] = useState([]);
  const [columnValues, setColumnValues] = useState([]);
const { id: reportIdFromURL } = useParams();


  const [searchQuery, setSearchQuery] = useState("");


  const [showFilters, setShowFilters] = useState(false);
  const visibleReports = useMemo(
    () => reports.filter((r) => !r.hidden),
    [reports]
  );
  const urlReportInitializedRef = useRef(false);

  const [filters, setFilters] = useState({
    duration: false,
    durationPeriod: false,
    salesPerson: false,
    city: false,
    product: false,
    viewType: false,
    client: false,
    vouchernumber: false,
    vouchertype: false,

  });
  const [filterValues, setFilterValues] = useState({
    city: [],         // ✅ array
    product: [],      // ✅ array
    salesPerson: [],
    client: [],
    vouchernumber: [],
    vouchertype: [],
    // instead of voucher
    // ✅ array
    duration: "",
    durationPeriod: "",    // ✅ string (okay)
  });

  const [filterOptions, setFilterOptions] = useState({
    cities: [],
    products: [],
    salesPersons: [],
    durations: [],
    clients: [],
    vouchers: [],
    voucherTypes: [],

  });
  const [selectedReportIndex, setSelectedReportIndex] = useState(null);
  const [viewType, setViewType] = useState("currency");
  const [rowData, setRowData] = useState([]);
const [useSavedFilterOptionsOnly, setUseSavedFilterOptionsOnly] = useState(false);



  useEffect(() => {
    if (selectedReportIndex !== null && rowHeader && columnHeader) {
      handleSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReportIndex, rowHeader, columnHeader]);


useEffect(() => {
  urlReportInitializedRef.current = false;
}, [reportIdFromURL]);

useEffect(() => {
  if (
    !reportIdFromURL ||
    visibleReports.length === 0 ||
    urlReportInitializedRef.current
  ) {
    return;
  }

  const foundIndex = visibleReports.findIndex(
    (report) => String(report.id) === reportIdFromURL
  );

  if (foundIndex === -1) {
    return;
  }

  urlReportInitializedRef.current = true;
  handleSelectReport(foundIndex);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [visibleReports, reportIdFromURL]);

  useEffect(() => {
    fetch(`${BASE_URL}/api/reports/`)
      .then(res => res.json())
      .then(data => setReports(data))
      .catch(err => console.error("Failed to fetch saved reports:", err));
  }, []);


  const toggleFilter = (key) => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };


// const handleSearch = () => {
//   setLoadingTable(true);
//   setRowData([]);
//   setColumnDefs([]);

//   const params = new URLSearchParams();

//   const adjustedFilterValues = {
//     ...filterValues,
//     city: filterValues.city?.filter(Boolean),
//     product: filterValues.product?.filter(Boolean),
//     client: filterValues.client?.filter(Boolean),
//     vouchernumber: filterValues.vouchernumber?.filter(Boolean),
//     vouchertype: filterValues.vouchertype?.filter(Boolean),
//     salesPerson: filterValues.salesPerson?.filter(Boolean),
//     duration: filterValues.duration || "",
//     durationPeriod: filterValues.durationPeriod || "",
//   };

//   const keyMap = {
//     city: "city",
//     product: "product",
//     salesPerson: "salesPerson",
//     client: "client",
//     vouchernumber: "vouchernumber",
//     vouchertype: "voucherType",
//     duration: "duration",
//     durationPeriod: "durationPeriod",
//   };

//   Object.entries(adjustedFilterValues).forEach(([key, value]) => {
//     const mappedKey = keyMap[key] || key;
//     const lowerKey = key.toLowerCase();
//     const alwaysSendKeys = ["duration", "durationPeriod"];

//     const shouldSend = filters[key] || alwaysSendKeys.includes(lowerKey);

//     if (shouldSend) {
//       if (Array.isArray(value)) {
//         value.forEach((v) => {
//           if (v) params.append(mappedKey, v);
//         });
//       } else if (value) {
//         params.append(mappedKey, value);
//       }
//     }
//   });

//   if (searchQuery?.trim()) {
//     params.append("search", searchQuery.trim());
//   }

//   if (rowHeader) params.append("rowHeader", rowHeader.toLowerCase());
//   if (columnHeader) params.append("columnHeader", columnHeader.toLowerCase());
//   params.append("viewType", viewType);

//   const headerKeyMap = {
//     city: "city",
//     products: "product",
//     "sales person": "salesPerson",
//     "voucher type": "vouchertype",
//     voucher: "vouchernumber",
//     client: "client",
//   };

//   const normalize = (val) => val?.toString().toLowerCase().trim();
//   const rowHeaderKey = normalize(rowHeader);
//   const columnHeaderKey = normalize(columnHeader);

//   const selectedRowFilterKey = headerKeyMap[rowHeaderKey];
//   const selectedColFilterKey = headerKeyMap[columnHeaderKey];

//   const selectedRowFilter = adjustedFilterValues[selectedRowFilterKey] || [];
//   const selectedColFilter = adjustedFilterValues[selectedColFilterKey] || [];

//   const filteredRowValues = rowValues.filter((val) => {
//     if (Array.isArray(selectedRowFilter)) {
//       return selectedRowFilter.length === 0 || selectedRowFilter.includes(val);
//     }
//     return selectedRowFilter === val;
//   });

//   const filteredColumnValues = columnValues.filter((val) => {
//     if (Array.isArray(selectedColFilter)) {
//       return selectedColFilter.length === 0 || selectedColFilter.includes(val);
//     }
//     return selectedColFilter === val;
//   });

//   // ✅ Only skip API call if filters are applied AND there's no matching data
//   const rowFilteredOut = selectedRowFilter.length > 0 && filteredRowValues.length === 0;
//   const colFilteredOut = selectedColFilter.length > 0 && filteredColumnValues.length === 0;

//   if (rowFilteredOut || colFilteredOut) {
//     console.warn("❌ Skipped API call due to filter mismatch (row/col)");
//     setRowData([]);
//     setColumnDefs([]);
//     setLoadingTable(false);
//     return;
//   }

//   // ✅ Only append if values are present
//   if (filteredRowValues.length > 0) {
//     filteredRowValues.forEach((v) => params.append("rowValues", v));
//   }
//   if (filteredColumnValues.length > 0) {
//     filteredColumnValues.forEach((v) => params.append("columnValues", v));
//   }

//   const selectedReport =
//     selectedReportIndex !== null ? visibleReports[selectedReportIndex] : null;
//   const reportId = selectedReport?.id;

//   const baseURL = reportId
//     ? `${BASE_URL}/api/reports/${reportId}/data/`
//     : `${BASE_URL}/api/reports/data/`;

//   const finalURL = `${baseURL}?${params.toString()}`;

//   fetch(finalURL)
//     .then((res) => res.json())
//     .then((data) => {
//       const { columns, data: tableData, filters } = data;

//       const generatedColumnDefs = columns.map((col, index) => ({
//         ...col,
//         width: 120,
//         flex: 1,
//         minWidth: index === 0 ? 150 : 120,
//         pinned: index === 0 ? "left" : undefined,
//         filter:
//           col.type === "date"
//             ? "agDateColumnFilter"
//             : col.type === "number" || col.type === "currency"
//             ? "agNumberColumnFilter"
//             : true,
//         valueFormatter:
//           col.type === "currency"
//             ? (params) => {
//                 const value = Number(params.value);
//                 return isNaN(value) ? "₹0.00" : `₹${value.toFixed(2)}`;
//               }
//             : col.type === "number"
//             ? (params) => params.value ?? "-"
//             : undefined,
//       }));

//       setColumnDefs(generatedColumnDefs);
//       setRowData(tableData);

//       if (filters && !useSavedFilterOptionsOnly) {
//         setFilterOptions({
//           cities: filters.cities || [],
//           products: filters.products || [],
//           salesPersons: filters.salesPersons || [],
//           voucherTypes: filters.voucherTypes || [],
//           vouchers: filters.vouchers || [],
//           clients: filters.clients || [],
//           durations: filters.durations || [],
//           durationPeriods: filters.durationPeriods || [],
//         });
//          setLoadingFilters(false);
//       }

//     })
//     .catch((err) => {
//       console.error("❌ Failed to fetch report data:", err);
//       setRowData([]);
//     })
//     .finally(() => {
//       setLoadingTable(false);
//     });
// };




const handleSearch = () => {
  setLoadingTable(true);
  setRowData([]);
  setColumnDefs([]);

  // Filter empty values
  const adjustedFilterValues = {
    ...filterValues,
    city: filterValues.city?.filter(Boolean),
    product: filterValues.product?.filter(Boolean),
    client: filterValues.client?.filter(Boolean),
    vouchernumber: filterValues.vouchernumber?.filter(Boolean),
    vouchertype: filterValues.vouchertype?.filter(Boolean),
    salesPerson: filterValues.salesPerson?.filter(Boolean),
    duration: filterValues.duration || "",
    durationPeriod: filterValues.durationPeriod || "",
  };

 const headerKeyMap = {
  city: "city",
  product: "products",
  client: "client",
  vouchernumber: "voucher",
  vouchertype: "voucher type",
  salesPerson: "sales person",
};


  const normalize = (val) => val?.toString().toLowerCase().trim();
  const rowHeaderKey = normalize(rowHeader);
  const columnHeaderKey = normalize(columnHeader);

 const selectedRowFilterKey = headerKeyMap[rowHeaderKey] || rowHeaderKey;
const selectedColFilterKey = headerKeyMap[columnHeaderKey] || columnHeaderKey;


  const selectedRowFilter = adjustedFilterValues[selectedRowFilterKey] || [];
  const selectedColFilter = adjustedFilterValues[selectedColFilterKey] || [];

  const filteredRowValues = rowValues.filter((val) =>
    selectedRowFilter.length === 0 || selectedRowFilter.includes(val)
  );
  const filteredColumnValues = columnValues.filter((val) =>
    selectedColFilter.length === 0 || selectedColFilter.includes(val)
  );

  const rowFilteredOut = selectedRowFilter.length > 0 && filteredRowValues.length === 0;
  const colFilteredOut = selectedColFilter.length > 0 && filteredColumnValues.length === 0;

  if (rowFilteredOut || colFilteredOut) {
    console.warn("❌ Skipped API call due to filter mismatch (row/col)");
    setRowData([]);
    setColumnDefs([]);
    setLoadingTable(false);
    return;
  }

  const selectedReport =
    selectedReportIndex !== null ? visibleReports[selectedReportIndex] : null;
  const reportId = selectedReport?.id;

  const url = reportId
    ? `${BASE_URL}/api/reports/${reportId}/data/`
    : `${BASE_URL}/api/reports/data/`;

  const requestBody = {
    ...adjustedFilterValues,
rowHeader: selectedRowFilterKey,
columnHeader: selectedColFilterKey,

    viewType,
    rowValues: filteredRowValues,
    columnValues: filteredColumnValues,
    search: searchQuery?.trim() || "",
  };

  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  })
    .then((res) => res.json())
    .then((data) => {
      const { columns, data: tableData, filters } = data;

      const generatedColumnDefs = columns.map((col, index) => ({
        ...col,
        headerName: index === 0 ? rowHeader : col.headerName, 
        width: 120,
        flex: 1,
        minWidth: index === 0 ? 150 : 120,
        pinned: index === 0 ? "left" : undefined,
        filter:
          col.type === "date"
            ? "agDateColumnFilter"
            : col.type === "number" || col.type === "currency"
            ? "agNumberColumnFilter"
            : true,
        valueFormatter:
          col.type === "currency"
            ? (params) => {
                const value = Number(params.value);
                return isNaN(value) ? "₹0.00" : `₹${value.toFixed(2)}`;
              }
            : col.type === "number"
            ? (params) => params.value ?? "-"
            : undefined,
      }));

      setColumnDefs(generatedColumnDefs);
      setRowData(tableData);

      if (filters && !useSavedFilterOptionsOnly) {
        setFilterOptions({
          cities: filters.cities || [],
          products: filters.products || [],
          salesPersons: filters.salesPersons || [],
          voucherTypes: filters.voucherTypes || [],
          vouchers: filters.vouchers || [],
          clients: filters.clients || [],
          durations: filters.durations || [],
          durationPeriods: filters.durationPeriods || [],
        });
        setLoadingFilters(false);
      }
    })
    .catch((err) => {
      console.error("❌ Failed to fetch report data:", err);
      setRowData([]);
    })
    .finally(() => {
      setLoadingTable(false);
    });
};


const handleSelectReport = (index) => {
  const selected = visibleReports[index];
  if (!selected) return;

  const restoredFilters = Object.keys(selected.filters || {}).reduce((acc, key) => {
    if (selected.filters[key]) acc[key] = true;
    return acc;
  }, {});

const savedFilterValues = {
  ...(selected.filter_values || {}),
};


  const newFilterOptions = {
    cities: savedFilterValues.city || [],
    products: savedFilterValues.product || [],
    salesPersons: savedFilterValues.salesPerson || [],
    clients: savedFilterValues.client || [],
    vouchers: savedFilterValues.vouchernumber || [],
    voucherTypes: savedFilterValues.vouchertype || [],
  };

  setSelectedReportIndex(index);
  setReportName(selected.name);
  setRowHeader(selected.row_header);
  setColumnHeader(selected.column_header);
  setFilters(restoredFilters);

  // ✅ clear selections
  setFilterValues({
    city: [],
    product: [],
    salesPerson: [],
    client: [],
    vouchernumber: [],
    vouchertype: [],
  });

  setRowValues(selected.row_values || []);
  setColumnValues(selected.column_values || []);
  setViewType("currency");
  setUseSavedFilterOptionsOnly(true);
setFilterOptions(newFilterOptions); 
setLoadingFilters(false);

  setShowForm(false);
};



  return (

    <div className="bg-white-100 min-h-screen">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-2 py-2 mb-2 rounded-lg shadow bg-white border border-gray-200">

        <div className="flex items-center space-x-4">
          <select
            className="border border-gray-300 p-1 rounded w-[150px] bg-white shadow-sm"
            onChange={(e) => {
              const index = e.target.value;
              handleSelectReport(Number(index));

            }}
            value={selectedReportIndex ?? ""}
          >
            <option value="">Select Report</option>
            {visibleReports.map((report, idx) => (
              <option key={idx} value={idx}>
                {report.name}
              </option>
            ))}

          </select>

          <div className="Relative">
            <button
              onClick={() => setShowFilters(prev => !prev)}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded shadow-sm border border-gray-300"
            >
              ☰ Filters
            </button>
          </div>
        </div>

      </div>


      {/* Filter Select Inputs */}
      {selectedReportIndex !== null && (

        <>

          {showFilters && Object.values(filters).some(Boolean) && (

            <div className="relative z-50 bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 w-full overflow-x-auto">
              <div className="flex flex-wrap gap-3 items-center min-w-[300px]">

                {filters.viewType && (
                  <div className="flex items-center gap-3">
                    <div className="flex rounded-md border border-black overflow-hidden w-fit">
                      <button
                        className={`px-6 py-2 font-medium text-white transition ${viewType === "currency" ? "bg-red-600" : "bg-gray-200 text-black"
                          }`}
                        onClick={() => {
                          setViewType("currency");
                          handleSearch();
                        }}
                      >
                        Currency
                      </button>
                      <button
                        className={`px-6 py-2 font-medium text-white transition ${viewType === "quantity" ? "bg-green-600" : "bg-gray-200 text-black"
                          }`}
                        onClick={() => {
                          setViewType("quantity");
                          handleSearch();
                        }}
                      >
                        Quantity
                      </button>
                    </div>
                  </div>
                )}

                {filters.duration && (
                  <select
                    className="border rounded px-3 py-2"
                    value={filterValues.duration}
                    onChange={(e) =>
                      setFilterValues((prev) => ({
                        ...(typeof prev === "object" && prev !== null ? prev : {}),
                        duration: e.target.value,
                      }))
                    }
                  >
                    <option value="">Duration</option>
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="this_week">This Week</option>
                    <option value="last_week">Last Week</option>
                    <option value="last_7_days">Last 7 Days</option>
                    <option value="this_month">This Month</option>
                    <option value="last_month">Last Month</option>
                    <option value="last_30_days">Last 30 Days</option>
                    <option value="this_year">This Year</option>
                    <option value="last_365_days">Last 365 Days</option>
                  </select>

                )}
               {filters.durationPeriod && (
  <select
    className="border rounded px-3 py-2"
    value={filterValues.durationPeriod}
    onChange={(e) =>
      setFilterValues((prev) => ({
        ...prev,
        durationPeriod: e.target.value,
      }))
    }
  >
    <option value="">Duration Type</option>
    <option value="daily">Daily</option>
    <option value="weekly">Weekly</option>
    <option value="monthly">Monthly</option>
    <option value="yearly">Yearly</option>
    <option value="all">All</option>
  </select>
)}



    {filters.city && (
 <Select
  isMulti
  isSearchable
  className="w-[180px] flex-shrink-0"
  options={(filterOptions.cities || []).map(c => ({ label: c, value: c }))}  // ✅ FROM FILTER_OPTIONS ONLY
  value={(filterValues.city || []).map(c => ({ label: c, value: c }))}
  onChange={(selected) =>
    setFilterValues(prev => ({
      ...prev,
      city: selected.map(item => item.value)
    }))
  }
  placeholder={
    (filterValues.city?.length || 0) > 0
      ? `${filterValues.city.length} selected`
      : "Select cities"
  }
  styles={commonSelectStyles}
  formatOptionLabel={formatLabelEllipsis}
  menuPortalTarget={document.body}
  menuPosition="fixed"
/>

)}



                {filters.client && (
                  <Select
                    isMulti
                    isSearchable
                    className="w-[180px] flex-shrink-0"
                    options={(filterOptions.clients || []).map(c => ({ label: c, value: c }))}  // ✅ FROM FILTER_OPTIONS ONLY
  value={(filterValues.client || []).map(c => ({ label: c, value: c }))}

                    onChange={(selected) =>
                      setFilterValues(prev => ({
                        ...prev,
                        client: selected.map(item => item.value)
                      }))
                    }
                    placeholder={
                      (filterValues.client || []).length === 0
                        ? "Client"
                        : `${filterValues.client.length} selected`
                    }
                    styles={commonSelectStyles}
                    formatOptionLabel={formatLabelEllipsis}
                    menuPortalTarget={document.body}
                    menuPosition="fixed"
                  />

                )}

               {filters.vouchernumber && (
  <Select
    isMulti
    isSearchable
    isLoading={loadingFilters}
    loadingMessage={() => (
      <div className="text-blue-700 font-semibold py-2 px-4">Loading vouchers...</div>
    )}
    className="w-[180px] flex-shrink-0"
    options={(filterOptions.vouchers || []).map(c => ({ label: c, value: c }))}
    value={(filterValues.vouchernumber || []).map(c => ({ label: c, value: c }))}
    onChange={(selected) =>
      setFilterValues(prev => ({
        ...prev,
        vouchernumber: (selected || []).map(item => item.value)
      }))
    }
    placeholder={
      loadingFilters
        ? "Loading..."
        : (filterValues.vouchernumber || []).length === 0
        ? "Voucher"
        : `${filterValues.vouchernumber.length} selected`
    }
    styles={commonSelectStyles}
    formatOptionLabel={formatLabelEllipsis}
    menuPortalTarget={document.body}
    menuPosition="fixed"
  />
)}



                {filters.vouchertype && (
                  <Select
                    isMulti
                    isSearchable
                    className="w-[180px] flex-shrink-0"
                    options={(filterOptions.voucherTypes || []).map(vt => ({ label: vt, value: vt }))}
                value={(filterValues.vouchertype || []).map(vt => ({ label: vt, value: vt }))}

                    onChange={(selected) =>
                      setFilterValues(prev => ({
                        ...prev,
                        vouchertype: selected.map(item => item.value)
                      }))
                    }
                    placeholder={
                      (filterValues.vouchertype || []).length === 0
                        ? "Voucher Type"
                        : `${filterValues.vouchertype.length} selected`
                    }
                    styles={commonSelectStyles}
                    formatOptionLabel={formatLabelEllipsis}
                    menuPortalTarget={document.body}
                    menuPosition="fixed"

                  />
                )}



                {filters.salesPerson && (
                  <Select
                    isMulti
                    isSearchable
                    className="w-[180px] flex-shrink-0"
                    options={filterOptions.salesPersons.map(s => ({ label: s, value: s }))}
                  value={(filterValues.salesPerson || []).map(s => ({ label: s, value: s }))}

                    onChange={(selected) =>
                      setFilterValues(prev => ({
                        ...prev,
                        salesPerson: selected.map(item => item.value)
                      }))
                    }
                    placeholder={
                      filterValues.salesPerson.length === 0
                        ? "SalesPerson"
                        : `${filterValues.salesPerson.length} selected`
                    }
                    styles={commonSelectStyles}
                    formatOptionLabel={formatLabelEllipsis}
                    menuPortalTarget={document.body}
                    menuPosition="fixed"
                  />
                )}
                {filters.product && (
                  <Select
                    isMulti
                    isSearchable
                    className="w-[180px] flex-shrink-0"
                    options={filterOptions.products.map(p => ({ label: p, value: p }))}
                value={(filterValues.product || []).map(p => ({ label: p, value: p }))}

                    onChange={(selected) =>
                      setFilterValues(prev => ({
                        ...prev,
                        product: selected.map(item => item.value)
                      }))
                    }
                    placeholder={
                      filterValues.product.length === 0
                        ? "Product"
                        : `${filterValues.product.length} selected`
                    }
                    styles={commonSelectStyles}
                    formatOptionLabel={formatLabelEllipsis}
                    menuPortalTarget={document.body}
                    menuPosition="fixed"
                  />)}


                <button
                  onClick={handleSearch}
                  className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700"
                >
                  Search
                </button>
              </div>
            </div>
          )}


         
          <div className="w-full overflow-x-auto mt-0" >
            <div className="ag-theme-alpine bg-white p-4 rounded border min-w-[1000px]" style={{
              height: "700px", width: "100%", overflow: "auto",
              position: "relative",
            }}>
              {loadingTable && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white bg-opacity-70 backdrop-blur-sm">
                  <div className="flex items-center space-x-3 animate-pulse">
                    <ClipLoader size={42} color="#2563eb" loading />
                    <span className="text-lg font-semibold text-blue-700">Loading Table...</span>
                  </div>
                </div>
              )}

              <AgGridReact
                theme="legacy"
                rowData={rowData}
                columnDefs={columnDefs}
                pagination={true}
                paginationPageSize={20}
                animateRows={true}
                enableRangeSelection={true}
                rowSelection="multiple"
                modules={[AllCommunityModule]}
                domLayout="sticky"
                getRowClass={() => "border-b border-gray-300"}
                defaultColDef={{
                  filter: true,
                  floatingFilter: true,
                  sortable: true,
                  resizable: true,
                  minWidth: 130,
                }}
              />
            </div>
          </div>

        </>
      )}
    </div>

  );
};

export default ReportBuilder;
