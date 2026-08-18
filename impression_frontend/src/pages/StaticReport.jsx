import React, { useEffect, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import ClipLoader from "react-spinners/ClipLoader";
import BASE_URL from "./config";

ModuleRegistry.registerModules([AllCommunityModule]);

const StaticReport = () => {
  const [rowData, setRowData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [columnDefs, setColumnDefs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [searchText, setSearchText] = useState("");
// ✅ Directly initialize from localStorage or fallback to default values
const [avgSaleFilter, setAvgSaleFilter] = useState(
  localStorage.getItem("avgSaleFilter") || "3"
);
const [monthsFilter, setMonthsFilter] = useState(
  localStorage.getItem("monthsFilter") || "5"
);




useEffect(() => {
  // Save filters when changed
  localStorage.setItem("avgSaleFilter", avgSaleFilter);
  localStorage.setItem("monthsFilter", monthsFilter);
}, [avgSaleFilter, monthsFilter]);



useEffect(() => {
  fetchStaticData();
}, [avgSaleFilter, monthsFilter]);


  useEffect(() => {
    applyFilters();
  }, [searchText, avgSaleFilter, monthsFilter, rowData]);

  const fetchStaticData = async () => {
    setLoading(true);
    setError("");
    try {
     let url = `${BASE_URL}/api/static-reorder-report/`;
if (avgSaleFilter !== "all" || monthsFilter !== "all") {
  url += `?`;
  const params = [];
  if (avgSaleFilter !== "all") params.push(`avg_months=${avgSaleFilter}`);
  if (monthsFilter !== "all") params.push(`projection_months=${monthsFilter}`);
  url += params.join("&");
}

const response = await fetch(url);
    const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `Failed to load report (${response.status})`);
      }

      if (!Array.isArray(data.columns) || !Array.isArray(data.rows)) {
        throw new Error(data.error || "Invalid report response");
      }

     const normalizedCols = data.columns.map((col, index) => {
  const field = col.field.replace(/[.\s]/g, "_");
  return {
    ...col,
    field,
    headerName: col.headerName,
    flex: 1,
    minWidth: 130,
    pinned: index === 0 ? "left" : undefined,
    filter: true,
    sortable: true,
    resizable: true,
    // editable: col.headerName === "Final Order", // ✅ Make Final Order editable
    valueFormatter:
      col.type === "currency"
        ? (params) => {
            const value = Number(params.value);
            return isNaN(value) ? "₹0.00" : `₹${value.toFixed(2)}`;
          }
        : col.type === "number"
        ? (params) => {
            const value = Number(params.value);
            const unit = params.data?.UOM || "";
            return isNaN(value) ? "-" : `${value} ${unit}`;
          }
        : undefined,
  };
});


      const normalizedRows = data.rows.map((row) => {
        const newRow = {};
        for (const key in row) {
          const newKey = key.replace(/[.\s]/g, "_");
          newRow[newKey] = row[key];
        }
        return newRow;
      });

      setColumnDefs(normalizedCols);
      setRowData(normalizedRows);
      setFilteredData(normalizedRows); // initialize
    } catch (error) {
      console.error("❌ Failed to load static reorder report", error);
      setError(error.message || "Failed to load report");
      setColumnDefs([]);
      setRowData([]);
      setFilteredData([]);
    } finally {
      setLoading(false);
    }
  };

const applyFilters = () => {
  const filtered = rowData.filter((row) => {
    const matchesSearch =
      searchText === "" ||
      Object.values(row)
        .join(" ")
        .toLowerCase()
        .includes(searchText.toLowerCase());

    return matchesSearch;
  });

  setFilteredData(filtered);
};

const handleCellValueChanged = async (event) => {
  const { data, colDef, newValue, oldValue } = event;

  if (colDef.field === "Final_Order" && newValue !== oldValue) {
    try {
      // ✅ Here you can send to backend if needed
      console.log("Saving Final Order:", {
        itemname: data.Item_Name,
        finalOrder: newValue,
      });

      // Example: await axios.post("${BASE_URL}/api/save-final-order", { ... });

      // Optionally show feedback to user (toast/snackbar/etc.)
    } catch (err) {
      console.error("Failed to save Final Order", err);
    }
  }
};

const handleArrowKeyEditCommit = (event) => {
  const key = event.event.key;
  const colId = event.column.getColId();

  if (colId !== "Final_Order" || (key !== "ArrowDown" && key !== "ArrowUp")) {
    return;
  }

  event.event.preventDefault();
  event.event.stopPropagation();

  const gridApi = event.api;
  const rowIndex = event.rowIndex;
  const colKey = event.column.getColId();

  // ✅ Get the currently edited value from the DOM manually
  const activeInput = document.querySelector('.ag-cell-edit-input');
  const inputValue = activeInput ? activeInput.value : null;

  if (inputValue !== null) {
    // ✅ Apply new value manually to the row data before stopping edit
    const rowNode = gridApi.getDisplayedRowAtIndex(rowIndex);
    rowNode.setDataValue(colKey, inputValue);
  }

  // ✅ Commit the edit
  // gridApi.stopEditing(true);

  // ✅ Move focus to next/previous row
  const newRowIndex = key === "ArrowDown" ? rowIndex + 1 : rowIndex - 1;

  if (newRowIndex >= 0 && newRowIndex < gridApi.getDisplayedRowCount()) {
    setTimeout(() => {
      gridApi.startEditingCell({
        rowIndex: newRowIndex,
        colKey: colId,
      });
    }, 10);
  }
};





  return (
    <div className="ag-theme-alpine p-4 rounded border bg-white min-h-screen">
      <h2 className="text-xl font-semibold mb-4">ReOrder Report</h2>

      {/* Filters */}
<div className="flex flex-wrap gap-4 items-center mb-4">
  {/* 🔍 Search Input */}
  <div className="flex flex-col">
    <label className="text-sm text-gray-700 mb-1">Search</label>
    <input
      type="text"
      placeholder="🔍 Search..."
      value={searchText}
      onChange={(e) => setSearchText(e.target.value)}
      className="border p-2 rounded w-60"
    />
  </div>

  {/* 📊 Avg. Sale Filter */}
  <div className="flex flex-col">
    <label className="text-sm text-gray-700 mb-1">Avg. Sale</label>
    <select
      value={avgSaleFilter}
      onChange={(e) => setAvgSaleFilter(e.target.value)}
      className="border p-2 rounded"
    >
      <option value="3">Default (3)</option>
      {[...Array(12)].map((_, i) => {
        const val = (i + 1).toString();
        return (
          <option key={val} value={val}>
            {val} {avgSaleFilter === val && val !== "3" ? "(Selected)" : ""}
          </option>
        );
      })}
    </select>
  </div>

  {/* 📅 Months Filter */}
  <div className="flex flex-col">
    <label className="text-sm text-gray-700 mb-1">Months</label>
    <select
      value={monthsFilter}
      onChange={(e) => setMonthsFilter(e.target.value)}
      className="border p-2 rounded"
    >
      <option value="5">Default (5)</option>
      {[...Array(12)].map((_, i) => {
        const val = (i + 1).toString();
        return (
          <option key={val} value={val}>
            {val} {monthsFilter === val && val !== "5" ? "(Selected)" : ""}
          </option>
        );
      })}
    </select>
  </div>
</div>


      {loading ? (
        <div className="flex justify-center items-center py-10">
          <ClipLoader size={45} color="#1d4ed8" />
        </div>
      ) : error ? (
        <div className="text-red-600 py-6 text-center">{error}</div>
      ) : (
        <AgGridReact
  theme="legacy"
  rowData={filteredData}
  columnDefs={columnDefs}
  pagination={true}
  paginationPageSize={20}
  animateRows={true}
  domLayout="autoHeight"
  defaultColDef={{
    filter: true,
    floatingFilter: true,
    sortable: true,
    resizable: true,
    minWidth: 130,
  }}
  // stopEditingWhenCellsLoseFocus={true} // ✅ triggers blur save
  // onCellValueChanged={handleCellValueChanged} 
  // onCellKeyDown={handleArrowKeyEditCommit}// ✅ handle save
/>

      )}
    </div>
  );
};

export default StaticReport;
