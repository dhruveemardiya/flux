import React, { useState, useEffect, useMemo } from "react";
import * as XLSX from 'xlsx'
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import axios from "axios";
import { useLocation } from "react-router-dom";
import BASE_URL from "./config";
import { toast } from "react-toastify";
import { FaArrowUp, FaEyeSlash, FaFilter, FaSyncAlt, FaTrash } from "react-icons/fa";

const normalizePhone = (raw) => {
  if (!raw) return "";

  const phones = new Set();
  String(raw)
    .split(/[,;/]+/)
    .map((part) => part.trim())
    .filter((part) => !/[a-zA-Z]/.test(part))
    .forEach((part) => {
      let digits = part.replace(/\D/g, "");
      if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
      if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
      if (digits.length === 10) phones.add(digits);
    });

  return phones.size > 0 ? [...phones].sort().join(", ") : "";
};

export default function DataMapping() {
  const location = useLocation();
  const hiddenMappingFields = new Set([
    "id", "created_at", "updated_at", "company_id", "created_by_id",
  ]);
  const mergeableFields = [
    "company_upload_name",
    "phone",
    "address_line1",
    "country",
    "city",
    "state",
    "pincode",
  ];

  const [activePanel, setActivePanel] = useState(() => {
    const params = new URLSearchParams(location.search);
    const panel = params.get("panel");
    if (panel === "manual" || panel === "bulk" || panel === "view") return panel;
    return "view";
  });
  const [form, setForm] = useState({
    first_name: "", last_name: "", phone_number: "",
    address_line_1: "", address_line_2: "", country: "", city: "", state: "", pincode: "",
  });

  const [file, setFile] = useState(null);
  const [excelHeaders, setExcelHeaders] = useState([]);
  const [sheetRows, setSheetRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [mapping, setMapping] = useState({});
  const [previewRows, setPreviewRows] = useState([]);

  const [uniqueRows, setUniqueRows] = useState([]);
  const [duplicateRows, setDuplicateRows] = useState([]);
  const [insertedCount, setInsertedCount] = useState(0);
  const [showSummaryCards, setShowSummaryCards] = useState(false);
  const [activeTable, setActiveTable] = useState(null);
  const [selectedDuplicateIds, setSelectedDuplicateIds] = useState([]);
  const [matchedRowIds, setMatchedRowIds] = useState(null);
  const [mergeSearchedIds, setMergeSearchedIds] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [duplicateSearchTerm, setDuplicateSearchTerm] = useState("");
  const [duplicateSearchInput, setDuplicateSearchInput] = useState("");
  const [duplicateSortKey, setDuplicateSortKey] = useState("id");
  const [duplicateSortDirection, setDuplicateSortDirection] = useState("desc");
  const [rawDuplicateRows, setRawDuplicateRows] = useState([]);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [showMergeActionBar, setShowMergeActionBar] = useState(false);
  const [mergeFieldSelections, setMergeFieldSelections] = useState({});
  const [duplicateCurrentPage, setDuplicateCurrentPage] = useState(1);
  const [duplicateRowsPerPage, setDuplicateRowsPerPage] = useState(10);
  const [uploading, setUploading] = useState(false);
  const [viewRows, setViewRows] = useState([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewPage, setViewPage] = useState(1);
  const [viewPerPage, setViewPerPage] = useState(20);
  const [selectedViewIds, setSelectedViewIds] = useState([]);
  const [viewDeleteConfirmOpen, setViewDeleteConfirmOpen] = useState(false);
  const [viewDeleteConfirmTarget, setViewDeleteConfirmTarget] = useState([]);
  const [showViewFilters, setShowViewFilters] = useState(false);
  const [viewSearchFilter, setViewSearchFilter] = useState("");
  const [viewFileNameFilter, setViewFileNameFilter] = useState("");
  const [viewCityFilter, setViewCityFilter] = useState("");
  const [viewDateFilter, setViewDateFilter] = useState("");
  const hiddenViewColumns = new Set([
    "created_at",
    "updated_at",
    "created_by",
    "created_by_id",
    "file_uploaded_at",
    "file_uploaded_by",
  ]);

  useEffect(() => {
    if (selectedDuplicateIds.length === 0 && (matchedRowIds !== null || mergeSearchedIds !== null)) {
      setMatchedRowIds(null);
      setMergeSearchedIds(null);
    }
  }, [selectedDuplicateIds, matchedRowIds, mergeSearchedIds]);

  useEffect(() => {
    const fetchColumns = async () => {
      try {
        const token = localStorage.getItem("authToken");
        const res = await axios.get(`${BASE_URL}/api/customers/columns/`, {
          headers: token ? { Authorization: `Token ${token}` } : {},
        });
        if (res?.data && Array.isArray(res.data?.columns)) setColumns(res.data.columns);
        else if (res?.data && Array.isArray(res.data)) setColumns(res.data);
        else throw new Error("unexpected columns response");
      } catch {
        setColumns([
          "first_name", "last_name", "phone_number", "address_line_1",
          "address_line_2", "country", "city", "state", "pincode",
          "company_upload_name", "docat", "reviews",
        ]);
      }
    };
    fetchColumns();
  }, []);

  useEffect(() => {
    if (activePanel === "view") {
      fetchAllData();
    }
  }, [activePanel]);

  const fetchAllData = async () => {
    setViewLoading(true);
    try {
      const token = localStorage.getItem("authToken");
      const res = await axios.get(`${BASE_URL}/api/customers/`, { headers: token ? { Authorization: `Token ${token}` } : {} });
      const data = Array.isArray(res?.data?.customers) ? res.data.customers : Array.isArray(res?.data) ? res.data : [];
      setViewRows(data);
      setViewPage(1);
      setSelectedViewIds([]);
    } catch (error) {
      console.error(error);
      toast.error("Failed to fetch data.");
      setViewRows([]);
    } finally {
      setViewLoading(false);
    }
  };

  const toggleSelectViewId = (id) => {
    setSelectedViewIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAllFilteredViewRows = () => {
    const allFilteredIds = filteredViewRows.map((row) => row.id).filter(Boolean);
    if (!allFilteredIds.length) {
      toast.info("No rows available to select.");
      return;
    }

    setSelectedViewIds((prev) => [...new Set([...prev, ...allFilteredIds])]);
    toast.success(`Selected ${allFilteredIds.length} row(s).`);
  };

  const clearViewFilters = () => {
    setViewSearchFilter("");
    setViewFileNameFilter("");
    setViewCityFilter("");
    setViewDateFilter("");
    setSelectedViewIds([]);
    setViewDeleteConfirmTarget([]);
    setViewPage(1);
  };

  const buildViewExportRows = () => {
    const rowsToExport = selectedViewIds.length
      ? filteredViewRows.filter((row) => selectedViewIds.includes(row.id))
      : filteredViewRows;

    return rowsToExport.map((row) => {
      const exportRow = {};
      visibleViewColumns.forEach((column) => {
        exportRow[column] = row?.[column] ?? "";
      });
      return exportRow;
    });
  };

  const formatExportDate = () => {
    const now = new Date();
    return now.toLocaleString("en-IN", {
      weekday: "short",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  const getFileDateStamp = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}${mm}${dd}`;
  };

  const buildViewExportMatrix = () => {
    const exportRows = buildViewExportRows();
    const headers = visibleViewColumns.map((column) =>
      String(column || "")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase())
    );
    const headersWithIndex = ["Sr No", ...headers];
    const rowsWithIndex = exportRows.map((row, rowIndex) => [
      String(rowIndex + 1),
      ...visibleViewColumns.map((column) => String(row?.[column] ?? "")),
    ]);

    return { headersWithIndex, rowsWithIndex, count: exportRows.length };
  };

  const downloadViewCsv = () => {
    const { headersWithIndex, rowsWithIndex, count } = buildViewExportMatrix();
    if (!count) {
      toast.info("No rows available to export.");
      return;
    }

    const worksheet = XLSX.utils.aoa_to_sheet([
      ["Customer View Report"],
      [`Generated On: ${formatExportDate()}`],
      [`Total Rows: ${count}`],
      [],
      headersWithIndex,
      ...rowsWithIndex,
    ]);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `customers_view_${getFileDateStamp()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadViewExcel = () => {
    const { headersWithIndex, rowsWithIndex, count } = buildViewExportMatrix();
    if (!count) {
      toast.info("No rows available to export.");
      return;
    }

    const headerRowIndex = 5;

    const worksheet = XLSX.utils.aoa_to_sheet([
      ["Customer View Report"],
      [`Generated On: ${formatExportDate()}`],
      [`Total Rows: ${count}`],
      [],
      headersWithIndex,
      ...rowsWithIndex,
    ]);

    const lastColumnIndex = headersWithIndex.length - 1;
    worksheet["!merges"] = [0, 1, 2].map((rowIndex) => ({
      s: { r: rowIndex, c: 0 },
      e: { r: rowIndex, c: lastColumnIndex },
    }));

    worksheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: headerRowIndex, c: 0 },
        e: { r: headerRowIndex, c: lastColumnIndex },
      }),
    };

    worksheet["!rows"] = [
      { hpt: 26 },
      { hpt: 20 },
      { hpt: 20 },
      { hpt: 8 },
      { hpt: 18 },
    ];

    worksheet["!cols"] = headersWithIndex.map((header, index) => {
      const maxDataLength = rowsWithIndex.reduce((max, row) => Math.max(max, String(row[index] ?? "").length), 0);
      const minWidth = index === 0 ? 8 : 12;
      return { wch: Math.min(Math.max(header.length, maxDataLength, 12), 40) };
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Customers");
    XLSX.writeFile(workbook, `customers_view_${getFileDateStamp()}.xlsx`);
  };

  const downloadViewPdf = () => {
    const { headersWithIndex, rowsWithIndex, count } = buildViewExportMatrix();
    if (!count) {
      toast.info("No rows available to export.");
      return;
    }

    const tableStartY = 70;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a3" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageMargins = { left: 8, right: 8 };
    const availableTableWidth = pageWidth - pageMargins.left - pageMargins.right;
    const normalizedHeaders = headersWithIndex.map((header) => String(header ?? "").toLowerCase());

    const baseWidths = headersWithIndex.map((header, index) => {
      const normalized = normalizedHeaders[index];
      const isNumberColumn = /phone|mobile|contact|number/.test(normalized);
      const isNameColumn = /name/.test(normalized);
      const isAddressColumn = /address|addr/.test(normalized);
      const minWidth = index === 0 ? 34 : 44;
      const maxWidth = index === 0 ? 40 : isAddressColumn ? 130 : 110;
      const estimated = String(header ?? "").length * 5 + 18;
      const priorityBoost = isAddressColumn ? 16 : isNameColumn ? 10 : isNumberColumn ? 8 : 0;
      return Math.max(minWidth, Math.min(maxWidth, estimated + priorityBoost));
    });
    const totalBaseWidth = baseWidths.reduce((sum, width) => sum + width, 0);
    const widthScale = totalBaseWidth > 0 ? availableTableWidth / totalBaseWidth : 1;
    const scaledWidths = baseWidths.map((width) => Math.max(28, Math.floor(width * widthScale)));
    const columnStyles = Object.fromEntries(
      scaledWidths.map((width, index) => {
        const normalized = normalizedHeaders[index];
        const isAddressColumn = /address|addr/.test(normalized);
        return [
          index,
          {
            cellWidth: width,
            overflow: isAddressColumn ? "linebreak" : "ellipsize",
            valign: isAddressColumn ? "top" : "middle",
          },
        ];
      })
    );

    doc.setFontSize(14);
    doc.text("Customer View Report", pageMargins.left, 28);
    doc.setFontSize(10);
    doc.text(`Generated On: ${formatExportDate()}`, pageMargins.left, 44);
    doc.text(`Total Rows: ${count}`, pageMargins.left, 58);

    autoTable(doc, {
      startY: tableStartY,
      head: [headersWithIndex],
      body: rowsWithIndex,
      tableWidth: availableTableWidth,
      styles: {
        fontSize: 7,
        cellPadding: 3,
        lineColor: [230, 230, 230],
        lineWidth: 0.1,
        overflow: "ellipsize",
      },
      headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: pageMargins,
      columnStyles,
    });

    doc.save(`customers_view_${getFileDateStamp()}.pdf`);
  };

  const deleteRow = async (id) => {
    setViewDeleteConfirmTarget([id]);
    setViewDeleteConfirmOpen(true);
  };

  const deleteSelectedViewRows = async () => {
    const idsToDelete = viewDeleteConfirmTarget.length ? viewDeleteConfirmTarget : selectedViewIds;
    if (!idsToDelete.length) return;
    try {
      const token = localStorage.getItem("authToken");
      await axios.post(
        `${BASE_URL}/api/customers/handle-duplicate/`,
        { action: "delete", ids: idsToDelete },
        { headers: token ? { Authorization: `Token ${token}` } : {} }
      );
      setViewRows((prev) => prev.filter((r) => !idsToDelete.includes(r.id)));
      setSelectedViewIds((prev) => prev.filter((id) => !idsToDelete.includes(id)));
      setViewDeleteConfirmTarget([]);
      toast.success("Deleted selected rows");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete selected rows");
    }
  };

  const getViewFieldValue = (row, keys) => {
    for (const key of keys) {
      const value = row?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return String(value).trim();
      }
    }
    return "";
  };

  const normalizeViewDateValue = (value) => {
    if (value === undefined || value === null || String(value).trim() === "") return "";

    const rawValue = String(value).trim();
    const parsedDate = new Date(rawValue);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString().slice(0, 10);
    }

    return rawValue.slice(0, 10);
  };

  const filteredViewRows = useMemo(() => {
    const searchTerm = viewSearchFilter.trim().toLowerCase();
    const fileTerm = viewFileNameFilter.trim().toLowerCase();
    const cityTerm = viewCityFilter.trim().toLowerCase();
    const dateTerm = viewDateFilter.trim();

    return viewRows.filter((row) => {
      const searchValue = searchTerm
        ? Object.values(row || {})
            .some((value) => String(value ?? "").toLowerCase().includes(searchTerm))
        : true;
      const fileValue = getViewFieldValue(row, ["file_name", "excel_name", "filename", "file"])
        .toLowerCase();
      const cityValue = getViewFieldValue(row, ["city"]).toLowerCase();
      const dateValue = normalizeViewDateValue(row?.file_uploaded_at ?? row?.created_at);

      if (!searchValue) return false;
      if (fileTerm && !fileValue.includes(fileTerm)) return false;
      if (cityTerm && !cityValue.includes(cityTerm)) return false;
      if (dateTerm && dateValue !== dateTerm) return false;
      return true;
    });
  }, [viewRows, viewSearchFilter, viewFileNameFilter, viewCityFilter, viewDateFilter]);

  const filteredViewPageRows = filteredViewRows.slice((viewPage - 1) * viewPerPage, viewPage * viewPerPage);

  const buildViewOptions = (rows, fields) => {
    const optionMap = new Map();

    rows.forEach((row) => {
      const rawValue = getViewFieldValue(row, fields);
      if (!rawValue) return;
      const normalizedValue = rawValue.toLowerCase();
      if (!optionMap.has(normalizedValue)) {
        optionMap.set(normalizedValue, rawValue);
      }
    });

    return [...optionMap.entries()]
      .sort((left, right) => left[1].localeCompare(right[1], undefined, { sensitivity: "base" }))
      .map(([value, label]) => ({ value, label }));
  };

  const viewFileNameOptions = useMemo(
    () => buildViewOptions(viewRows, ["file_name", "excel_name", "filename", "file"]),
    [viewRows]
  );

  const viewCityOptions = useMemo(
    () => buildViewOptions(viewRows, ["city"]),
    [viewRows]
  );

  const viewDateOptions = useMemo(
    () => buildViewOptions(viewRows, ["file_uploaded_at", "created_at"]),
    [viewRows]
  );

  const visibleViewColumns = useMemo(() => {
    const columnSet = new Set();
    viewRows.forEach((row) => {
      Object.keys(row || {}).forEach((column) => columnSet.add(column));
    });

    return [...columnSet].filter((column) => {
      if (hiddenViewColumns.has(column)) return false;
      return viewRows.some((row) => String(row?.[column] ?? "").trim() !== "");
    });
  }, [viewRows]);

  useEffect(() => {
    setViewPage(1);
  }, [viewFileNameFilter, viewCityFilter, viewDateFilter]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("panel") === "view") {
      setShowSummaryCards(false);
      setActiveTable(null);
      setActivePanel("view");
    }
  }, [location.search]);

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    await saveCustomer();
    setActivePanel(null);
  };

  const saveCustomer = async () => {
    try {
      const token = localStorage.getItem("authToken");
      await axios.post(`${BASE_URL}/api/customers/`, form, {
        headers: token ? { Authorization: `Token ${token}` } : {},
      });
      toast.success("Customer saved");
      setForm({
        first_name: "", last_name: "", phone_number: "",
        address_line_1: "", address_line_2: "", country: "", city: "", state: "", pincode: "",
      });
    } catch {
      toast.error("Error saving customer");
    }
  };

  const handleCityBlur = async () => {
    const city = form.city;
    const token = localStorage.getItem("authToken");
    if (!city || city.trim().length < 2) return;
    try {
      const res = await axios.get(
        `${BASE_URL}/api/city-autofill/?city=${encodeURIComponent(city.trim())}`,
        { headers: { Authorization: `Token ${token}` } }
      );
      if (res.data.state || res.data.country) {
        setForm((prev) => ({
          ...prev,
          state: res.data.state || prev.state,
          country: res.data.country || prev.country,
        }));
      }
    } catch { /* silently ignore */ }
  };

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    setFile(f);
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target.result);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true });
      if (json.length > 0) {
        const rawHeaders = json[0].map((h) => (h ? String(h).trim() : ""));
        const validColumnIndices = rawHeaders
          .map((h, index) => (h !== "" ? index : null))
          .filter((index) => index !== null);
        const headers = validColumnIndices.map((index) => rawHeaders[index]);
        const dataRows = json.slice(1).map((row) =>
            validColumnIndices.map((index) => {
              let value = row[index] ?? "";

              if (value === null || value === undefined) return "";

              if (typeof value === "number") {
                // Preserve large numeric identifiers like DOCAT without scientific notation.
                value = Number.isInteger(value) ? value.toString() : value.toFixed(2);
              } else {
                value = String(value).trim();
                value = value.replace(/\r?\n|\r/g, " ");
                value = value.replace(/\t/g, " ");
                value = value.replace(/\s+/g, " ");
              }

              return value;
            })
          );
        setExcelHeaders(headers);
        setSheetRows(dataRows);
        setPreviewRows(dataRows.slice(0, 5));
        const init = {};
        headers.forEach((h) => {
          const headerAliases = {
            "party name": "company_upload_name",
            "party_name": "company_upload_name",
            "company": "company_upload_name",
            "company name": "company_upload_name",
            "customer name": "company_upload_name",
            "firm name": "company_upload_name",
            "business name": "company_upload_name",
            "shop name": "company_upload_name",
            "name": "company_upload_name",

            // Phone aliases -> DB field `phone`
            "number": "phone",
            "mobile": "phone",
            "mobile number": "phone",
            "phone": "phone",
            "phone number": "phone",

            // Address aliases -> DB field `address_line1`
            "adress": "address_line1",
            "address": "address_line1",

            "review": "reviews",
            "docat": "docat",
          };
          const normalizedHeader = (h || "").toLowerCase().trim();
          const aliasTarget = headerAliases[normalizedHeader];
          const guess = aliasTarget
            || columns.find((c) => c.toLowerCase() === normalizedHeader)
            || "";
          init[h] = guess;
        });
        setMapping(init);
      }
    };
    reader.readAsArrayBuffer(f);
  };

  const handleUpload = async () => {
    if (!file) return toast.error("Choose a file first");
    if (!excelHeaders.length || !sheetRows.length) {
      toast.error("Please upload an Excel file first.");
      return;
    }

    setUploading(true);
    try {
      const trimmedHeaders = excelHeaders.map((h) => (h ? String(h).trim() : ""));
      const column_mapping = {};
      trimmedHeaders.forEach((h) => {
        if (mapping[h]) column_mapping[h] = mapping[h];
      });

      const rows_for_payload = sheetRows.map((row) => {
        const obj = {};
        trimmedHeaders.forEach((excelHeader, index) => {
          const dbField = column_mapping[excelHeader];
          if (dbField) obj[dbField] = row[index] ?? "";
        });
        return obj;
      }).filter((r) => Object.keys(r).length > 0);

      if (!rows_for_payload.length) {
        toast.error("No columns were mapped. Check the dropdown selections and try again.");
        return;
      }

      const payload = rows_for_payload;

      try {
        const token = localStorage.getItem("authToken");
        const res = await axios.post(`${BASE_URL}/api/customers/bulk_upload/`, {
          rows: payload,
          file_name: file?.name || "",
          table: "api_customer",
        }, {
          headers: token ? { Authorization: `Token ${token}` } : {},
        });

        const normalizeApiRow = (row) => ({
          ...row,
          phone: row?.phone ?? row?.phone_number ?? "",
          address_line1: row?.address_line1 ?? row?.address_line_1 ?? "",
        });

        const insertedRowsResponse = Array.isArray(res?.data?.inserted_rows)
          ? res.data.inserted_rows.map(normalizeApiRow)
          : [];
        const duplicateRowsResponse = Array.isArray(res?.data?.duplicate_rows)
          ? res.data.duplicate_rows.map(normalizeApiRow)
          : [];

        // IDs that are flagged as duplicates
        const duplicateIdSet = new Set(duplicateRowsResponse.map((r) => r.id));

        const reverseMapRow = (row) => {
          const displayRow = {};
          if (row?.id !== undefined) displayRow.id = row.id;

          const usedDbFields = new Set();

          excelHeaders.forEach((excelHeader) => {
            const dbField = column_mapping[excelHeader];
            if (!dbField) {
              displayRow[excelHeader] = "";
              return;
            }

            if (usedDbFields.has(dbField)) {
              displayRow[excelHeader] = "";
              return;
            }

            usedDbFields.add(dbField);
            displayRow[excelHeader] = row?.[dbField] ?? "";
          });

          const phoneHeader = excelHeaders.find((header) => {
            const dbField = column_mapping[header];
            return dbField === "phone" || dbField === "phone_number";
          });
          if (phoneHeader) displayRow[phoneHeader] = row?.phone ?? row?.phone_number ?? "";

          const addr1Header = excelHeaders.find((header) => {
            const dbField = column_mapping[header];
            return dbField === "address_line1" || dbField === "address_line_1";
          });
          if (addr1Header) displayRow[addr1Header] = row?.address_line1 ?? row?.address_line_1 ?? "";

          return displayRow;
        };

        const allInsertedDisplay = insertedRowsResponse.map(reverseMapRow);
        // Unique rows = inserted rows that are NOT in the duplicate set
        const uniqueOnlyDisplay = allInsertedDisplay.filter((r) => !duplicateIdSet.has(r.id));
        const duplicateRowsDisplay = duplicateRowsResponse.map((row, i) => ({
          ...reverseMapRow(row),
          _pos: i,
        }));

        setInsertedCount(uniqueOnlyDisplay.length);
        setUniqueRows(uniqueOnlyDisplay);
        setDuplicateRows(duplicateRowsDisplay);
        setRawDuplicateRows(duplicateRowsResponse.map((row, i) => ({ ...row, _pos: i })));
        setSelectedDuplicateIds([]);
        setDuplicateCurrentPage(1);
        setShowSummaryCards(true);
        toast.success("Upload finished");
        setActivePanel(null);
      } catch {
        toast.error("Upload failed");
        setActivePanel(null);
      }
    } catch {
      toast.error("Error processing file");
    } finally {
      setUploading(false);
    }
  };

  // --- Duplicate helpers ---

  // Duplicate logic for DataMapping: exact three-signal rule
  const extractPhones = (raw) => {
    if (!raw) return new Set();

    return new Set(
      String(raw)
        .split(/[,;/]+/)
        .map((part) => part.trim())
        .filter((part) => !/[a-zA-Z]/.test(part))
        .map((part) => {
          let digits = part.replace(/\D/g, "");
          if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
          if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
          return digits;
        })
        .filter((digits) => digits.length === 10)
    );
  };

  const normalizePhoneField = (raw) => {
    const phones = extractPhones(raw);
    return phones.size > 0 ? [...phones].sort().join(", ") : "";
  };

  const extractNameGroup = (row) => {
    const names = new Set();
    ["company_upload_name", "first_name", "last_name"].forEach((field) => {
      const value = String(row?.[field] ?? "").trim().toLowerCase();
      if (value) names.add(value);
    });
    return names;
  };

  const extractAddressGroup = (row) => {
    const address1 = String(row?.address_line1 ?? row?.address_line_1 ?? "").trim().toLowerCase();
    return address1;
  };

  const rowsAreDuplicates = (a, b) => {
    const aNames = extractNameGroup(a);
    const bNames = extractNameGroup(b);
    const aPhones = extractPhones(a?.phone ?? a?.phone_number);
    const bPhones = extractPhones(b?.phone ?? b?.phone_number);
    const aAddress = extractAddressGroup(a);
    const bAddress = extractAddressGroup(b);

    const hasName = aNames.size > 0 && bNames.size > 0;
    const hasAddress = Boolean(aAddress && bAddress);
    const hasPhone = aPhones.size > 0 && bPhones.size > 0;

    const checkable = [hasName, hasAddress, hasPhone].filter(Boolean).length;
    if (checkable === 0) return false;

    const nameMatch = hasName && [...aNames].some((value) => bNames.has(value));
    const addressMatch = hasAddress && aAddress === bAddress;
    const phoneMatch = hasPhone && [...aPhones].some((value) => bPhones.has(value));

    const matched = [nameMatch, addressMatch, phoneMatch].filter(Boolean).length;

    if (checkable === 1) return matched === 1;
    if (checkable === 2) return matched === 2;
    return matched >= 2;
  };

  const toggleDuplicateSelection = (pos) => {
    // Only reset merge state if user is changing their base selection (not just unchecking an auto-match)
    if (!mergeSearchedIds || !mergeSearchedIds.includes(pos)) {
      setMatchedRowIds(null);
      setMergeSearchedIds(null);
    }
    setSelectedDuplicateIds((prev) =>
      prev.includes(pos) ? prev.filter((item) => item !== pos) : [...prev, pos]
    );
  };

  const toggleSelectAllDuplicates = () => {
    setMatchedRowIds(null);
    setMergeSearchedIds(null);
    setSelectedDuplicateIds((prev) =>
      prev.length === paginatedDuplicateRows.length
        ? []
        : paginatedDuplicateRows.map((row) => row._pos)
    );
  };

  const filteredDuplicateRows = duplicateSearchTerm.trim()
    ? duplicateRows.filter((row) =>
        Object.entries(row || {}).some(([, value]) =>
          String(value ?? "").toLowerCase().includes(duplicateSearchTerm.trim().toLowerCase())
        )
      )
    : duplicateRows;

  const sortedDuplicateRows = matchedRowIds
    ? [
        ...filteredDuplicateRows.filter((r) => selectedDuplicateIds.includes(r._pos) || matchedRowIds.includes(r._pos)),
        ...filteredDuplicateRows.filter((r) => !selectedDuplicateIds.includes(r._pos) && !matchedRowIds.includes(r._pos)),
      ]
    : [...filteredDuplicateRows].sort((a, b) => {
        const av = String(a?.[duplicateSortKey] ?? "");
        const bv = String(b?.[duplicateSortKey] ?? "");
        const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" });
        return duplicateSortDirection === "asc" ? cmp : -cmp;
      });

  const duplicateTotalPages = Math.max(1, Math.ceil(sortedDuplicateRows.length / duplicateRowsPerPage));
  const duplicateSafePage = Math.min(duplicateCurrentPage, duplicateTotalPages);
  const duplicatePageStart = (duplicateSafePage - 1) * duplicateRowsPerPage;
  const paginatedDuplicateRows = sortedDuplicateRows.slice(duplicatePageStart, duplicatePageStart + duplicateRowsPerPage);

  const handleDuplicateSort = (header) => {
    if (duplicateSortKey === header) {
      setDuplicateSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setDuplicateSortKey(header);
      setDuplicateSortDirection("asc");
    }
  };

  const getRawDuplicateRowsByIds = (positions) =>
    positions
      .map((pos) => {
        const rawRow = rawDuplicateRows.find((row) => row._pos === pos);
        if (rawRow) return rawRow;

        const displayRow = duplicateRows.find((row) => row._pos === pos);
        if (!displayRow) return null;

        const fallbackRow = { id: displayRow.id, _pos: displayRow._pos };
        excelHeaders.forEach((excelHeader) => {
          const dbField = mapping[excelHeader];
          if (dbField) fallbackRow[dbField] = displayRow[excelHeader] ?? "";
        });
        return fallbackRow;
      })
      .filter(Boolean);

  const getRecommendedMergeValue = (field, rows) => {
    const values = rows.map((row) => String(row?.[field] ?? "").trim()).filter(Boolean);
    if (!values.length) return "";
    const counts = new Map();
    values.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
    let best = values[0], bestScore = 0;
    counts.forEach((count, value) => {
      if (count > bestScore || (count === bestScore && value.length > best.length)) {
        best = value; bestScore = count;
      }
    });
    return best;
  };

  const getFieldConsensus = (field, rows) => {
    const values = [...new Set(rows.map((row) => String(row?.[field] ?? "").trim()).filter(Boolean))];
    return values.length === 1 ? values[0] : "";
  };

  const getRowDisplayLabel = (row) => {
    const company = String(row?.company_upload_name ?? row?.company_name ?? "").trim();
    const phone = String(row?.phone ?? "").trim();
    const addr1 = String(row?.address_line_1 ?? row?.address_line1 ?? "").trim();
    const addr2 = String(row?.address_line_2 ?? row?.address_line2 ?? "").trim();
    const address = [addr1, addr2].filter(Boolean).join(", ");
    if (company && phone) return `${company} • ${phone}`;
    if (company) return company;
    if (phone) return phone;
    if (address) return address;
    return `ID ${row?.id ?? "-"}`;
  };

  const formatFieldLabel = (field) =>
    field === "company_upload_name"
      ? "Company"
      : String(field || "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

  const mappingColumns = columns.filter((field) => !hiddenMappingFields.has(field));

  const buildInitialMergeSelections = (rows) => {
    const selections = {};
    mergeableFields.forEach((field) => {
      const consensus = getFieldConsensus(field, rows);
      selections[field] = consensus ? "auto" : (getRecommendedMergeValue(field, rows) || "auto");
    });
    return selections;
  };

  const openMergeModal = () => {
    if (selectedDuplicateIds.length === 0) {
      toast.error("Select at least one row to merge.");
      return;
    }

    // First click — find matching rows and highlight them
    const selectedRaws = getRawDuplicateRowsByIds(selectedDuplicateIds);
    const additionalMatches = rawDuplicateRows.filter((row) => {
      if (selectedDuplicateIds.includes(row._pos)) return false;
      return selectedRaws.some((base) => rowsAreDuplicates(base, row));
    });

    const additionalPositions = additionalMatches.map((r) => r._pos);
    const searchedPositions = [...new Set([...selectedDuplicateIds, ...additionalPositions])];
    setMatchedRowIds(additionalPositions);
    setMergeSearchedIds(searchedPositions);
    setSelectedDuplicateIds(searchedPositions);
    setShowMergeActionBar(true);

    if (additionalPositions.length === 0) {
      toast.info("No similar rows found. You can still merge manually by selecting more rows.");
    }
  };

  const handleKeepSelected = () => {
    const positionsToKeep = new Set(selectedDuplicateIds);
    setDuplicateRows((prev) => prev.filter((row) => !positionsToKeep.has(row._pos)));
    setRawDuplicateRows((prev) => prev.filter((row) => !positionsToKeep.has(row._pos)));
    setShowMergeActionBar(false);
    setMatchedRowIds(null);
    setMergeSearchedIds(null);
    setSelectedDuplicateIds([]);
    setDuplicateCurrentPage(1);
    toast.success("Selected rows kept in the database and removed from duplicates.");
  };

  const handleMergeSelected = () => {
    if (selectedDuplicateIds.length === 0) return;
    const rowsToMerge = getRawDuplicateRowsByIds(selectedDuplicateIds);
    setMergeFieldSelections(buildInitialMergeSelections(rowsToMerge));
    setShowMergeActionBar(false);
    setMergeModalOpen(true);
  };

  const handleCancelMergeBar = () => {
    setShowMergeActionBar(false);
    setMatchedRowIds(null);
    setMergeSearchedIds(null);
    setSelectedDuplicateIds([]);
  };

  const closeMergeModal = () => setMergeModalOpen(false);

  const buildMergeData = (rowsToMerge) => {
    const mergeData = {};
    mergeableFields.forEach((field) => {
      const selection = mergeFieldSelections[field] || "auto";
      const value = selection === "auto" ? getRecommendedMergeValue(field, rowsToMerge) : String(selection).trim();
      if (value) mergeData[field] = value;
    });
    return mergeData;
  };

  const runDuplicateSearch = () => {
    setDuplicateSearchTerm(duplicateSearchInput.trim());
    setDuplicateCurrentPage(1);
  };

  const handleDuplicatePageChange = (nextPage) => {
    setDuplicateCurrentPage(Math.min(Math.max(nextPage, 1), duplicateTotalPages));
  };

  const handleDuplicateRowsPerPageChange = (e) => {
    setDuplicateRowsPerPage(Number(e.target.value));
    setDuplicateCurrentPage(1);
  };

  const clearDuplicateSelection = () => {
    setSelectedDuplicateIds([]);
    setMatchedRowIds(null);
    setMergeSearchedIds(null);
    setDeleteConfirmOpen(false);
  };

  const handleDeleteSelected = () => {
    if (!selectedDuplicateIds.length) {
      toast.error("Select at least one row to delete.");
      return;
    }
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteSelected = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const idsToDelete = [...new Set(selectedDuplicateIds.map((pos) => {
        const row = rawDuplicateRows.find((item) => item._pos === pos);
        return row?.id;
      }).filter(Boolean))];
      await axios.post(
        `${BASE_URL}/api/customers/handle-duplicate/`,
        { action: "delete", ids: idsToDelete },
        { headers: token ? { Authorization: `Token ${token}` } : {} }
      );
      setDuplicateRows((prev) => prev.filter((row) => !selectedDuplicateIds.includes(row._pos)));
      setRawDuplicateRows((prev) => prev.filter((row) => !selectedDuplicateIds.includes(row._pos)));
      clearDuplicateSelection();
      toast.success("Selected rows deleted from the database.");
    } catch {
      toast.error("Failed to delete selected rows.");
    }
  };

  const confirmMergeSelected = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const idsToMerge = [...new Set(selectedDuplicateIds.map((pos) => {
        const row = rawDuplicateRows.find((item) => item._pos === pos);
        return row?.id;
      }).filter(Boolean))];
      const rowsToMerge = getRawDuplicateRowsByIds(selectedDuplicateIds);
      const mergeData = buildMergeData(rowsToMerge);

      const res = await axios.post(
        `${BASE_URL}/api/customers/handle-duplicate/`,
        { action: "merge", ids: idsToMerge, merge_data: mergeData },
        { headers: token ? { Authorization: `Token ${token}` } : {} }
      );

      const deletedIds = Array.isArray(res?.data?.deleted_ids) ? res.data.deleted_ids : [];
      const mergedId = res?.data?.merged_id;

      // Remove deleted rows; keep the surviving merged row
      setDuplicateRows((prev) => prev.filter((row) => !deletedIds.includes(row.id)));
      setRawDuplicateRows((prev) => prev.filter((row) => !deletedIds.includes(row.id)));

      // If the merged row itself has no remaining duplicates, remove it from the list too
      setDuplicateRows((prev) => {
        const remaining = prev.filter((row) => row.id !== mergedId);
        const mergedRaw = rawDuplicateRows.find((r) => r.id === mergedId);
        const hasSiblings = mergedRaw && remaining.some((r) => rowsAreDuplicates(mergedRaw, rawDuplicateRows.find((x) => x._pos === r._pos)));
        return hasSiblings ? prev : remaining;
      });
      setRawDuplicateRows((prev) => {
        const remaining = prev.filter((row) => row.id !== mergedId);
        const mergedRaw = prev.find((r) => r.id === mergedId);
        const hasSiblings = mergedRaw && remaining.some((r) => rowsAreDuplicates(mergedRaw, r));
        return hasSiblings ? prev : remaining;
      });

      clearDuplicateSelection();
      setDuplicateCurrentPage(1);
      closeMergeModal();
      toast.success("Selected rows merged successfully.");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to merge selected rows.");
    }
  };

  // --- Cell highlight helpers ---
  const matchFields = ["company_upload_name", "phone_number", "phone", "address_line_1", "address_line1", "pincode"];

  const isCellHighlighted = (row, h, baseRaw) => {
    if (!matchedRowIds || !baseRaw) return false;
    const mappedField = Object.keys(mapping).find((k) => mapping[k] && h === k);
    const dbField = mappedField ? mapping[mappedField] : null;
    if (!dbField || !matchFields.includes(dbField)) return false;

    const isInMatchGroup = matchedRowIds.includes(row._pos) || selectedDuplicateIds.includes(row._pos);
    if (!isInMatchGroup) return false;

    if (dbField === "phone_number" || dbField === "phone") {
      const cellPhone = normalizePhone(row[h]);
      const basePhone = normalizePhone(baseRaw?.phone ?? baseRaw?.phone_number);
      return cellPhone.length >= 10 && cellPhone === basePhone;
    }
    const cellVal = String(row[h] ?? "").trim().toLowerCase();
    const baseVal = String(baseRaw[dbField] ?? "").trim().toLowerCase();
    return Boolean(cellVal && baseVal && cellVal === baseVal);
  };

  // Compute pairwise matches among the currently searched/selected duplicate ids.
  const pairMatchMap = React.useMemo(() => {
    const positions = mergeSearchedIds || selectedDuplicateIds;
    if (!positions || !positions.length) return {};
    const raws = positions.map((pos) => rawDuplicateRows.find((row) => row._pos === pos)).filter(Boolean);
    const map = {};
    for (let i = 0; i < raws.length; i++) {
      for (let j = i + 1; j < raws.length; j++) {
        const a = raws[i];
        const b = raws[j];
        if (rowsAreDuplicates(a, b)) {
          map[a._pos] = map[a._pos] || [];
          map[a._pos].push(b._pos);
          map[b._pos] = map[b._pos] || [];
          map[b._pos].push(a._pos);
        }
      }
    }
    return map;
  }, [mergeSearchedIds, selectedDuplicateIds, rawDuplicateRows]);

  const rawByPosMap = React.useMemo(() => {
    return Object.fromEntries(rawDuplicateRows.map((r) => [r._pos, r]));
  }, [rawDuplicateRows]);

  const closeSummaryTable = () => {
    setActiveTable(null);
  };

  return (
    <div className="p-6">
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => {
            closeSummaryTable();
            setShowSummaryCards(false);
            if (activePanel === "view") {
              fetchAllData();
            } else {
              setActivePanel("view");
            }
          }}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 transition-colors"
        >
          View Data
        </button>
        <button
          onClick={() => {
            closeSummaryTable();
            setShowSummaryCards(false);
            setActivePanel(activePanel === "manual" ? null : "manual");
          }}
          className="px-4 py-2 rounded-lg bg-green-600 text-white shadow-sm hover:bg-green-700 transition-colors"
        >
          Add Customer
        </button>
        <button
          onClick={() => {
            closeSummaryTable();
            setShowSummaryCards(false);
            setActivePanel(activePanel === "bulk" ? null : "bulk");
          }}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          Upload Excel
        </button>
      
      </div>

      {showSummaryCards && (
        <div className="mt-2 mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="grid gap-4 md:grid-cols-2">
            <div
              className="cursor-pointer rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800"
              onClick={() => setActiveTable((t) => (t === 'inserted' ? null : 'inserted'))}
            >
              <div className="text-sm text-gray-500 dark:text-gray-400">Unique Rows Inserted</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{insertedCount}</div>
            </div>
            <div
              className="cursor-pointer rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800"
              onClick={() => setActiveTable((t) => (t === 'duplicates' ? null : 'duplicates'))}
            >
              <div className="text-sm text-gray-500 dark:text-gray-400">Duplicate Rows</div>
              <div className="mt-1 text-2xl font-semibold text-blue-600">{duplicateRows.length}</div>
            </div>
          </div>

          {activeTable === 'inserted' && (
            <div className="mt-6 overflow-auto rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              <h4 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Inserted Rows</h4>
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 dark:bg-gray-800">
                  <tr>
                    {excelHeaders.map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-200">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {uniqueRows.map((r, ri) => (
                    <tr key={ri} className="border-t border-gray-200 dark:border-gray-700">
                      {excelHeaders.map((h, ci) => (
                        <td key={ci} className="px-3 py-2 text-gray-700 dark:text-gray-300">
                          {String(r[h] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTable === 'duplicates' && (
            <div className="mt-6 overflow-auto rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Duplicate Rows</h4>
                {showMergeActionBar ? (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {selectedDuplicateIds.length} row(s) selected — choose action:
                    </span>
                    <button
                      onClick={handleKeepSelected}
                      className="rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
                    >
                      Keep
                    </button>
                    <button
                      onClick={handleMergeSelected}
                      className="rounded-md bg-amber-500 px-4 py-2 text-sm text-white hover:bg-amber-600"
                    >
                      Merge
                    </button>
                    <button
                      onClick={handleCancelMergeBar}
                      className="rounded-md bg-gray-200 px-4 py-2 text-sm text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-end">
                    <form
                      className="flex flex-wrap items-center gap-2"
                      onSubmit={(e) => { e.preventDefault(); runDuplicateSearch(); }}
                    >
                      <input
                        type="text"
                        value={duplicateSearchInput}
                        onChange={(e) => setDuplicateSearchInput(e.target.value)}
                        placeholder="Search rows"
                        className="w-44 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      />
                      <button type="submit" className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700">
                        Search
                      </button>
                    </form>
                    <button onClick={openMergeModal} className="rounded-md bg-amber-500 px-3 py-2 text-sm text-white hover:bg-amber-600">
                      Merge
                    </button>
                    <button onClick={handleDeleteSelected} className="rounded-md bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700">
                      Delete Selected
                    </button>
                    <button
                      onClick={() => setActiveTable(null)}
                      className="rounded-md bg-gray-200 px-3 py-2 text-sm text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              
              </div>

              {matchedRowIds && matchedRowIds.length > 0 && (
                <p className="mb-2 text-xs text-amber-600 dark:text-amber-400">
                  Highlighted rows share name, phone, or address with your selected row. Select them and click Merge again to combine.
                </p>
              )}

              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 dark:bg-gray-800">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-200">
                      <input
                        type="checkbox"
                        checked={paginatedDuplicateRows.length > 0 && paginatedDuplicateRows.every((row) => selectedDuplicateIds.includes(row._pos))}
                        onChange={toggleSelectAllDuplicates}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    {excelHeaders.map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-200">
                        <button
                          type="button"
                          onClick={() => handleDuplicateSort(h)}
                          className="flex items-center gap-1 text-left hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          <span>{h}</span>
                          {duplicateSortKey === h && (
                            <span className="text-xs">{duplicateSortDirection === "asc" ? "▲" : "▼"}</span>
                          )}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedDuplicateRows.map((r, ri) => {
                    const baseRaws = matchedRowIds ? getRawDuplicateRowsByIds(selectedDuplicateIds) : [];
                    const isBase = matchedRowIds && !matchedRowIds.includes(r._pos) && selectedDuplicateIds.includes(r._pos);
                    const isMatched = matchedRowIds?.includes(r._pos);
                    const isSelected = selectedDuplicateIds.includes(r._pos);
                    return (
                      <tr
                        key={r._pos ?? ri}
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleDuplicateSelection(r._pos)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleDuplicateSelection(r._pos); }
                        }}
                        className={`cursor-pointer border-t border-gray-200 dark:border-gray-700 ${
                          isBase ? 'bg-amber-200 dark:bg-amber-800/40'
                          : isMatched ? 'bg-amber-50 border-l-2 border-l-amber-400 dark:bg-amber-900/20'
                          : isSelected ? 'bg-blue-50 dark:bg-blue-950/30'
                          : ''
                        }`}
                      >
                        <td className="px-3 py-2 align-top">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => toggleDuplicateSelection(r._pos)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        {excelHeaders.map((h, ci) => {
                              // Only highlight when this row has a pairwise match and the specific cell matches that partner's cell
                              const partners = pairMatchMap[r._pos] || [];
                              const highlighted = partners.some((pid) => {
                                const partnerRaw = rawByPosMap[pid];
                                return partnerRaw ? isCellHighlighted(r, h, partnerRaw) : false;
                              });
                              const highlightBg = highlighted ? 'bg-red-100 dark:bg-red-900/20' : '';
                              const highlightText = highlighted ? 'text-red-600 dark:text-red-400 font-semibold' : '';
                              return (
                                <td key={ci} className={`px-3 py-2 ${highlightBg} text-gray-700 dark:text-gray-300 ${highlightText}`}>
                                  {String(r[h] ?? '')}
                                </td>
                              );
                            })}
                      </tr>
                    );
                  })}
                  {!paginatedDuplicateRows.length && (
                    <tr className="border-t border-gray-200 dark:border-gray-700">
                      <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400" colSpan={excelHeaders.length + 1}>
                        No rows found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-2 text-sm text-gray-600 dark:text-gray-300 sm:flex-row sm:items-center sm:gap-4">
                  <span>
                    Showing {sortedDuplicateRows.length ? duplicatePageStart + 1 : 0}–{Math.min(duplicatePageStart + duplicateRowsPerPage, sortedDuplicateRows.length)} of {sortedDuplicateRows.length}
                  </span>
                  <span>Page {duplicateSafePage} of {duplicateTotalPages}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDuplicatePageChange(duplicateSafePage - 1)}
                    disabled={duplicateSafePage <= 1}
                    className="rounded-md bg-gray-200 px-3 py-2 text-sm text-gray-800 hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                  >
                    Prev
                  </button>
                  <div className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
                    <label className="text-sm text-gray-600 dark:text-gray-300">Rows per page</label>
                    <select
                      value={duplicateRowsPerPage}
                      onChange={handleDuplicateRowsPerPageChange}
                      className="bg-transparent text-sm text-gray-900 outline-none dark:text-white"
                    >
                      {[5, 10, 20, 50].map((count) => (
                        <option key={count} value={count}>{count}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDuplicatePageChange(duplicateSafePage + 1)}
                    disabled={duplicateSafePage >= duplicateTotalPages}
                    className="rounded-md bg-gray-200 px-3 py-2 text-sm text-gray-800 hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {mergeModalOpen && (
        <div style={{ minHeight: 400, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="fixed inset-0 z-50 px-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Merge selected rows</h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  Auto uses the most common non-empty value. Override any field by choosing a specific value.
                </p>
              </div>
              <button
                type="button"
                onClick={closeMergeModal}
                className="rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Close
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-200">Selected rows</div>
              <div className="flex flex-wrap gap-2">
                {getRawDuplicateRowsByIds(selectedDuplicateIds).map((row) => (
                  <span key={row.id} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm dark:bg-gray-900 dark:text-gray-200">
                    {getRowDisplayLabel(row)}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5 max-h-[55vh] overflow-auto rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              <div className="grid grid-cols-1 gap-3">
                {mergeableFields.map((field) => {
                  const rowsToMerge = getRawDuplicateRowsByIds(selectedDuplicateIds);
                  const consensusValue = getFieldConsensus(field, rowsToMerge);
                  const selectedChoice = mergeFieldSelections[field] || "auto";
                  const fieldOptions = [...new Set(rowsToMerge.map((row) => String(row?.[field] ?? "").trim()).filter(Boolean))];
                  return (
                    <div key={field} className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{formatFieldLabel(field)}</div>
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {consensusValue
                              ? `All rows match: ${consensusValue}`
                              : `Recommended: ${getRecommendedMergeValue(field, rowsToMerge) || "leave blank"}`}
                          </div>
                        </div>
                        <select
                          value={selectedChoice}
                          onChange={(e) => setMergeFieldSelections((prev) => ({ ...prev, [field]: e.target.value }))}
                          disabled={Boolean(consensusValue)}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 sm:max-w-[220px] dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:disabled:bg-gray-800"
                        >
                          <option value="auto">{consensusValue ? "Auto (same on all rows)" : "Auto (recommended)"}</option>
                          {fieldOptions.map((value) => (
                            <option key={value} value={value}>{value}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeMergeModal}
                className="rounded-lg bg-gray-200 px-4 py-2 text-sm text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmMergeSelected}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm text-white hover:bg-amber-600"
              >
                Merge Data
              </button>
            </div>
          </div>
        </div>
      )}

      {(activePanel === "view" || activePanel === "viewRaw") && (
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                {activePanel === "viewRaw" ? "Raw Data" : "All Data"}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {activePanel === "viewRaw"
                  ? `Inspect the full database rows as returned by the API. Total records: ${filteredViewRows.length}`
                  : `Browse customer rows in a paginated table. Total records: ${filteredViewRows.length}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowViewFilters((prev) => !prev)}
                className="rounded-md bg-gray-800 px-3 py-2 text-sm text-white hover:bg-gray-900"
                title="Toggle filters"
                aria-label="Toggle filters"
              >
                <FaFilter />
              </button>
              <button
                onClick={() => {
                  if (!selectedViewIds.length) return;
                  setViewDeleteConfirmTarget([]);
                  setViewDeleteConfirmOpen(true);
                }}
                disabled={!selectedViewIds.length}
                className="rounded-md bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                title="Delete selected"
                aria-label="Delete selected"
              >
                <FaTrash />
              </button>
              <button onClick={fetchAllData} className="rounded-md bg-gray-200 px-3 py-2 text-sm text-gray-800 hover:bg-gray-300" title="Refresh" aria-label="Refresh">
                <FaSyncAlt />
              </button>
              <button onClick={() => setActivePanel(null)} className="rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700" title="Hide" aria-label="Hide">
                <FaEyeSlash />
              </button>
            </div>
          </div>

          {showViewFilters && (
            <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 md:grid-cols-4 dark:border-gray-700 dark:bg-gray-800">
              <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                Search
                <input
                  type="text"
                  value={viewSearchFilter}
                  onChange={(e) => setViewSearchFilter(e.target.value)}
                  placeholder="Search rows"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                File Name
                <select
                  value={viewFileNameFilter}
                  onChange={(e) => setViewFileNameFilter(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="">All Files</option>
                  {viewFileNameOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                City
                <select
                  value={viewCityFilter}
                  onChange={(e) => setViewCityFilter(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="">All Cities</option>
                  {viewCityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                Date
                <input
                  type="date"
                  value={viewDateFilter}
                  onChange={(e) => setViewDateFilter(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </label>
              <div className="md:col-span-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={downloadViewCsv}
                  disabled={!filteredViewRows.length}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  CSV
                </button>
                <button
                  type="button"
                  onClick={downloadViewExcel}
                  disabled={!filteredViewRows.length}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Excel
                </button>
                <button
                  type="button"
                  onClick={downloadViewPdf}
                  disabled={!filteredViewRows.length}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  PDF
                </button>
                <button
                  type="button"
                  onClick={selectAllFilteredViewRows}
                  disabled={!filteredViewRows.length}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={clearViewFilters}
                  className="rounded-lg bg-gray-200 px-4 py-2 text-sm text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}

          {viewLoading ? (
            <div className="py-12 text-center text-sm text-gray-500">Loading...</div>
          ) : (
            <div className="overflow-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 dark:bg-gray-800">
                  <tr>
                    <th className="px-3 py-2 text-left">
                      <input
                        type="checkbox"
                        checked={filteredViewPageRows.length > 0 && filteredViewPageRows.every((r) => selectedViewIds.includes(r.id))}
                        onChange={() => {
                          const visibleIds = filteredViewPageRows.map((r) => r.id);
                          const allSelected = visibleIds.every((id) => selectedViewIds.includes(id));
                          if (allSelected) setSelectedViewIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
                          else setSelectedViewIds((prev) => [...new Set([...prev, ...visibleIds])]);
                        }}
                        className="h-4 w-4"
                      />
                    </th>
                    {visibleViewColumns.map((col) => (
                      <th key={col} className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-200">{col}</th>
                    ))}
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredViewPageRows.map((r) => (
                    <tr key={r.id} className="border-t border-gray-200 dark:border-gray-700">
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={selectedViewIds.includes(r.id)} onChange={() => toggleSelectViewId(r.id)} className="h-4 w-4" />
                      </td>
                      {visibleViewColumns.map((col) => (
                        <td key={col} className="px-3 py-2 text-gray-700 dark:text-gray-300">{String(r[col] ?? "")}</td>
                      ))}
                      <td className="px-3 py-2">
                        <button
                          onClick={() => deleteRow(r.id)}
                          className="rounded-md bg-red-600 px-3 py-2 text-white hover:bg-red-700"
                          title="Delete row"
                          aria-label="Delete row"
                        >
                          <FaTrash />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-sm text-gray-600 dark:text-gray-300">
              Showing {filteredViewRows.length ? Math.min(filteredViewRows.length, (viewPage - 1) * viewPerPage + 1) : 0}–{Math.min(filteredViewRows.length, viewPage * viewPerPage)} of {filteredViewRows.length}
            </div>
            <div className="flex items-center gap-2">
              <button disabled={viewPage <= 1} onClick={() => setViewPage((p) => Math.max(1, p - 1))} className="rounded-md bg-gray-200 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60">Prev</button>
              <select value={viewPerPage} onChange={(e) => { setViewPerPage(Number(e.target.value)); setViewPage(1); }} className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white">
                {[10, 20, 50, 100, 250, 500].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <button disabled={viewPage * viewPerPage >= filteredViewRows.length} onClick={() => setViewPage((p) => p + 1)} className="rounded-md bg-gray-200 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60">Next</button>
            </div>
          </div>
        </div>
      )}

      {activePanel === "manual" && (
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Add Customer</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Fill the customer details and save them to the database.</p>
            </div>
            <button onClick={() => setActivePanel(null)} className="rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">Hide</button>
          </div>
          <form onSubmit={handleManualSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} placeholder="First Name" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
            <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} placeholder="Last Name" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
            <input value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} placeholder="Phone Number" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
            <input value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} placeholder="Pincode" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
            <input value={form.address_line_1} onChange={(e) => setForm({ ...form, address_line_1: e.target.value })} placeholder="Address Line 1" className="md:col-span-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
            <input value={form.address_line_2} onChange={(e) => setForm({ ...form, address_line_2: e.target.value })} placeholder="Address Line 2" className="md:col-span-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
            <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="Country" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
            <input value={form.city} onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))} onBlur={handleCityBlur} placeholder="City" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
            <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="State" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
            <div className="md:col-span-2 flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setActivePanel(null)} className="rounded-lg bg-gray-200 px-4 py-2 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600">Cancel</button>
              <button type="submit" className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700">Add Customer</button>
            </div>
          </form>
        </div>
      )}

      {activePanel === "bulk" && (
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Upload Excel</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Select a file, map the columns, then upload the data.</p>
            </div>
            <button onClick={() => setActivePanel(null)} className="rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">Hide</button>
          </div>
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
            <input type="file" accept=".xls,.xlsx" onChange={handleFileChange} className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-white hover:file:bg-blue-700 dark:text-gray-200" />
          </div>

          {excelHeaders.length > 0 && (
            <div className="mt-5 space-y-4">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                <h4 className="mb-3 text-base font-semibold text-gray-900 dark:text-white">Map Excel Columns</h4>
                <div className="space-y-3">
                  {excelHeaders.map((h, idx) => (
                    <div key={idx} className="grid grid-cols-1 gap-2 md:grid-cols-3 md:items-center">
                      <div className="rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm dark:bg-gray-900 dark:text-gray-200">{h}</div>
                      <div className="md:col-span-2">
                        <select
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                          value={mapping[h] || ""}
                          onChange={(e) => setMapping((prev) => ({ ...prev, [h]: e.target.value }))}
                        >
                          <option value="">-- ignore --</option>
                          {(() => {
                            const filteredColumns = mappingColumns.filter(
                              (c) => c !== "company_name"
                            );

                            return filteredColumns.map((c) => (
                              <option key={c} value={c}>{formatFieldLabel(c)}</option>
                            ));
                          })()}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {uploading && (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    )}
                    {uploading ? "Uploading..." : "Upload Mapped Data"}
                  </button>
                </div>
              </div>

              {previewRows.length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                  <h4 className="mb-3 text-base font-semibold text-gray-900 dark:text-white">Preview</h4>
                  <div className="max-h-64 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-100 dark:bg-gray-800">
                        <tr>
                          {excelHeaders.map((header) => (
                            <th key={header} className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-200">{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.slice(0, 5).map((row, rowIndex) => (
                          <tr key={rowIndex} className="border-t border-gray-200 dark:border-gray-700">
                            {row.map((cell, colIndex) => (
                              <td key={colIndex} className="px-3 py-2 text-gray-700 dark:text-gray-300">
                                {String(cell ?? "")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {deleteConfirmOpen && (
        <div style={{ minHeight: 400, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="fixed inset-0 z-50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete selected rows?</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              This will permanently delete {selectedDuplicateIds.length} selected row(s) from the database.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setDeleteConfirmOpen(false)} className="rounded-lg bg-gray-200 px-4 py-2 text-sm text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600">
                Cancel
              </button>
              <button type="button" onClick={confirmDeleteSelected} className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {viewDeleteConfirmOpen && (
        <div style={{ minHeight: 400, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="fixed inset-0 z-50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete selected rows?</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              This will permanently delete {viewDeleteConfirmTarget.length || selectedViewIds.length} selected row(s) from the database.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => { setViewDeleteConfirmOpen(false); setViewDeleteConfirmTarget([]); }} className="rounded-lg bg-gray-200 px-4 py-2 text-sm text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600">
                Cancel
              </button>
              <button type="button" onClick={async () => { await deleteSelectedViewRows(); setViewDeleteConfirmOpen(false); setViewDeleteConfirmTarget([]); }} className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="fixed bottom-6 right-6 z-40 rounded-full bg-indigo-600 p-3 text-white shadow-lg transition-colors hover:bg-indigo-700"
        title="Back to top"
        aria-label="Back to top"
      >
        <FaArrowUp />
      </button>
    </div>
  );
}