
import { useState, useEffect, useRef } from "react";
import { useOutletContext } from "react-router-dom"; // <-- import this
import { FaTrash, FaPen } from "react-icons/fa";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import BASE_URL from "./config";
import { productNameMatchesSearch, normalizeProductDisplayName } from "../utils/productSearch";

const ProductPage = () => {
  // Get selected company from parent route context
  const { selectedCompany } = useOutletContext(); // assuming context provides { selectedCompany }

  const [productName, setProductName] = useState("");
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouseIds, setSelectedWarehouseIds] = useState([]);
  const [editProduct, setEditProduct] = useState(null);
  const [deleteProductId, setDeleteProductId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
const [statusFilter, setStatusFilter] = useState("all");


const errorToastShown = useRef(false); // to avoid repeated error toasts




    const handleEditClick = (product) => {
    setEditProduct({ ...product });
  };
const token = localStorage.getItem("authToken");
const config = {
  headers: {
    Authorization: `Token ${token}`,
  },
};

  const handleDeleteClick = (id) => {
    setDeleteProductId(id);
  };

const handleUpdateProduct = async () => {
  try {
    const response = await axios.put(
      `${BASE_URL}/api/update_product/${editProduct.id}/`,
      { product_name: editProduct.product_name },
      config
    );
    if (response.status === 200) {
      toast.success("Product updated successfully");
      setEditProduct(null);
      const companyId = getCompanyId();
      if (companyId) fetchProducts(companyId, statusFilter);
    }
  } catch (error) {
    toast.error("Failed to update product");
  }
};

const handleConfirmDelete = async () => {
  try {
    await axios.delete(
      `${BASE_URL}/api/delete_product/${deleteProductId}/`,
      config
    );
    toast.success("Product deleted successfully");
    setDeleteProductId(null);

    const companyId = getCompanyId();

    if (companyId) {
      fetchProducts(companyId, statusFilter);
    }

  } catch (error) {
    toast.error("Failed to delete product");
  }
};



const fetchWarehouses = async (companyId) => {
  const token = localStorage.getItem("authToken");

  if (!token) {
    if (!errorToastShown.current) {
      toast.error("Unauthorized. Please login again.");
      errorToastShown.current = true;
    }
    return;
  }

  // ✅ Prevent request if companyId is undefined or null
  if (!companyId) {
    setWarehouses([]);
    if (!errorToastShown.current) {
      toast.error("No company selected.");
      errorToastShown.current = true;
    }
    return;
  }

  try {
    const url = `${BASE_URL}/api/get_warehouse/?company_id=${companyId}`;
    const warehouseRes = await axios.get(url, {
      headers: { Authorization: `Token ${token}` },
    });

    setWarehouses(warehouseRes.data);
    errorToastShown.current = false; // reset error toast flag on success
  } catch (error) {
    console.error("Error fetching warehouses:", error);
    if (!errorToastShown.current) {
      toast.error("Error fetching warehouses");
      errorToastShown.current = true;
    }
  }
};



useEffect(() => {
  const fetchUser = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const response = await axios.get(`${BASE_URL}/api/users/me/`, {
        headers: {
          Authorization: `Token ${token}`,
        },
      });
      setCurrentUser(response.data);
      console.log("curr user data:",response.data)
    } catch (error) {
      console.error("Failed to fetch user:", error);
    }
  };

  fetchUser();
}, []);


const fetchProducts = async (companyId, status = "all") => {
  if (!companyId) {
    setProducts([]);
    return;
  }

  try {
    const response = await axios.get(
      `${BASE_URL}/api/get_products/?company_id=${companyId}&status=${status}`,
      config
    );
    if (response.status === 200) {
      setProducts(response.data);
    }
  } catch (error) {
    toast.error("Failed to fetch products");
    console.error("Fetch error:", error);
  }
};

const getCompanyId = () => selectedCompany?.id;


