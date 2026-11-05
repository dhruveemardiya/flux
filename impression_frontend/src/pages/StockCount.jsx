

import React, { useState, useEffect, useRef, useMemo } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import BASE_URL from "./config";
import { useOutletContext } from "react-router-dom";
import { productNameMatchesSearch } from "../utils/productSearch";

export default function StockCount({
    user,
    showPrevDate,
    showPrevDateUser,
    setShowPrevDate,
    setShowPrevDateUser,
}) {
    const [stockData, setStockData] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [selectedWarehouse, setSelectedWarehouse] = useState("");
    const [editingProductId, setEditingProductId] = useState(null);
    const [editedValue, setEditedValue] = useState("");
    const inputRef = useRef(null);
    const [today, setToday] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(50);
    const [sortKey, setSortKey] = useState("product_name");
    const [sortDirection, setSortDirection] = useState("asc");
    const { selectedCompany } = useOutletContext();
    // const [showPrevDate, setShowPrevDate] = useState(false);
    // const [showPrevDateUser, setShowPrevDateUser] = useState(false);// Ensure this is passed as a prop or managed via context
    const normalizedRole = user?.role?.toLowerCase();

    const shouldShowPrevStock =
        (normalizedRole === "superadmin" && showPrevDate) ||
        (normalizedRole === "user" && showPrevDateUser) || (normalizedRole === "admin" && showPrevDate) ;

    const filteredStockData = useMemo(() => {
        if (!searchTerm.trim()) return stockData;
        return stockData.filter((item) =>
            productNameMatchesSearch(item.product_name, searchTerm)
        );
    }, [stockData, searchTerm]);

    const sortedStockData = useMemo(() => {
        const list = [...filteredStockData];
        if (!sortKey) return list;

        return list.sort((a, b) => {
            let valA, valB;
            if (sortKey === "product_name") {
                valA = (a.product_name ?? "").toString().trim();
                valB = (b.product_name ?? "").toString().trim();
                const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: "base" });
                return sortDirection === "asc" ? cmp : -cmp;
            } else if (sortKey === "prev") {
                valA = a.prev === "" || a.prev === null || a.prev === undefined ? -Infinity : Number(a.prev);
                valB = b.prev === "" || b.prev === null || b.prev === undefined ? -Infinity : Number(b.prev);
                if (isNaN(valA)) valA = -Infinity;
                if (isNaN(valB)) valB = -Infinity;
                return sortDirection === "asc" ? valA - valB : valB - valA;
            } else if (sortKey === "current") {
                valA = a.current === "" || a.current === null || a.current === undefined ? -Infinity : Number(a.current);
                valB = b.current === "" || b.current === null || b.current === undefined ? -Infinity : Number(b.current);
                if (isNaN(valA)) valA = -Infinity;
                if (isNaN(valB)) valB = -Infinity;
                return sortDirection === "asc" ? valA - valB : valB - valA;
            }
            return 0;
        });
    }, [filteredStockData, sortKey, sortDirection]);

    const totalPages = Math.max(1, Math.ceil(sortedStockData.length / rowsPerPage) || 1);

    const paginatedStockData = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return sortedStockData.slice(start, start + rowsPerPage);
    }, [sortedStockData, currentPage, rowsPerPage]);

    const startIndex =
        sortedStockData.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
    const endIndex = Math.min(currentPage * rowsPerPage, sortedStockData.length);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, rowsPerPage, sortKey, sortDirection]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

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

    const getExportRows = (rows) =>
        rows.map((item) => {
            const row = [item.product_name];
            if (showPrevDate) {
                row.push(item.prev ?? "");
            }
            row.push(
                item.current === "" || item.current === null ? "0" : item.current
            );
            return row;
        });

    const updateSetting = async (name, value) => {
        const token = localStorage.getItem("authToken");
        try {
            const res = await fetch(`${BASE_URL}/api/show-prev-date/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `token ${token}`,
                },
                body: JSON.stringify({ name, show: value }),
            });

            if (!res.ok) {
                throw new Error("Failed to update setting");
            }

            // ✅ Re-fetch updated settings to reflect change
            const updatedSettings = await fetch(`${BASE_URL}/api/show-prev-date/`, {
                headers: {
                    Authorization: `token ${token}`,
                },
            });

            const settingsData = await updatedSettings.json();
            //   console.log("Updated settings after post:", settingsData); // Debug

            const userSetting = settingsData.find((s) => s.name === "show_prev_date_user");
            const adminSetting = settingsData.find((s) => s.name === "show_prev_date");

            // ✅ Force boolean parsing (some APIs return strings like "true"/"false")
            const toBool = (v) => v === true || v === "true";

            if (userSetting) {
                // console.log("Resolved userSetting.show to:", toBool(userSetting.show));
                setShowPrevDateUser(toBool(userSetting.show));
            }
            if (adminSetting) {
                // console.log("Resolved adminSetting.show to:", toBool(adminSetting.show));
                setShowPrevDate(toBool(adminSetting.show));
            }

        } catch (error) {
            //   console.error("Error updating setting:", error);
        }
    };


    const exportToExcel = (includeData = true) => {
        const headers = ["Product Name"];
        if (showPrevDate) headers.push("Previous Stock");
        headers.push("Current Stock");

        const rowsToExport = sortedStockData;
        const data = includeData
            ? getExportRows(rowsToExport)
            : rowsToExport.map((item) => [item.product_name]);
    
        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Stock Data");
    
        const today = new Date().toISOString().split("T")[0];
        const filename = includeData
            ? `stock_data_${today}.xlsx`
            : `stock_product_list_${today}.xlsx`;
    
        const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        const dataBlob = new Blob([excelBuffer], { type: "application/octet-stream" });
        saveAs(dataBlob, filename);
    };
    

    const exportToPDF = (includeData = true) => {
        const doc = new jsPDF();
    
        const today = new Date().toISOString().split("T")[0];
    
      // Add Heading
doc.setFontSize(18);
doc.setTextColor(0, 0, 0); // Black text
doc.text(`Stock Count on ${today}`, doc.internal.pageSize.getWidth() / 2, 13, { align: 'center' });

        const headers = ["Product Name"];
        if (includeData && showPrevDate) headers.push("Previous Stock");
        headers.push("Current Stock"); // Always add Current Stock, even if includeData is false
    
        const rowsToExport = sortedStockData;
        const data = includeData
            ? getExportRows(rowsToExport)
            : rowsToExport.map((item) => {
                const row = [item.product_name];
                if (showPrevDate) row.push("-");
                row.push("");
                return row;
            });
    
        autoTable(doc, {
            startY: 25, // Start after the header
            head: [headers],
            body: data,
            styles: {
                fillColor: [240, 240, 240], // Light grey background for cells
                textColor: [50, 50, 50],    // Dark text
                halign: 'center',
                valign: 'middle',
            },
            headStyles: {
                fillColor: [255, 255, 255],
                textColor: [0, 0, 0],
                fontSize: 9,
                fontStyle: 'bold',
                halign: 'center',
                lineColor: [200, 200, 200],
                lineWidth: 0.5,
              },
            alternateRowStyles: {
                fillColor: [220, 220, 220], // Slightly lighter grey for alternate rows
            },
            margin: { top: 20 },
            theme: "grid",
        });
    
        const filename = includeData
            ? `stock_data_${today}.pdf`
            : `stock_product_list_${today}.pdf`;
    
        doc.save(filename);
    };
    

    // ✅ Get today's date from backend (IST)
    useEffect(() => {
        fetch(`${BASE_URL}/api/today/`)
            .then(res => res.json())
            .then(data => {
                setToday(data.today); // Format: YYYY-MM-DD
            })
        // .catch(err => console.error("Failed to fetch today's date", err));
    }, []);

    // ✅ Load warehouses
useEffect(() => {
  const fetchWarehouses = async () => {
    try {
      const token = localStorage.getItem("authToken");
      if (!token) return;

      // Fetch current user info to get companies
      const userRes = await fetch(`${BASE_URL}/api/users/me/`, {
        headers: {
          Authorization: `Token ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!userRes.ok) throw new Error("Failed to fetch user info");
      const user = await userRes.json();

      // Determine companyId from selectedCompany or user companies
      let companyId = null;
      if (user.role === "superadmin") {
        companyId = selectedCompany?.id || user.companies?.[0];
      } else {
        companyId = user.companies?.[0];
      }

      if (!companyId) return;

      // Fetch warehouses for the company
      const res = await fetch(`${BASE_URL}/api/get_warehouse/?company_id=${companyId}`, {
        headers: {
          Authorization: `Token ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) throw new Error("Failed to fetch warehouses");
      const data = await res.json();

      setWarehouses(data);
      if (data.length > 0) setSelectedWarehouse(data[0].id);
      setSearchTerm("");
    } catch (err) {
      console.error(err);
    }
  };

  fetchWarehouses();
}, [selectedCompany]);


  useEffect(() => {
  if (!selectedWarehouse || !today) return;

  const fetchStock = async () => {
    try {
      const token = localStorage.getItem("authToken");
      if (!token) return;

      const res = await fetch(
        `${BASE_URL}/api/get_products_with_latest_stock/?warehouse_id=${selectedWarehouse}&date=${today}`,
        {
          headers: {
            Authorization: `Token ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (!res.ok) throw new Error("Failed to fetch stock");

      const data = await res.json();

      const merged = data
        .filter((item) => item.is_active !== false)
        .map((item) => ({
        ...item,
        current: item.current_quantity ?? "",
        prev: item.previous_quantity ?? 0,
        prev_date: item.previous_date ?? null,
      }));

      setStockData(merged);
      setSearchTerm("");
      setCurrentPage(1);
    } catch (err) {
      console.error(err);
    }
  };

  fetchStock();
}, [selectedWarehouse, today]);



    
    const handleWarehouseChange = (e) => {
        setSelectedWarehouse(e.target.value);
        setSearchTerm("");
        setEditingProductId(null);
        setCurrentPage(1);
    };

    const handleCellClick = (productId) => {
        setEditingProductId(productId);
        const item = stockData.find((row) => row.product_id === productId);
        setEditedValue(item?.current?.toString() ?? "");
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const handleBlur = () => {
        if (editingProductId === null) return;

        const index = stockData.findIndex((row) => row.product_id === editingProductId);
        if (index === -1) {
            setEditingProductId(null);
            setEditedValue("");
            return;
        }

        const updated = [...stockData];
        const currentItem = updated[index];
        const newValue = editedValue === "" || isNaN(editedValue) ? null : parseFloat(editedValue);
        currentItem.current = newValue !== null ? newValue : "";

        setStockData(updated);
        setEditingProductId(null);
        setEditedValue("");

        if (newValue !== null) {
            const payload = {
                product_id: currentItem.product_id,
                warehouse_id: selectedWarehouse,
                date: today,
                quantity: newValue,
            };

            fetch(`${BASE_URL}/api/update_stock/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            })
                .then(async res => {
                    const data = await res.json();
                    if (!res.ok) {
                        throw new Error(data.detail || "Failed to update stock");
                    }
                })
                .catch(() => {});
        }
    };


    const handleKeyDown = (e) => {
        if (editingProductId === null) return;
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            handleBlur();
            const currentIndex = paginatedStockData.findIndex(
                (row) => row.product_id === editingProductId
            );
            const newIndex = e.key === "ArrowDown" ? currentIndex + 1 : currentIndex - 1;
            if (newIndex >= 0 && newIndex < paginatedStockData.length) {
                handleCellClick(paginatedStockData[newIndex].product_id);
            }
        }
    };

    const handleInputChange = (e) => {
        let val = e.target.value.replace(/[^0-9.]/g, "");
        const dotCount = (val.match(/\./g) || []).length;
        if (dotCount > 1) {
            val = val.slice(0, val.lastIndexOf("."));
        }
        setEditedValue(val);
    };

    const handleKeepPreviousStock = () => {
        const updated = [...stockData];
        const todayDate = today; // from your state already set by the API

        updated.forEach((item, index) => {
            if (item.prev !== null && item.prev !== undefined) {
                item.current = item.prev;

                // Immediately save to backend
                const payload = {
                    product_id: item.product_id,
                    warehouse_id: selectedWarehouse,
                    date: todayDate,
                    quantity: item.prev,
                };

                // console.log("Saving copied stock to backend:", payload); // 👈 Debug print

                fetch(`${BASE_URL}/api/update_stock/`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                })
                    .then(res => res.json())
                    .then(data => {
                        // console.log("Saved:", data);
                    })
                    .catch(err => {
                        // console.error("Error updating stock:", err);
                    });
            }
        });

        setStockData(updated);
    };


    const formattedToday = today
        ? new Date(today).toLocaleDateString("en-GB")
        : "Loading...";

    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white p-4">
            <div className="w-full mx-auto space-y-4">
                <h1 className="text-2xl font-bold">Stock Count</h1>
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="text-sm font-medium">
                        Today's Date: <span className="font-normal">{formattedToday}</span>
                    </div>
                    <div className="flex items-center gap-2 mx-auto">
                        <label htmlFor="warehouse" className="text-sm font-medium">
                            Select Warehouse:
                        </label>
                        <select
                            id="warehouse"
                            value={selectedWarehouse}
                            onChange={handleWarehouseChange}
                            className="p-2 rounded border border-gray-300 dark:bg-gray-800 dark:border-gray-700 text-sm"
                        >
                            {warehouses.map((wh) => (
                                <option key={wh.id} value={wh.id}>
                                    {wh.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
                        onClick={handleKeepPreviousStock}
                    >
                        Keep Previous Stock
                    </button>

                </div>
                {(user?.role === "superadmin" || user?.role === "Admin") && (
                    <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                className="accent-blue-600"
                                checked={showPrevDate}
                                onChange={() => {
                                    const newValue = !showPrevDate;
                                    setShowPrevDate(newValue);
                                    updateSetting("show_prev_date", newValue);
                                }}
                            />
                            Show Prev Date
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                className="accent-blue-600"
                                checked={showPrevDateUser}
                                onChange={(e) => {
                                    const newValue = e.target.checked; // Proper boolean value
                                    setShowPrevDateUser(newValue);
                                    updateSetting("show_prev_date_user", newValue);
                                }}
                            />
                            Show Prev Date (User)
                        </label>


                    </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 dark:bg-gray-800/60 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors shadow-sm"
                            onClick={() => exportToExcel(true)}
                        >
                            Export to Excel
                        </button>
                        <button
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors shadow-sm"
                            onClick={() => exportToExcel(false)}
                        >
                            Export without Data (Excel)
                        </button>
                        <button
                            className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors shadow-sm"
                            onClick={() => exportToPDF(false)}
                        >
                            Export without Data (PDF)
                        </button>
                        <button
                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors shadow-sm"
                            onClick={() => exportToPDF(true)}
                        >
                            Export to PDF
                        </button>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        {/* Sort Dropdown for compact space utilization */}
                        <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2.5 py-1">
                            <label htmlFor="stockCountSortSelect" className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap font-medium">
                                Sort:
                            </label>
                            <select
                                id="stockCountSortSelect"
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
                                <option value="current_desc" className="dark:bg-gray-800">Current Stock (High → Low)</option>
                                <option value="current_asc" className="dark:bg-gray-800">Current Stock (Low → High)</option>
                                {shouldShowPrevStock && (
                                    <>
                                        <option value="prev_desc" className="dark:bg-gray-800">Previous Stock (High → Low)</option>
                                        <option value="prev_asc" className="dark:bg-gray-800">Previous Stock (Low → High)</option>
                                    </>
                                )}
                            </select>
                        </div>

                        {/* Search products */}
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setEditingProductId(null);
                            }}
                            placeholder="Search products..."
                            className="w-full sm:w-56 px-3 py-1.5 rounded border border-gray-300 dark:bg-gray-800 dark:border-gray-700 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />

                        {/* Rows per page */}
                        <select
                            value={rowsPerPage}
                            onChange={(e) => setRowsPerPage(Number(e.target.value))}
                            className="px-2.5 py-1.5 rounded border border-gray-300 dark:bg-gray-800 dark:border-gray-700 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            {[10, 20, 30, 50, 100].map((num) => (
                                <option key={num} value={num}>
                                    {num} rows
                                </option>
                            ))}
                        </select>

                        {searchTerm.trim() && (
                            <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                                {sortedStockData.length} of {stockData.length}
                            </span>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto border rounded-lg shadow dark:border-gray-700">
                    <table className="min-w-full text-sm text-left border-collapse">
                        <thead className="bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200 select-none">
                            <tr>
                                <th
                                    onClick={() => handleSort("product_name")}
                                    className="p-3 border-b dark:border-gray-700 cursor-pointer group hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                                    title="Click to sort by Product Name (Ascending / Descending)"
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-semibold">Product Name</span>
                                        {renderSortIcon("product_name")}
                                    </div>
                                </th>

                                {/* Conditionally show 'Stock on' column */}
                                {shouldShowPrevStock && (
                                    <th
                                        onClick={() => handleSort("prev")}
                                        className="p-3 border-b dark:border-gray-700 cursor-pointer group hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                                        title="Click to sort by Previous Stock (Ascending / Descending)"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-semibold">
                                                Stock on {
                                                    (() => {
                                                        try {
                                                            const validPrev = stockData.find((item) => item.prev_date);
                                                            if (validPrev) {
                                                                return new Date(validPrev.prev_date).toLocaleDateString("en-GB");
                                                            } else {
                                                                const yesterday = new Date();
                                                                yesterday.setDate(yesterday.getDate() - 1);
                                                                return yesterday.toLocaleDateString("en-GB");
                                                            }
                                                        } catch (err) {
                                                            return "Invalid Date";
                                                        }
                                                    })()
                                                }
                                            </span>
                                            {renderSortIcon("prev")}
                                        </div>
                                    </th>
                                )}

                                <th
                                    onClick={() => handleSort("current")}
                                    className="p-3 border-b dark:border-gray-700 cursor-pointer group hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                                    title="Click to sort by Current Stock (Ascending / Descending)"
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-semibold">Current Stock</span>
                                        {renderSortIcon("current")}
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedStockData.length > 0 ? (
                            paginatedStockData.map((item, index) => (
                                <tr
                                    key={item.product_id}
                                    className={
                                        index % 2 === 0
                                            ? "bg-white dark:bg-gray-900"
                                            : "bg-gray-50 dark:bg-gray-800"
                                    }
                                >
                                    <td className="p-3 border-b dark:border-gray-700">
                                        {item.product_name}
                                    </td>

                                    {shouldShowPrevStock && (
                                        <td className="p-3 border-b dark:border-gray-700">
                                            {item.prev ?? "-"}
                                        </td>
                                    )}


                                    <td
                                        className="p-3 border-b dark:border-gray-700 cursor-pointer"
                                        onClick={() => handleCellClick(item.product_id)}
                                    >
                                        {editingProductId === item.product_id ? (
                                            <input
                                                ref={inputRef}
                                                type="text"
                                                value={editedValue}
                                                onChange={handleInputChange}
                                                onBlur={handleBlur}
                                                onKeyDown={handleKeyDown}
                                                className="w-full px-2 py-1 border rounded text-sm bg-white dark:bg-gray-700 dark:text-white outline-none"
                                            />
                                        ) : (
                                            <span>
                                                {item.current === "" || item.current === null ? "Add" : item.current}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))
                            ) : (
                                <tr>
                                    <td
                                        colSpan={shouldShowPrevStock ? 3 : 2}
                                        className="p-4 text-center text-gray-500 dark:text-gray-400"
                                    >
                                        {stockData.length === 0
                                            ? "No products found."
                                            : "No products match your search."}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                        {sortedStockData.length === 0
                            ? "Showing 0 entries"
                            : `Showing ${startIndex} to ${endIndex} of ${sortedStockData.length} entries`}
                    </span>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                            Prev
                        </button>
                        <span className="text-sm">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            type="button"
                            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages || sortedStockData.length === 0}
                            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                            Next
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

