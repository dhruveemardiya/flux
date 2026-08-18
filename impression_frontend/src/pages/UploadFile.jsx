
import React, { useState, useRef, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import Papa from 'papaparse';
import axios from 'axios';
import { toast,ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import BASE_URL from './config';
import * as XLSX from 'xlsx';



// Modal component for confirmation
const ConfirmModal = ({ isVisible, onConfirm, onCancel }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded shadow-xl">
        <div className="text-lg mb-4">A file has already been uploaded for this date. Are you sure you want to upload again?</div>
        <div className="flex gap-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-300 text-black rounded hover:bg-gray-400"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

const UploadFile = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadSummary, setUploadSummary] = useState(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isModalVisible, setIsModalVisible] = useState(false); // State for modal visibility
  const [isFileExists, setIsFileExists] = useState(false); // State to track if a file exists for the date
  const fileInputRef = useRef(null);
  const [role, setRole] = useState('superadmin'); // State for role, with 'superadmin' as the default value.
const { selectedCompany } = useOutletContext(); // ✅ get selected company from context
const [companyId, setCompanyId] = useState(null); // ✅ resolved company ID
const token= localStorage.getItem("authToken")
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (
      file &&
      (file.name.endsWith('.xlsx') ||
        file.name.endsWith('.xls') ||
        file.name.endsWith('.csv'))
    ) {
      setSelectedFile(file); // Allow CSV too now
    } else {
      toast.error("Only Excel (.xlsx/.xls/.csv) files are supported.");
      setSelectedFile(null);
    }
  };
  
  

  // Function to sync data
const handleSyncData = async () => {
  if (!companyId) { toast.error("Company not selected."); return; }

  try {
    const token = localStorage.getItem("authToken");

  // If BASE_URL ends with '/', remove one
const res = await fetch(`${BASE_URL}api/sync_data/`, { 
  method: 'POST', 
  headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' }, 
  body: JSON.stringify({ company_id: companyId, date }) 
});


    if (!res.ok) throw new Error(`Sync failed: ${res.status}`);

    const data = await res.json();

    if (data.status === 'success') toast.success('Data synced successfully!');
    else {
      toast.error('Sync failed.');
      console.log("API response:", data);
    }
  } catch (err) {
    console.error("Sync API error:", err);
    toast.error('Something went wrong during sync.');
  }
};




useEffect(() => {
  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${BASE_URL}/api/users/me/`, {
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error("Failed to fetch user");

      const user = await res.json();
      setRole(user.role);

      let resolvedCompany = null;
      if (user.role === "superadmin") {
        resolvedCompany = selectedCompany?.id || user.companies?.[0];
      } else {
        resolvedCompany = user.companies?.[0];
      }

      if (resolvedCompany) setCompanyId(resolvedCompany);
    } catch (err) {
      toast.error('Failed to fetch user or resolve company.');
      console.error(err);
    }
  };

  fetchUserData();
}, [selectedCompany]); // ✅ Re-run if selectedCompany changes

  


  const uploadFile = async () => {
    if (!selectedFile) {
      toast.error("Please select a valid file.");
      return;
    }
  
    const fileName = selectedFile.name.toLowerCase();
  
    const handleParsedRows = async (rows, fileTypeLabel) => {
      const validData = [];
      let warningToastTriggered = false;
  
      for (let i = 1; i < rows.length; i++) {
        const productName = rows[i][0]?.toString().trim();
        let quantityRaw = rows[i][1]?.toString().trim() || '';
        let quantityMatch = quantityRaw.match(/\d+/);
        let quantity = quantityMatch ? Number(quantityMatch[0]) : 0;
  
        if (!quantityMatch && !warningToastTriggered) {
          toast("Some products have missing or invalid quantities. Setting them to 0.", {
            icon: '⚠️',
            style: { background: 'orange', color: 'black' },
          });
          warningToastTriggered = true;
        }
  
        if (productName) {
          validData.push({ productName, quantity, date });
        }
      }
  
      if (validData.length === 0) {
        toast.error("No valid product data found.");
        return;
      }
  
      try {
     const response = await axios.post(
  `${BASE_URL}/api/upload_product_quantities/`,
  {
    data: validData,
    date: date,
    company_id: companyId,
  },
  {
    headers: {
      Authorization: `Token ${token}`, // Use `Bearer` if you're using JWT
      'Content-Type': 'application/json',
    },
  }
);


  
        if (response.data.status === 'success') {
          toast.success(`${fileTypeLabel} file uploaded successfully!`);
          setSelectedFile(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = null;
          }
  
          const { total_records, updated_records, new_records } = response.data;
          setUploadSummary({
            total: total_records,
            new: new_records,
            updated: updated_records,
          });
        } else {
          toast.error("Upload failed.");
        }
      } catch (err) {
        toast.error("Something went wrong while uploading.");
      }
    };
  
    if (fileName.endsWith('.csv')) {
      Papa.parse(selectedFile, {
        complete: async (results) => {
          await handleParsedRows(results.data, 'CSV');
        },
        error: (error) => {
          toast.error("Failed to parse CSV file.");
        }
      });
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  
        await handleParsedRows(rows, 'Excel');
      };
      reader.readAsArrayBuffer(selectedFile);
    } else {
      toast.error("Unsupported file type. Please upload a CSV or Excel file.");
    }
  };
  

  const handleUpload = async () => {
    const exists = await checkIfFileExists(); // ✅ use return value

    if (exists) {
      setIsModalVisible(true);
    } else {
      uploadFile();
    }
  };


  

  // Function to check if a file already exists for the selected date
  const checkIfFileExists = async () => {
    try {
      const response = await axios.get(
  `${BASE_URL}/api/check-file-exists/${date}/?company_id=${companyId}`,{
    headers: {
            Authorization: `Token ${token}`,
            "Content-Type": "application/json",
          },
  }
);
 // Log to debug
      return response.data.exists; // ✅ return value directly
    } catch (error) {
      toast.error("Error checking if data already exists.");
      return false;
    }
  };

  // Handle the confirmation action
  const handleConfirmUpload = () => {
    setIsModalVisible(false);
    uploadFile(); // Proceed with the file upload
  };

  // Handle the cancel action
  const handleCancelUpload = () => {
    setIsModalVisible(false); // Just close the modal without uploading
  };

 
  return (
    <div className="p-4 md:p-8 min-h-screen bg-white rounded-lg shadow-xl dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div className="text-lg font-semibold">Upload File</div>
       
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div>
          <label className="block text-sm font-medium mb-1">Date</label>
          
          {role === 'superadmin' ? (
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)} // Only superadmin can change the date
              className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            />
          ) : (
            <div className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600">
              {new Date().toLocaleDateString()} {/* Display today's date for non-superadmins */}
            </div>
          )}
          </div>

        <div className="md:col-span-2">
  <label className="block text-sm font-medium mb-1">Excel File</label>
  <div className="flex flex-col sm:flex-row items-center gap-2">
    <input
      type="file"
      accept=".csv,.xlsx,.xls"
      onChange={handleFileChange}
      ref={fileInputRef}
      className="w-full sm:w-auto px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
    />
    <div className="flex gap-2">
      <button
        onClick={handleUpload}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
      >
        Upload
      </button>
      {/* <button
        onClick={handleSyncData}
        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
      >
        Sync Data
      </button> */}
    </div>
  </div>
  <p className="text-xs text-gray-500 mt-1">Only .csv files allowed</p>
</div>

          
        </div>
      </div>

      

      {uploadSummary && (
        <div className="mt-6 p-4 border rounded bg-gray-100 dark:bg-gray-800">
          <h3 className="text-lg font-semibold mb-2">Upload Summary</h3>
          <p><strong>Total Records:</strong> {uploadSummary.total}</p>
          <p><strong>New Records:</strong> {uploadSummary.new}</p>
          <p><strong>Updated Records:</strong> {uploadSummary.updated}</p>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isVisible={isModalVisible}
        onConfirm={handleConfirmUpload}
        onCancel={handleCancelUpload}
      />
    </div>
  );
};

export default UploadFile;