useEffect(() => {
  const fetchCurrentUser = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/users/me/`, config);
      setCurrentUser(res.data);
    } catch (err) {
      console.error("Failed to fetch user info:", err);
      toast.error("Failed to get user info");
    }
  };

  fetchCurrentUser();
}, []);

 useEffect(() => {
  const companyId = getCompanyId();
  if (!companyId) return;

  fetchWarehouses(companyId);
  fetchProducts(companyId, statusFilter);
  setProductName("");
  setSelectedWarehouseIds([]);
  setSelectedProductIds([]);
  setCurrentPage(1);
}, [selectedCompany]);

const handleStatusFilterChange = (value) => {
  if (!value) return;
  setStatusFilter(value);
  setCurrentPage(1);
  setSelectedProductIds([]);
  const companyId = getCompanyId();
  if (companyId) {
    fetchProducts(companyId, value);
  }
};


  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

const handleAddProduct = async () => {
  if (!productName.trim()) return;

  if (!currentUser) {
    toast.error("User not loaded yet");
    return;
  }

  const companyId = getCompanyId();

  if (!companyId) {
    toast.error("Company ID is missing");
    return;
  }

  const normalizedNewName = normalizeProductDisplayName(productName);
  if (!normalizedNewName) return;

  const existingProduct = products.find(
    (product) =>
      normalizeProductDisplayName(product.product_name).toLowerCase() ===
      normalizedNewName.toLowerCase()
  );
  if (existingProduct) {
    toast.error("Product already added");
    return;
  }

  const payload = {
    product_name: normalizedNewName,
    warehouses: selectedWarehouseIds,
    company_id: companyId,
  };

  console.log("Adding product with payload:", payload);

 try {
  const token = localStorage.getItem("authToken");
  await axios.post(`${BASE_URL}/api/add_product/`, payload, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${token}`,
    },
  });

  toast.success("Product added successfully");

  // ✅ Refresh the product list
  if (companyId) {
    fetchProducts(companyId, statusFilter);
  }

  // ✅ Optionally reset the form
  setProductName("");
  setSelectedWarehouseIds([]);

} catch (error) {
  console.error("Add product failed:", error);
  const message =
    error.response?.data?.message ||
    error.response?.data?.product_name?.[0] ||
    "Failed to add product";
  toast.error(message);
}

};


  const handleCheckboxChange = (e, warehouseId) => {
    if (e.target.checked) {
      setSelectedWarehouseIds((prevIds) => [...prevIds, warehouseId]);
    } else {
      setSelectedWarehouseIds((prevIds) =>
        prevIds.filter((id) => id !== warehouseId)
      );
    }
  };

  // ... (rest of your handlers remain the same) ...

  // Filter products by search and status (client-side safety net)
  const filteredProducts = products.filter((p) => {
    const matchesSearch = productNameMatchesSearch(p.product_name, search);
    if (statusFilter === "active") {
      return matchesSearch && p.is_active !== false;
    }
    if (statusFilter === "disabled") {
      return matchesSearch && p.is_active === false;
    }
    return matchesSearch;
  });

  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const totalPages = Math.ceil(filteredProducts.length / rowsPerPage);

  if (!selectedCompany) {
    return (
      <div className="p-4">
        <p className="text-gray-600 dark:text-gray-400">Please select a company to view products.</p>
      </div>
    );
  }


const isAllSelected =
  paginatedProducts.length > 0 &&
  paginatedProducts.every((p) => selectedProductIds.includes(p.id));


const handleSelectAll = () => {
  if (isAllSelected) {
    // Deselect only paginated products
    const remaining = selectedProductIds.filter(
      (id) => !paginatedProducts.some((p) => p.id === id)
    );
    setSelectedProductIds(remaining);
  } else {
    // Select only paginated products
    const newIds = paginatedProducts
      .filter((p) => !selectedProductIds.includes(p.id))
      .map((p) => p.id);
    setSelectedProductIds([...selectedProductIds, ...newIds]);
  }
};

const handleSelectAllFiltered = () => {
  setSelectedProductIds(filteredProducts.map((p) => p.id));
};

const handleDeselectAll = () => {
  setSelectedProductIds([]);
};



const handleRowCheckboxChange = (productId) => {
  setSelectedProductIds((prev) =>
    prev.includes(productId)
      ? prev.filter((id) => id !== productId)
      : [...prev, productId]
  );
};


const confirmBulkDelete = async () => {
  try {
    const idsParam = selectedProductIds.join(",");
    await axios.delete(`${BASE_URL}/api/delete_product/?ids=${idsParam}`, {
      headers: {
        Authorization: `Token ${token}`,
      },
    });

    toast.success("Selected products deleted successfully");
    setSelectedProductIds([]);
    setShowBulkDeleteModal(false);

    const companyId = getCompanyId();

    if (companyId) {
      fetchProducts(companyId, statusFilter);
    }
  } catch (error) {
    console.error("Bulk delete failed:", error);
    toast.error("Failed to delete selected products");
  }
};

