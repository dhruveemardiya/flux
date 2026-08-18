import React, { useEffect, useState, useRef } from "react";
import BASE_URL from "./config";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Select, { components } from "react-select";
import { Menu } from "lucide-react"; // optional: use any hamburger icon

import { useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { productNameMatchesSearch } from "../utils/productSearch";
const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString();
};

const StockTally = () => {
  const [showPrevDate, setShowPrevDate] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [warehouses, setWarehouses] = useState([]); // Initialize as array
  const [products, setProducts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedWarehouseCodes, setSelectedWarehouseCodes] = useState([]);
  const [prevDate, setPrevDate] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [loading, setLoading] = useState(false);
const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
const [isMenuOpen, setIsMenuOpen] = useState(false);
const [showSearchInput, setShowSearchInput] = useState(false);
const { selectedCompany } = useOutletContext();




  const rowsPerPage = 50;

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const warehouseOptions = [
    { label: "All Warehouses", value: "ALL" },
    ...warehouses.map((w) => ({ label: w.name, value: w.id.toString() })),
  ];

  const isAllSelected = selectedWarehouseCodes.length === warehouses.length;

  const toggleDropdown = () => setIsOpen((prev) => !prev);

  const handleOptionChange = (value) => {
    if (value === "ALL") {
      if (isAllSelected) {
        setSelectedWarehouseCodes([]);
      } else {
        setSelectedWarehouseCodes(warehouses.map((w) => w.id.toString()));
      }
    } else {
      if (selectedWarehouseCodes.includes(value)) {
        setSelectedWarehouseCodes(
          selectedWarehouseCodes.filter((v) => v !== value)
        );
      } else {
        setSelectedWarehouseCodes([...selectedWarehouseCodes, value]);
      }
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchWarehouses = async () => {
  try {
    const token = localStorage.getItem("authToken");
    if (!token) {
      setWarehouses([]);
      return;
    }

    // Fetch current user info
    const userRes = await fetch(`${BASE_URL}/api/users/me/`, {
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!userRes.ok) throw new Error("Failed to fetch user info");
    const user = await userRes.json();

    // Determine companyId
    let companyId = null;
    if (user.role === "superadmin") {
      companyId = selectedCompany?.id || user.companies?.[0];
    } else {
      companyId = user.companies?.[0];
    }

    if (!companyId) {
      setWarehouses([]);
      return;
    }

    // Fetch warehouses for selected company
    const res = await fetch(`${BASE_URL}/api/get_warehouse/?company_id=${companyId}`, {
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();

    const warehouseData = Array.isArray(data) ? data : [];
    setWarehouses(warehouseData);
  } catch (err) {
    console.error(err);
    setWarehouses([]);
  }
};


const fetchProducts = async () => {
  try {
    const token = localStorage.getItem("authToken");
    if (!token) {
      setProducts([]);
      return;
    }

    // Fetch current user info to determine company_id
    const userRes = await fetch(`${BASE_URL}/api/users/me/`, {
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!userRes.ok) throw new Error("Failed to fetch user info");
    const user = await userRes.json();

    let companyId = null;
    if (user.role === "superadmin") {
      companyId = selectedCompany?.id || user.companies?.[0];
    } else {
      companyId = user.companies?.[0];
    }

    if (!companyId) {
      setProducts([]);
      return;
    }

    // Fetch products for the company (active only)
    const res = await fetch(`${BASE_URL}/api/get_products/?company_id=${companyId}&status=active`, {
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    const productData = (Array.isArray(data) ? data : []).filter(
      (p) => p.is_active !== false
    );
    setProducts(productData);
    setProductsLoaded(true);
  } catch (err) {
    console.error(err);
    setProducts([]);
  }
};



 useEffect(() => {
  fetchWarehouses();
  fetchProducts();
}, [selectedCompany]);


  useEffect(() => {
    if (!productsLoaded) return;

    if (selectedWarehouseCodes.length === 0) {
      toast.error("Please select at least 1 warehouse.");
      return;
    }

    if (showPrevDate) {
      if (selectedDate) {
        fetchStockOverviewWithSelectedDate();
      } else {
        fetchStockOverview();
      }
    } else {
      fetchStockOverview();
    }
  }, [selectedWarehouseCodes, productsLoaded, selectedDate, showPrevDate]);
  
useEffect(() => {
  setIsMenuOpen(false); // ensures it's closed at load
}, []);

  const fetchStockOverview = async () => {
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        return;
      }
      if (selectedWarehouseCodes.length === 0) {
        toast.error("Please select at least 1 warehouse.");
        return;
      }
      let endpoint = "get_product_stock_overview/";
      let body = {
        warehouse_ids: selectedWarehouseCodes,
      };

      if (selectedDate) {
        endpoint = "get_selected_prev_date_stock/";
        body.selected_date = selectedDate;
      }

      const response = await fetch(`${BASE_URL}/api/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        return;
      }

      setPrevDate(data.product_table_prev_date);
      setCurrentDate(data.current_date);

      const mergedProducts = products
        .filter((prod) => prod.is_active !== false)
        .map((prod) => {
        const stockData = data.products.find((p) => p.product_id === prod.id);
        return {
          ...prod,
          warehouses: stockData?.warehouses || {},
          total_prev_stock: stockData?.total_prev_stock ?? 0,
          total_current_stock: stockData?.total_current_stock ?? 0,
          prev_stock: stockData?.prev_stock ?? 0,
          current_stock: stockData?.current_stock ?? 0,
          prev_stock_difference: stockData?.prev_stock_difference ?? 0,
          current_stock_difference: stockData?.stock_difference ?? 0,
          dynamic_column_stock: stockData?.dynamic_column_stock ?? {},
        };
      });

      setProducts(mergedProducts);
    } catch (err) {
      toast.error(`Failed to fetch stock overview: ${err.message}`);
    }
  };

  const fetchStockOverviewWithSelectedDate = async () => {
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        return;
      }
      if (selectedWarehouseCodes.length === 0) {
        toast.error("Please select at least 1 warehouse.");
        return;
      }

      const response = await fetch(
        `${BASE_URL}/api/get_selected_prev_date_stock/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Token ${token}`,
          },
          body: JSON.stringify({
            warehouse_ids: selectedWarehouseCodes,
            selected_date: selectedDate,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        return;
      }

      setPrevDate(selectedDate);
      setCurrentDate(data.current_date);

      const mergedProducts = products
        .filter((prod) => prod.is_active !== false)
        .map((prod) => {
        const stockData = data.products.find((p) => p.product_id === prod.id);
        return {
          ...prod,
          warehouses: stockData?.warehouses || {},
          total_prev_stock: stockData?.total_prev_stock ?? 0,
          total_current_stock: stockData?.total_current_stock ?? 0,
          prev_stock: stockData?.prev_stock ?? 0,
          current_stock: stockData?.current_stock ?? 0,
          prev_stock_difference: stockData?.prev_stock_difference ?? 0,
          current_stock_difference: stockData?.stock_difference ?? 0,
          dynamic_column_stock: stockData?.dynamic_column_stock ?? {},
        };
      });

      setProducts(mergedProducts);
    } catch (err) {
      toast.error(`Failed to fetch stock data: ${err.message}`);
    }
  };

  const filteredProducts = products.filter((p) =>
    productNameMatchesSearch(p.product_name, searchTerm)
  );

  const filteredStockProducts = useMemo(() => {
    if (filterType === "") {
      return filteredProducts;
    }

    return filteredProducts.filter((product) => {
      const rawDiff =
        (product.total_current_stock ?? 0) -
        (product.dynamic_column_stock?.[`quantity_${currentDate}`] ?? 0);
      const diff = rawDiff;

      let passed = false;
      switch (filterType) {
        case "increase":
          passed = diff > 0;
          break;
        case "decrease":
          passed = diff < 0;
          break;
        case "hide_zero":
          passed = diff !== 0;
          break;
        case "show_zero":
          passed = diff === 0;
          break;
        default:
          passed = true;
      }

      return passed;
    });
  }, [filteredProducts, filterType, currentDate]);

  // Ensure warehouses is an array before filtering
  const selectedWarehouses = Array.isArray(warehouses)
    ? warehouses.filter((wh) =>
        selectedWarehouseCodes.includes(wh.id.toString())
      )
    : [];

  const totalPages = Math.ceil(filteredStockProducts.length / rowsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Keep currentPage within valid bounds whenever filteredProducts or rowsPerPage changes
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages, setCurrentPage]);

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredStockProducts.slice(start, end);
  }, [filteredStockProducts, currentPage, rowsPerPage]);

  const getExportHeaders = () => {
    return [
      "Product Name",
      ...selectedWarehouses.flatMap((wh) => {
        const arr = [];
        if (!selectedDate && showPrevDate) arr.push(`${wh.code} (P)`);
        arr.push(`${wh.code} (C)`);
        if (selectedDate) arr.push(`${wh.code} (P)`);
        return arr;
      }),
      ...(showPrevDate && !selectedDate ? ["TOT PST"] : []),
      "TOT CST",
      ...(showPrevDate && !selectedDate ? ["PST (TLY)"] : []),
      "CST (TLY)",
      ...(selectedDate ? ["PST (TLY)"] : []),
      ...(showPrevDate && !selectedDate ? ["PrDF"] : []),
      "CDF",
      ...(selectedDate ? ["PrDF"] : []),
    ];
  };

  const getExportRows = () => {
    return filteredStockProducts.map((prod) => {
      const row = [prod.product_name];

      selectedWarehouses.forEach((wh) => {
        const whData = prod.warehouses?.[wh.id.toString()] || {};
        if (!selectedDate && showPrevDate) row.push(whData.prev_stock ?? 0);
        row.push(whData.current_stock ?? 0);
        if (selectedDate) row.push(whData.selected_stock ?? 0);
      });

      if (showPrevDate && !selectedDate) row.push(prod.total_prev_stock ?? 0);
      row.push(prod.total_current_stock ?? 0);
      if (showPrevDate && !selectedDate)
        row.push(prod.dynamic_column_stock?.[`quantity_${prevDate}`] ?? 0);
      row.push(prod.dynamic_column_stock?.[`quantity_${currentDate}`] ?? 0);
      if (selectedDate)
        row.push(prod.dynamic_column_stock?.[`quantity_${selectedDate}`] ?? 0);

      if (showPrevDate && !selectedDate)
        row.push(
          (prod.total_prev_stock ?? 0) -
            (prod.dynamic_column_stock?.[`quantity_${prevDate}`] ?? 0)
        );
      row.push(
        (prod.total_current_stock ?? 0) -
          (prod.dynamic_column_stock?.[`quantity_${currentDate}`] ?? 0)
      );
      if (selectedDate)
        row.push(
          (prod.total_current_stock ?? 0) -
            (prod.dynamic_column_stock?.[`quantity_${selectedDate}`] ?? 0)
        );

      return row;
    });
  };

  const handleExportPDF = (orientation = "landscape") => {
    const doc = new jsPDF({ orientation });
    const exportDate = currentDate;
    const today = new Date().toISOString().split("T")[0];

    const title = `Stock Count on ${formatDate(today)}`;
    doc.setFontSize(16);
    doc.setTextColor(40);
    doc.text(title, 14, 20);

    autoTable(doc, {
      head: [getExportHeaders()],
      body: getExportRows(),
      startY: 30,
      theme: "grid",
      showHead: "firstPage",
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontSize: 9,
        fontStyle: "bold",
        halign: "center",
        lineColor: [200, 200, 200],
        lineWidth: 0.5,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [50, 50, 50],
        lineColor: [230, 230, 230],
        lineWidth: 0.3,
      },
      alternateRowStyles: {
        fillColor: [248, 248, 248],
      },
      styles: {
        overflow: "linebreak",
        cellPadding: 2,
        valign: "middle",
      },
      margin: { top: 30, left: 14, right: 14 },
    });

    doc.save(`Stock_Count_${exportDate}.pdf`);
  };

  const handleExportExcel = () => {
    const exportDate = currentDate;

    const worksheet = XLSX.utils.aoa_to_sheet([
      getExportHeaders(),
      ...getExportRows(),
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Stock Count");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(blob, `Stock_Count_${exportDate}.xlsx`);
  };

  const handleDateChange = (e) => {
    const value = e.target.value;
    const selected = new Date(value);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // reset time to midnight for accurate comparison

    if (selected >= today) {
      toast.error("Selected date must be before today.");
      setSelectedDate(""); // reset the invalid date
      return;
    }

    setSelectedDate(value);
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen">

      {/* Hamburger Menu (for mobile view) */}
{/* Header: Mobile hamburger + title */}
<div className="flex justify-between items-center mb-4 lg:hidden">
  <h2 className="text-2xl font-bold whitespace-nowrap">
    Tally Stock Overview
  </h2>

  <button
    className="p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
    onClick={() => setIsMenuOpen(!isMenuOpen)}
    aria-label="Toggle Filters"
  >
    <svg
      className="w-6 h-6 text-gray-700 dark:text-gray-200"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 6h16M4 12h16M4 18h16"
      />
    </svg>
  </button>
</div>


{/* Filters container: always visible on lg+, toggled on sm/md */}
<div className={`border-b border-gray-300 dark:border-gray-600 pb-4 mb-4 ${isMenuOpen ? 'block' : 'hidden'} lg:block`}>
  <div className="flex justify-between items-end flex-wrap gap-4">
    {/* Heading - Hidden on mobile */}
    <h2 className="text-2xl font-bold whitespace-nowrap hidden lg:block relative -top-2">
      Tally Stock Overview
    </h2>

    {/* Filters */}
    <div className="w-full lg:w-auto flex flex-col lg:flex-row lg:items-end lg:gap-4 gap-4">
      {/* Dropdown */}
      <div className="flex flex-col min-w-[220px]">
        <div className="relative w-full" ref={dropdownRef}>
          <button
            type="button"
            className="w-full border border-gray-300 dark:bg-gray-800 rounded px-3 py-2 text-sm bg-white dark:text-white-100 flex justify-between items-center"
            onClick={() => setIsOpen(!isOpen)}
          >
            {selectedWarehouseCodes.length === warehouses.length
              ? "All Warehouses Selected"
              : `${selectedWarehouseCodes.length} selected`}
            <svg
              className="ml-2 w-4 h-4 text-gray-500"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isOpen && (
            <div
              className="absolute left-0 mt-1 bg-white border dark:bg-gray-800 border-gray-300 rounded shadow max-h-60 overflow-y-auto"
              style={{
                zIndex: 9999,
                position: "fixed",
                top: dropdownRef.current?.getBoundingClientRect().bottom + window.scrollY,
                left: dropdownRef.current?.getBoundingClientRect().left,
                width: dropdownRef.current?.offsetWidth,
              }}
            >
              {warehouseOptions.map((opt) => (
                <label
                  key={opt.value}
                  className="block px-3 py-2 text-sm cursor-pointer dark:hover:bg-gray-700 hover:bg-gray-200"
                >
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={
                      opt.value === "ALL"
                        ? isAllSelected
                        : selectedWarehouseCodes.includes(opt.value)
                    }
                    onChange={() => handleOptionChange(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Checkbox */}
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={showPrevDate}
          onChange={() => setShowPrevDate(!showPrevDate)}
          className="form-checkbox accent-blue-600"
        />
        <label className="text-sm font-medium">Show Prev Date Data</label>
      </div>

      {/* Date Picker */}
      <div className="flex flex-col">
        <label className="text-sm font-medium mb-1">Select Prev Date:</label>
        <input
          type="date"
          value={selectedDate || ""}
          onChange={handleDateChange}
          className="border px-2 py-1 rounded dark:bg-gray-800"
        />
      </div>

      {/* Stock Filter Dropdown */}
      <div className="flex flex-col">
        <label htmlFor="filterSelect" className="text-sm font-medium mb-1">
          Filter Stock:
        </label>
        <select
          id="filterSelect"
          name="filterType"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border border-gray-300 dark:bg-gray-800 px-3 py-1.5 rounded-md text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Stocks</option>
          <option value="decrease">Stock Reduced</option>
          <option value="increase">Stock Increased</option>
          <option value="hide_zero">Hide No Change</option>
          <option value="show_zero">Show No Change</option>
        </select>
      </div>
    </div>
  </div>
</div>


      <div className="overflow-x-auto rounded shadow border dark:border-gray-700">
        <div className="flex justify-between items-center dark:bg-gray-800 gap-2 mb-4 bg-gray-100 p-2 rounded flex-wrap">
          {/* Export Buttons */}
          <div className="flex gap-2">
            <button
              className="bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700"
              onClick={() => handleExportPDF("portrait")}
            >
              Export PDF
            </button>
            <button
              className="bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700"
              onClick={() => handleExportPDF("landscape")}
            >
              Export PDF (Landscape)
            </button>
            <button
              className="bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700"
              onClick={handleExportExcel}
            >
              Export Excel
            </button>
          </div>

          {/* Search Input */}
        <div className="w-full sm:w-auto flex-1 min-w-[100px] max-w-sm mt-2 sm:mt-0 flex items-center gap-2">
  <input
    type="text"
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
    placeholder="Search products..."
    className="w-full px-3 py-1.5 rounded border dark:bg-gray-800 text-sm"
  />
  {searchTerm.trim() && (
    <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
      {filteredStockProducts.length} of {products.length}
    </span>
  )}
</div>

        </div>

        <table className="w-full text-sm">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th className="p-2 border dark:border-gray-700 text-left">
                Product Name
              </th>
              {selectedWarehouses.map((wh) => (
                <React.Fragment key={wh.code}>
                  {!selectedDate && showPrevDate && (
                    <th className="p-2 border dark:border-gray-700 text-center">
                      {wh.code} (P)
                    </th>
                  )}
                  <th className="p-2 border dark:border-gray-700 text-center">
                    {wh.code} (C)
                  </th>
                  {selectedDate && (
                    <th className="p-2 border dark:border-gray-700 text-center">
                      {wh.code} (P)
                    </th>
                  )}
                </React.Fragment>
              ))}
              {!selectedDate && showPrevDate && (
                <th className="p-2 border dark:border-gray-700 text-center">
                  TOT PST
                </th>
              )}
              {selectedDate && (
                <th className="p-2 border dark:border-gray-700 text-center">
                  TOT PST
                </th>
              )}
              <th className="p-2 border dark:border-gray-700 text-center">
                TOT CST
              </th>
              {!selectedDate && showPrevDate && (
                <th className="p-2 border dark:border-gray-700 text-center">
                  PST (TLY)
                </th>
              )}
              <th className="p-2 border dark:border-gray-700 text-center">
                CST (TLY)
              </th>
              {selectedDate && (
                <th className="p-2 border dark:border-gray-700 text-center">
                  PST (TLY)
                </th>
              )}
              {!selectedDate && showPrevDate && (
                <th className="p-2 border dark:border-gray-700 text-center">
                  PrDF
                </th>
              )}
              <th className="p-2 border dark:border-gray-700 text-center">
                CDF
              </th>
              {selectedDate && (
                <th className="p-2 border dark:border-gray-700 text-center">
                  PrDF
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {paginatedProducts.length > 0 ? (
            paginatedProducts.map((prod, idx) => (
              <tr key={prod.id ?? prod.product_id ?? idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="p-2 border dark:border-gray-700">
                  {prod.product_name}
                </td>
                {selectedWarehouses.map((wh) => (
                  <React.Fragment key={wh.code}>
                    {!selectedDate && showPrevDate && (
                      <td className="p-2 border text-center">
                        {prod.warehouses?.[wh.id.toString()]?.prev_stock ?? 0}
                      </td>
                    )}
                    <td className="p-2 border text-center">
                      {prod.warehouses?.[wh.id.toString()]?.current_stock ?? 0}
                    </td>
                    {selectedDate && (
                      <td className="p-2 border text-center">
                        {prod.warehouses?.[wh.id.toString()]?.selected_stock ??
                          0}
                      </td>
                    )}
                  </React.Fragment>
                ))}
                {!selectedDate && showPrevDate && (
                  <td className="p-2 border dark:border-gray-700 text-center">
                    {prod.total_prev_stock || 0}
                  </td>
                )}
                {selectedDate && (
                  <td className="p-2 border dark:border-gray-700 text-center">
                    {prod.total_prev_stock || 0}
                  </td>
                )}
                <td className="p-2 border text-center">
                  {prod.total_current_stock ?? 0}
                </td>
                {!selectedDate && showPrevDate && (
                  <td className="p-2 border text-center">
                    {prod.dynamic_column_stock?.[`quantity_${prevDate}`] ?? 0}
                  </td>
                )}
                <td className="p-2 border text-center">
                  {prod.dynamic_column_stock?.[`quantity_${currentDate}`] ?? 0}
                </td>
                {selectedDate && (
                  <td className="p-2 border text-center">
                    {prod.dynamic_column_stock?.[`quantity_${selectedDate}`] ??
                      0}
                  </td>
                )}
                {!selectedDate && showPrevDate && (
                  <td className="p-2 border text-center">
                    {(prod.total_prev_stock ?? 0) -
                      (prod.dynamic_column_stock?.[`quantity_${prevDate}`] ??
                        0)}
                  </td>
                )}
                <td className="p-2 border text-center">
                  {(prod.total_current_stock ?? 0) -
                    (prod.dynamic_column_stock?.[`quantity_${currentDate}`] ??
                      0)}
                </td>
                {selectedDate && (
                  <td className="p-2 border text-center">
                    {(prod.total_prev_stock ?? 0) -
                      (prod.dynamic_column_stock?.[
                        `quantity_${selectedDate}`
                      ] ?? 0)}
                  </td>
                )}
              </tr>
            ))
            ) : (
              <tr>
                <td
                  colSpan={20}
                  className="p-4 text-center text-gray-500 dark:text-gray-400"
                >
                  {products.length === 0
                    ? "No products found."
                    : "No products match your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center mt-4">
        <button
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="px-3 py-1 bg-blue-600 text-white rounded disabled:bg-gray-400"
        >
          Previous
        </button>
        <span className="text-sm">
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={() =>
            setCurrentPage((prev) => Math.min(prev + 1, totalPages))
          }
          disabled={currentPage === totalPages}
          className="px-3 py-1 bg-blue-600 text-white rounded disabled:bg-gray-400"
        >
          Next
        </button>
      </div>
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default StockTally;
