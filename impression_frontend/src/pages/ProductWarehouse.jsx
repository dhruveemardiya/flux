import React, { useState, useEffect, useMemo } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import BASE_URL from './config';
import { productNameMatchesSearch } from '../utils/productSearch';

const ProductWarehouse = () => {
  const [entriesPerPage, setEntriesPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState('product_name');
  const [sortDirection, setSortDirection] = useState('asc');
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

  const filteredProducts = useMemo(() => {
    return products.filter((p) =>
      productNameMatchesSearch(p.product_name, searchTerm)
    );
  }, [products, searchTerm]);

  const sortedProducts = useMemo(() => {
    const list = [...filteredProducts];
    if (!sortKey) return list;

    return list.sort((a, b) => {
      if (sortKey === 'product_name') {
        const valA = (a.product_name ?? '').toString().trim();
        const valB = (b.product_name ?? '').toString().trim();
        const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
        return sortDirection === 'asc' ? cmp : -cmp;
      }
      if (sortKey.startsWith('wh_')) {
        const whId = sortKey.replace('wh_', '');
        const valA = a[whId] ? 1 : 0;
        const valB = b[whId] ? 1 : 0;
        if (valA !== valB) {
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        }
        return (a.product_name ?? '').toString().localeCompare((b.product_name ?? '').toString(), undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      }
      return 0;
    });
  }, [filteredProducts, sortKey, sortDirection]);

  const perPageNum = Math.max(1, Number(entriesPerPage) || 1);
  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / perPageNum) || 1);
  const startIndex = (currentPage - 1) * perPageNum;
  const visibleData = sortedProducts.slice(startIndex, startIndex + perPageNum);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortKey, sortDirection, entriesPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (key) => {
    if (sortKey !== key) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 opacity-60 inline-block ml-1 group-hover:opacity-100 transition-opacity" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 inline-block ml-1" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 inline-block ml-1" />
    );
  };

  const handleCheckboxToggle = async (productId, warehouseId) => {
    const productIndex = products.findIndex((p) => p.id === productId);
    if (productIndex === -1) return;

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
      <h1 className="text-2xl font-bold mb-4">Product Warehouse</h1>

      {/* Toolbar with space-efficient controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 dark:bg-gray-800/60 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 mb-4">
        {/* Search */}
        <div className="flex items-center gap-2 flex-1 min-w-[180px] max-w-sm">
          <input
            type="text"
            placeholder="Search products..."
            className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Sort Dropdown for space utilization */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2.5 py-1">
            <label htmlFor="pwSortSelect" className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap font-medium">
              Sort:
            </label>
            <select
              id="pwSortSelect"
              value={`${sortKey}_${sortDirection}`}
              onChange={(e) => {
                const val = e.target.value;
                const lastUnderscore = val.lastIndexOf('_');
                const key = val.substring(0, lastUnderscore);
                const dir = val.substring(lastUnderscore + 1);
                setSortKey(key);
                setSortDirection(dir);
              }}
              className="bg-transparent text-xs sm:text-sm text-gray-800 dark:text-gray-100 outline-none cursor-pointer"
            >
              <option value="product_name_asc" className="dark:bg-gray-800">Product (A → Z)</option>
              <option value="product_name_desc" className="dark:bg-gray-800">Product (Z → A)</option>
              {warehouses.map((wh) => (
                <React.Fragment key={wh.id}>
                  <option value={`wh_${wh.id}_desc`} className="dark:bg-gray-800">
                    {wh.name} (Linked First)
                  </option>
                  <option value={`wh_${wh.id}_asc`} className="dark:bg-gray-800">
                    {wh.name} (Unlinked First)
                  </option>
                </React.Fragment>
              ))}
            </select>
          </div>

          {/* Rows per page */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2.5 py-1">
            <label htmlFor="pwRowsSelect" className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap font-medium">
              Rows:
            </label>
            <select
              id="pwRowsSelect"
              value={entriesPerPage}
              onChange={(e) => setEntriesPerPage(Number(e.target.value))}
              className="bg-transparent text-xs sm:text-sm text-gray-800 dark:text-gray-100 outline-none cursor-pointer"
            >
              {[5, 10, 20, 30, 50, 100].map((num) => (
                <option key={num} value={num} className="dark:bg-gray-800">
                  {num}
                </option>
              ))}
            </select>
          </div>

          {searchTerm.trim() && (
            <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
              {sortedProducts.length} of {products.length}
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg shadow border border-gray-200 dark:border-gray-700">
        <table className="min-w-[1200px] w-full text-sm text-left">
          <thead className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 uppercase text-xs sticky top-0 z-10 select-none">
            <tr>
              <th
                onClick={() => handleSort('product_name')}
                className="px-4 py-3 cursor-pointer group hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title="Click to sort by Product Name (Ascending / Descending)"
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold">Product</span>
                  {renderSortIcon('product_name')}
                </div>
              </th>
              {warehouses.map((warehouse) => (
                <th
                  key={warehouse.id}
                  onClick={() => handleSort(`wh_${warehouse.id}`)}
                  className="px-4 py-3 cursor-pointer group hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-center"
                  title={`Click to sort by ${warehouse.name} link status`}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="font-semibold">{warehouse.name}</span>
                    {renderSortIcon(`wh_${warehouse.id}`)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {visibleData.length > 0 ? (
              visibleData.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 font-semibold">{product.product_name}</td>
                  {warehouses.map((warehouse) => (
                    <td key={warehouse.id} className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={!!product[warehouse.id]}
                        onChange={() => handleCheckboxToggle(product.id, warehouse.id)}
                        className="w-4 h-4 accent-blue-600 cursor-pointer"
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
                    ? 'No products found.'
                    : 'No products match your search.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-3">
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {sortedProducts.length === 0
            ? 'Showing 0 entries'
            : `Showing ${startIndex + 1} to ${Math.min(startIndex + perPageNum, sortedProducts.length)} of ${sortedProducts.length} entries`}
        </span>
        <div className="flex items-center gap-3">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            Previous
          </button>
          <span className="text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <button
            disabled={currentPage === totalPages || sortedProducts.length === 0}
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductWarehouse;