const handleBulkToggleStatus = async (action) => {
  try {
    const response = await axios.post(
      `${BASE_URL}/api/products/bulk-toggle-status/`,
      { product_ids: selectedProductIds, action },
      config
    );

    const count = response.data.updated ?? 0;
    toast.success(`${count} product${count === 1 ? "" : "s"} ${action === "enable" ? "enabled" : "disabled"}`);
    setSelectedProductIds([]);

    const companyId = getCompanyId();

    if (companyId) {
      fetchProducts(companyId, statusFilter);
    }
  } catch (error) {
    console.error(`Bulk ${action} failed:`, error);
    toast.error(`Failed to ${action} selected products`);
  }
};



  return (
    <div className="p-4 w-full bg-white dark:bg-gray-900 min-h-screen">
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-white mb-4">
        Add Product for Company: {selectedCompany.name}
      </h2>

      {/* Add Product Form */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded shadow w-full mb-8">
        <label className="block font-semibold text-gray-700 dark:text-gray-200 text-base mb-2">
          Product Name
        </label>
        <input
          type="text"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          placeholder="Enter product name"
          className="w-full border rounded px-3 py-2 text-base dark:bg-gray-700 dark:text-white dark:border-gray-600 mb-4"
        />

        <label className="block font-semibold text-gray-700 dark:text-gray-200 text-base mb-2">
          Select Warehouse
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
          {warehouses.map((warehouse) => (
            <label key={warehouse.id} className="flex items-center space-x-2">
              <input
                type="checkbox"
                value={warehouse.id}
                checked={selectedWarehouseIds.includes(warehouse.id)}
                onChange={(e) => handleCheckboxChange(e, warehouse.id)}
              />
              <span>{warehouse.name}</span>
            </label>
          ))}
        </div>

        <button
          onClick={handleAddProduct}
          className="bg-green-600 text-white px-4 py-2 rounded text-base hover:bg-green-700"
        >
          Add
        </button>
      </div>

      {/* Product List */}
      <h3 className="text-3xl font-semibold text-gray-900 dark:text-white mb-4">
        Product List
      </h3>
      <hr className="mb-8 border-gray-300 dark:border-gray-600" />

      <div className="bg-white dark:bg-gray-800 p-4 rounded shadow w-full">
   <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
  {/* Left Side: Search + Filter + Bulk Actions */}
  <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto flex-wrap">
    <input
      type="text"
      placeholder="Search..."
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      className="border rounded px-3 py-2 text-base w-full sm:w-64 dark:bg-gray-700 dark:text-white dark:border-gray-600"
    />
    {search.trim() && (
      <span className="text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
        {filteredProducts.length} of {products.length}
      </span>
    )}

    <select
      value={statusFilter}
      onChange={(e) => handleStatusFilterChange(e.target.value)}
      className="border rounded px-3 py-2 text-base dark:bg-gray-700 dark:text-white dark:border-gray-600"
    >
      <option value="" disabled>
        Product Filter
      </option>
      <option value="all">All</option>
      <option value="active">Active</option>
      <option value="disabled">Disabled</option>
    </select>

    <select
      onChange={(e) => {
        if (e.target.value === "select_all") {
          handleSelectAllFiltered();
          e.target.value = "";
        } else if (e.target.value === "deselect_all") {
          handleDeselectAll();
          e.target.value = "";
        } else if (e.target.value === "delete") {
          if (selectedProductIds.length === 0) {
            toast.warn("No products selected");
            e.target.value = "";
            return;
          }
          setShowBulkDeleteModal(true);
          e.target.value = "";
        } else if (e.target.value === "enable" || e.target.value === "disable") {
          if (selectedProductIds.length === 0) {
            toast.warn("No products selected");
            e.target.value = "";
            return;
          }
          handleBulkToggleStatus(e.target.value);
          e.target.value = "";
        }
      }}
      className="border rounded px-3 py-2 text-base dark:bg-gray-700 dark:text-white dark:border-gray-600"
    >
      <option value="">Bulk Actions</option>
      <option value="select_all">Select All</option>
      <option value="deselect_all">Deselect All</option>
      <option value="enable">Enable Selected</option>
      <option value="disable">Disable Selected</option>
      <option value="delete">Delete</option>
    </select>

    <span className="text-sm font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">
      {selectedProductIds.length} selected
    </span>
  </div>

  {/* Right Side: Rows per Page */}
  <select
    value={rowsPerPage}
    onChange={(e) => {
      setRowsPerPage(Number(e.target.value));
      setCurrentPage(1);
    }}
    className="border rounded px-3 py-2 text-base dark:bg-gray-700 dark:text-white dark:border-gray-600"
  >
    {[10, 20, 30, 40, 50].map((num) => (
      <option key={num} value={num}>
        {num} rows
      </option>
    ))}
  </select>
</div>




        <div className="overflow-x-auto">
          <table className="w-full text-base text-left text-gray-800 dark:text-gray-200 border-collapse">
            <thead className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-y border-gray-300 dark:border-gray-600">
             <tr>
    <th className="px-3 py-3 border-r border-gray-300 dark:border-gray-600">
      <input
        type="checkbox"
        checked={isAllSelected}
        onChange={handleSelectAll}
      />
    </th>
    <th className="px-3 py-3 border-r border-gray-300 dark:border-gray-600">
      Product Name
    </th>
    <th className="px-3 py-3 text-right">Actions</th>
  </tr>
            </thead>
            <tbody>
              {paginatedProducts.length > 0 ? (
                paginatedProducts.map((product, idx) => {
                  const isDisabled = product.is_active === false;
                  return (
                  <tr
                    key={idx}
                    className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                   <td className="px-3 py-3 border-r border-gray-300 dark:border-gray-600">
    <input
      type="checkbox"
      checked={selectedProductIds.includes(product.id)}
      onChange={() => handleRowCheckboxChange(product.id)}
    />
  </td>
  <td className="px-3 py-3 border-r border-gray-300 dark:border-gray-600">
    <span className="inline-flex items-center gap-2">
      {product.product_name}
      {isDisabled && (
        <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
          Disabled
        </span>
      )}
    </span>
  </td>
  <td className="px-3 py-3 text-right space-x-4">
    <button
      type="button"
      onClick={isDisabled ? undefined : () => handleEditClick(product)}
      className={isDisabled ? "text-gray-400 cursor-not-allowed" : "text-blue-600 dark:text-blue-400"}
      aria-disabled={isDisabled}
    >
      <FaPen size={16} />
    </button>
    <button
      type="button"
      onClick={isDisabled ? undefined : () => handleDeleteClick(product.id)}
      className={isDisabled ? "text-gray-400 cursor-not-allowed" : "text-red-600 dark:text-red-400"}
      aria-disabled={isDisabled}
    >
      <FaTrash size={16} />
    </button>
  </td>
                  </tr>
                );
                })
              ) : (
                <tr>
                  <td
                    colSpan="2"
                    className="text-center py-4 text-gray-500 dark:text-gray-400"
                  >
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex justify-between items-center text-base">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
            >
              Prev
            </button>
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded w-96 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Edit Product
            </h3>
            <input
              type="text"
              value={editProduct.product_name}
              onChange={(e) =>
                setEditProduct({ ...editProduct, product_name: e.target.value })
              }
              className="w-full border px-3 py-2 rounded mb-4 dark:bg-gray-700 dark:text-white dark:border-gray-600"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditProduct(null)}
                className="px-4 py-2 bg-gray-300 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateProduct}
                className="px-4 py-2 bg-blue-600 text-white rounded"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteProductId && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded w-96 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Delete Product
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Are you sure you want to delete this product?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteProductId(null)}
                className="px-4 py-2 bg-gray-300 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}


{showBulkDeleteModal && (
  <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
    <div className="bg-white dark:bg-gray-800 p-6 rounded w-96 shadow-lg">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Confirm Bulk Delete
      </h3>
      <p className="text-gray-700 dark:text-gray-300 mb-4">
        Are you sure you want to delete {selectedProductIds.length} product(s)?
      </p>
      <div className="flex justify-end gap-2">
        <button
          onClick={() => setShowBulkDeleteModal(false)}
          className="px-4 py-2 bg-gray-300 rounded"
        >
          Cancel
        </button>
        <button
          onClick={confirmBulkDelete}
          className="px-4 py-2 bg-red-600 text-white rounded"
        >
          Delete
        </button>
      </div>
    </div>
  </div>
)}

      <ToastContainer />
    </div>
  );
};

export default ProductPage;
