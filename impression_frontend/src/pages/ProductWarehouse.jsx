import React, { useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import BASE_URL from './config';
import { productNameMatchesSearch } from '../utils/productSearch';


const ProductWarehouse = () => {
  const [entriesPerPage, setEntriesPerPage] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const { selectedCompany } = useOutletContext();


  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) {
          console.error('Token not found');
          return;
        }

        const config = {
          headers: {
            Authorization: `Token ${token}`,
          },
        };

        // Get current user info
        const userRes = await axios.get(`${BASE_URL}/api/users/me/`, config);
        const user = userRes.data;

        // Determine companyId
        let companyId = null;


     
      if (user.role === "superadmin") {
        if (selectedCompany && selectedCompany.id) {
          companyId = selectedCompany.id;
        } else if (user.companies && user.companies.length > 0) {
          companyId = user.companies[0];
        }
      } else {
        if (user.companies && user.companies.length > 0) {
          companyId = user.companies[0];
        }
      }

        if (!companyId) return;

        const [warehouseResponse, productResponse] = await Promise.all([
          axios.get(`${BASE_URL}/api/get_warehouse/?company_id=${companyId}`, config),
          axios.get(`${BASE_URL}/api/get_products/?company_id=${companyId}&status=active`, config),
        ]);

        const activeProducts = (productResponse.data || []).filter(
          (product) => product.is_active !== false
        );

        const formattedProducts = activeProducts.map((product) => {
          const warehouseMap = {};
          (product.warehouses || []).forEach((id) => {
            warehouseMap[id] = true;
          });
          return { ...product, ...warehouseMap };
        });

        setWarehouses(warehouseResponse.data);
        setProducts(formattedProducts);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchInitialData();
  }, [selectedCompany]);

  
  const filteredProducts = products.filter((p) =>
    productNameMatchesSearch(p.product_name, searchTerm)
  );
  

  const totalPages = Math.ceil(filteredProducts.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const visibleData = filteredProducts.slice(startIndex, startIndex + entriesPerPage);

  const handleCheckboxToggle = async (productId, warehouseId) => {
    const productIndex = products.findIndex((p) => p.id === productId);
    if (productIndex === -1) return; // Not found, safety check
  
    const product = products[productIndex];
    const isLinked = !!product[warehouseId];
    const action = isLinked ? 'remove' : 'add';
  
    try {
      const token = localStorage.getItem('authToken');
      const config = {
        headers: {
          Authorization: `Token ${token}`,
        },
      };
  
      const response = await axios.post(
        `${BASE_URL}/api/update_product_warehouse/`,
        {
          product_id: product.id,
          warehouse_id: warehouseId,
          action: action,
        },
        config
      );
  
      if (response.data.status === 'success') {
        const updatedProducts = [...products];
        updatedProducts[productIndex][warehouseId] = !isLinked;
        setProducts(updatedProducts);
      }
    } catch (error) {
      console.error('Error updating product warehouse link:', error);
    }
  };
  
  return (
    <div className="p-4 md:p-6 bg-white dark:bg-gray-900 min-h-screen text-gray-800 dark:text-gray-100">
      <nav className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {/* <Link to="/dashboard" className="hover:underline text-blue-600 dark:text-blue-400">
          Home
        </Link>{' / '}
        <span className="font-semibold text-gray-900 dark:text-white">Product Warehouse</span> */}
      </nav>

      <h1 className="text-2xl font-bold mb-6">Product Warehouse</h1>

      <div className="flex flex-col sm:flex-row sm:justify-between gap-4 mb-4">
        <div>
          <label className="mr-2 font-medium">Search:</label>
          <input
            type="text"
            placeholder="Search products..."
            className="border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded px-3 py-1 w-full sm:w-64"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
          {searchTerm.trim() && (
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
              {filteredProducts.length} of {products.length}
            </span>
          )}
        </div>

        <div>
          <label className="mr-2 font-medium">Rows per page:</label>
          <input
  type="number"
  min={1}
  value={entriesPerPage}
  onChange={(e) => {
    const value = e.target.value;
    if (value === "") {
      setEntriesPerPage("");
    } else {
      const numberValue = Math.max(1, Number(value));
      setEntriesPerPage(numberValue);
    }
  }}
  onBlur={() => {
    if (entriesPerPage === "") {
      setEntriesPerPage(1);
    }
  }}
  className="w-20 px-2 py-1 border dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
/>

        </div>
      </div>

      <div className="overflow-x-auto rounded-lg shadow border border-gray-200 dark:border-gray-700">
        <table className="min-w-[1200px] w-full text-sm text-left">
          <thead className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 uppercase text-xs sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3">Product</th>
              {warehouses.map((warehouse) => (
                <th key={warehouse.id} className="px-4 py-3">{warehouse.name}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {visibleData.length > 0 ? (
            visibleData.map((product) => (
              <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-4 py-3 font-semibold">{product.product_name}</td>
                {warehouses.map((warehouse) => (
                  <td key={warehouse.id} className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={!!product[warehouse.id]}
                      onChange={() => handleCheckboxToggle(product.id, warehouse.id)}
                      className="w-4 h-4 accent-blue-600"
                    />
                  </td>
                ))}
              </tr>
            ))
            ) : (
              <tr>
                <td
                  colSpan={warehouses.length + 1}
                  className="px-4 py-6 text-center text-gray-500 dark:text-gray-400"
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

      <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4">
        <span className="text-sm text-gray-600 dark:text-gray-300">
          Showing {startIndex + 1} to {Math.min(startIndex + entriesPerPage, filteredProducts.length)} of {filteredProducts.length} entries
        </span>
        <div className="flex gap-2">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((prev) => prev - 1)}
            className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:bg-gray-300 dark:disabled:bg-gray-600"
          >
            Previous
          </button>
          <span className="px-4 py-1 border rounded text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800">
            {currentPage}
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((prev) => prev + 1)}
            className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:bg-gray-300 dark:disabled:bg-gray-600"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductWarehouse;
