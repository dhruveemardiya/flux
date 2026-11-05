import React, { useEffect, useState, useRef } from "react";
import BASE_URL from "./config";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Select, { components } from "react-select";
import { Menu, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

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
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [sortKey, setSortKey] = useState("product_name");
  const [sortDirection, setSortDirection] = useState("asc");
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

  const getProductSortValue = (prod, key) => {
    if (key === "product_name") {
      return (prod.product_name ?? "").toString().trim();
    }
    if (key === "total_current_stock") {
      const val = Number(prod.total_current_stock);
      return isNaN(val) ? 0 : val;
    }
    if (key === "total_prev_stock") {
      const val = Number(prod.total_prev_stock);
      return isNaN(val) ? 0 : val;
    }
    if (key === "cst_tly") {
      const val = Number(prod.dynamic_column_stock?.[`quantity_${currentDate}`]);
      return isNaN(val) ? 0 : val;
    }
    if (key === "pst_tly") {
      const pDate = selectedDate || prevDate;
      const val = Number(prod.dynamic_column_stock?.[`quantity_${pDate}`]);
      return isNaN(val) ? 0 : val;
    }
    if (key === "cdf" || key === "current_stock_diff") {
      const tot = Number(prod.total_current_stock) || 0;
      const cst = Number(prod.dynamic_column_stock?.[`quantity_${currentDate}`]) || 0;
      return tot - cst;
    }
    if (key === "prdf" || key === "prev_stock_diff") {
      const pDate = selectedDate || prevDate;
      const tot = Number(prod.total_prev_stock) || 0;
      const pst = Number(prod.dynamic_column_stock?.[`quantity_${pDate}`]) || 0;
      return tot - pst;
    }
    if (key.startsWith("wh_")) {
      const parts = key.split("_");
      const whId = parts[1];
      const type = parts[2] || "current";
      const whData = prod.warehouses?.[whId] || {};
      if (type === "prev") return Number(whData.prev_stock) || 0;
      if (type === "selected") return Number(whData.selected_stock) || 0;
      return Number(whData.current_stock) || 0;
    }
    return Number(prod[key]) || 0;
  };

  const sortedStockProducts = useMemo(() => {
    const list = [...filteredStockProducts];
    if (!sortKey) return list;

    return list.sort((a, b) => {
      const valA = getProductSortValue(a, sortKey);
      const valB = getProductSortValue(b, sortKey);
      if (typeof valA === "string" && typeof valB === "string") {
        const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: "base" });
        return sortDirection === "asc" ? cmp : -cmp;
      }
      const numA = Number(valA) || 0;
      const numB = Number(valB) || 0;
      return sortDirection === "asc" ? numA - numB : numB - numA;
    });
  }, [filteredStockProducts, sortKey, sortDirection, currentDate, prevDate, selectedDate]);

  // Ensure warehouses is an array before filtering
  const selectedWarehouses = Array.isArray(warehouses)
    ? warehouses.filter((wh) =>
        selectedWarehouseCodes.includes(wh.id.toString())
      )
    : [];

  const totalPages = Math.max(1, Math.ceil(sortedStockProducts.length / rowsPerPage) || 1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, sortKey, sortDirection, rowsPerPage]);

  // Keep currentPage within valid bounds whenever filteredProducts or rowsPerPage changes
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return sortedStockProducts.slice(start, end);
  }, [sortedStockProducts, currentPage, rowsPerPage]);

  const startIndex =
    sortedStockProducts.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const endIndex = Math.min(currentPage * rowsPerPage, sortedStockProducts.length);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const renderSortIcon = (key) => {
    if (sortKey !== key) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 opacity-60 inline-block ml-1 group-hover:opacity-100 transition-opacity" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 inline-block ml-1" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 inline-block ml-1" />
    );
  };

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
    return sortedStockProducts.map((prod) => {
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

      <div className="overflow-x-auto rounded-lg shadow border dark:border-gray-700">
        <div className="flex justify-between items-center dark:bg-gray-800 gap-2 mb-4 bg-gray-100 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 flex-wrap">
          {/* Export Buttons */}
          <div className="flex gap-2 flex-wrap">
            <button
              className="bg-gray-700 hover:bg-gray-800 text-white px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors shadow-sm"
              onClick={() => handleExportPDF("portrait")}
            >
              Export PDF
            </button>
            <button
              className="bg-gray-700 hover:bg-gray-800 text-white px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors shadow-sm"
              onClick={() => handleExportPDF("landscape")}
            >
              Export PDF (Landscape)
            </button>
            <button
              className="bg-gray-700 hover:bg-gray-800 text-white px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors shadow-sm"
              onClick={handleExportExcel}
            >
              Export Excel
            </button>
          </div>

          {/* Table Controls (Sort dropdown, Search, Rows per page, Count) */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Sort Dropdown for space utilization */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded px-2.5 py-1">
              <label htmlFor="stockTallySortSelect" className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap font-medium">
                Sort:
              </label>
              <select
                id="stockTallySortSelect"
                value={`${sortKey}_${sortDirection}`}
                onChange={(e) => {
                  const val = e.target.value;
                  const lastUnderscore = val.lastIndexOf("_");
                  const key = val.substring(0, lastUnderscore);
                  const dir = val.substring(lastUnderscore + 1);
                  setSortKey(key);
                  setSortDirection(dir);
                }}
                className="bg-transparent text-xs sm:text-sm text-gray-800 dark:text-gray-100 outline-none cursor-pointer"
              >
                <option value="product_name_asc" className="dark:bg-gray-800">Product (A → Z)</option>
                <option value="product_name_desc" className="dark:bg-gray-800">Product (Z → A)</option>
                <option value="total_current_stock_desc" className="dark:bg-gray-800">TOT CST (High → Low)</option>
                <option value="total_current_stock_asc" className="dark:bg-gray-800">TOT CST (Low → High)</option>
                <option value="cdf_desc" className="dark:bg-gray-800">CDF Diff (High → Low)</option>
                <option value="cdf_asc" className="dark:bg-gray-800">CDF Diff (Low → High)</option>
                <option value="cst_tly_desc" className="dark:bg-gray-800">CST TLY (High → Low)</option>
                <option value="cst_tly_asc" className="dark:bg-gray-800">CST TLY (Low → High)</option>
                {(showPrevDate || selectedDate) && (
                  <>
                    <option value="total_prev_stock_desc" className="dark:bg-gray-800">TOT PST (High → Low)</option>
                    <option value="total_prev_stock_asc" className="dark:bg-gray-800">TOT PST (Low → High)</option>
                    <option value="prdf_desc" className="dark:bg-gray-800">PrDF Diff (High → Low)</option>
                    <option value="prdf_asc" className="dark:bg-gray-800">PrDF Diff (Low → High)</option>
                    <option value="pst_tly_desc" className="dark:bg-gray-800">PST TLY (High → Low)</option>
                    <option value="pst_tly_asc" className="dark:bg-gray-800">PST TLY (Low → High)</option>
                  </>
                )}
              </select>
            </div>

            {/* Search Input */}
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search products..."
              className="w-full sm:w-52 px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-900 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />

            {/* Rows per page */}
            <select
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(Number(e.target.value))}
              className="px-2.5 py-1.5 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-900 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {[10, 20, 30, 50, 100].map((num) => (
                <option key={num} value={num}>
                  {num} rows
                </option>
              ))}
            </select>

            {searchTerm.trim() && (
              <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                {sortedStockProducts.length} of {products.length}
              </span>
            )}
          </div>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-gray-100 dark:bg-gray-700 select-none">
            <tr>
              <th
                onClick={() => handleSort("product_name")}
                className="p-2 border dark:border-gray-700 text-left cursor-pointer group hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title="Click to sort by Product Name (Ascending / Descending)"
              >
                <div className="flex items-center gap-1">
                  <span className="font-semibold">Product Name</span>
                  {renderSortIcon("product_name")}
                </div>
              </th>
              {selectedWarehouses.map((wh) => (
                <React.Fragment key={wh.code}>
                  {!selectedDate && showPrevDate && (
                    <th
                      onClick={() => handleSort(`wh_${wh.id}_prev`)}
                      className="p-2 border dark:border-gray-700 text-center cursor-pointer group hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      title={`Click to sort by ${wh.code} Previous Stock`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span className="font-semibold">{wh.code} (P)</span>
                        {renderSortIcon(`wh_${wh.id}_prev`)}
                      </div>
                    </th>
                  )}
                  <th
                    onClick={() => handleSort(`wh_${wh.id}_current`)}
                    className="p-2 border dark:border-gray-700 text-center cursor-pointer group hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    title={`Click to sort by ${wh.code} Current Stock`}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span className="font-semibold">{wh.code} (C)</span>
                      {renderSortIcon(`wh_${wh.id}_current`)}
                    </div>
                  </th>
                  {selectedDate && (
                    <th
                      onClick={() => handleSort(`wh_${wh.id}_selected`)}
                      className="p-2 border dark:border-gray-700 text-center cursor-pointer group hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      title={`Click to sort by ${wh.code} Selected Date Stock`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span className="font-semibold">{wh.code} (P)</span>
                        {renderSortIcon(`wh_${wh.id}_selected`)}
                      </div>
                    </th>
                  )}
                </React.Fragment>
              ))}
              {(!selectedDate && showPrevDate) || selectedDate ? (
                <th
                  onClick={() => handleSort("total_prev_stock")}
                  className="p-2 border dark:border-gray-700 text-center cursor-pointer group hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  title="Click to sort by Total Previous Stock"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span className="font-semibold">TOT PST</span>
                    {renderSortIcon("total_prev_stock")}
                  </div>
                </th>
              ) : null}
              <th
                onClick={() => handleSort("total_current_stock")}
                className="p-2 border dark:border-gray-700 text-center cursor-pointer group hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title="Click to sort by Total Current Stock"
              >
                <div className="flex items-center justify-center gap-1">
                  <span className="font-semibold">TOT CST</span>
                  {renderSortIcon("total_current_stock")}
                </div>
              </th>
              {(!selectedDate && showPrevDate) || selectedDate ? (
                <th
                  onClick={() => handleSort("pst_tly")}
                  className="p-2 border dark:border-gray-700 text-center cursor-pointer group hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  title="Click to sort by Previous Tally Stock"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span className="font-semibold">PST (TLY)</span>
                    {renderSortIcon("pst_tly")}
                  </div>
                </th>
              ) : null}
              <th
                onClick={() => handleSort("cst_tly")}
                className="p-2 border dark:border-gray-700 text-center cursor-pointer group hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title="Click to sort by Current Tally Stock"
              >
                <div className="flex items-center justify-center gap-1">
                  <span className="font-semibold">CST (TLY)</span>
                  {renderSortIcon("cst_tly")}
                </div>
              </th>
              {(!selectedDate && showPrevDate) || selectedDate ? (
                <th
                  onClick={() => handleSort("prdf")}
                  className="p-2 border dark:border-gray-700 text-center cursor-pointer group hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  title="Click to sort by Previous Difference"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span className="font-semibold">PrDF</span>
                    {renderSortIcon("prdf")}
                  </div>
                </th>
              ) : null}
              <th
                onClick={() => handleSort("cdf")}
                className="p-2 border dark:border-gray-700 text-center cursor-pointer group hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title="Click to sort by Current Difference"
              >
                <div className="flex items-center justify-center gap-1">
                  <span className="font-semibold">CDF</span>
                  {renderSortIcon("cdf")}
                </div>
              </th>
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

      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mt-4">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {sortedStockProducts.length === 0
            ? "Showing 0 entries"
            : `Showing ${startIndex} to ${endIndex} of ${sortedStockProducts.length} entries`}
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
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
            disabled={currentPage === totalPages || sortedStockProducts.length === 0}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            Next
          </button>
        </div>
      </div>
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default StockTally;
