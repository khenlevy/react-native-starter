import { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

const StocksTable = ({ stocks, isLoading, onSort, sortBy, sortOrder }) => {
  const [hoveredRow, setHoveredRow] = useState(null);

  const formatCurrency = (value) => {
    if (!value) return 'N/A';
    if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    return `$${value.toLocaleString()}`;
  };

  const getSortIcon = (column) => {
    if (sortBy !== column) return null;
    return sortOrder === 'asc' ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    );
  };

  const handleSort = (column) => {
    if (onSort) {
      const newOrder =
        sortBy === column && sortOrder === 'asc' ? 'desc' : 'asc';
      onSort(column, newOrder);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 dark:border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Loading stocks...
          </p>
        </div>
      </div>
    );
  }

  if (!stocks || stocks.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-8 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            No stocks found matching your criteria.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Symbol
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center space-x-1">
                  <span>Company</span>
                  {getSortIcon('name')}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Exchange
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => handleSort('marketCap')}
              >
                <div className="flex items-center space-x-1">
                  <span>Market Cap</span>
                  {getSortIcon('marketCap')}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Sector
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Industry
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Data Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {stocks.map((stock) => (
              <tr
                key={stock.id}
                className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                  hoveredRow === stock.id
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : ''
                }`}
                onMouseEnter={() => setHoveredRow(stock.id)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
                          {stock.code?.charAt(0) || '?'}
                        </span>
                      </div>
                    </div>
                    <div className="ml-3">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {stock.code || stock.symbol}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div
                    className="text-sm text-gray-900 dark:text-gray-100 max-w-xs truncate"
                    title={stock.name}
                  >
                    {stock.name}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                    {stock.exchange}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {formatCurrency(stock.marketCap)}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div
                    className="text-sm text-gray-900 dark:text-gray-100 max-w-xs truncate"
                    title={stock.sector}
                  >
                    {stock.sector}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div
                    className="text-sm text-gray-900 dark:text-gray-100 max-w-xs truncate"
                    title={stock.industry}
                  >
                    {stock.industry}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col space-y-1">
                    <div className="flex items-center space-x-1">
                      {stock.hasFundamentals ? (
                        <div
                          className="w-2 h-2 bg-green-500 rounded-full"
                          title={`Fundamentals: ${
                            stock.fundamentalsLastUpdate
                              ? new Date(
                                  stock.fundamentalsLastUpdate,
                                ).toLocaleDateString()
                              : 'Available'
                          }`}
                        ></div>
                      ) : (
                        <div
                          className="w-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-full"
                          title="No fundamentals data"
                        ></div>
                      )}
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        F
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      {stock.hasDividends ? (
                        <div
                          className="w-2 h-2 bg-green-500 rounded-full"
                          title={`Dividends: ${
                            stock.dividendsLastUpdate
                              ? new Date(
                                  stock.dividendsLastUpdate,
                                ).toLocaleDateString()
                              : 'Available'
                          }`}
                        ></div>
                      ) : (
                        <div
                          className="w-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-full"
                          title="No dividends data"
                        ></div>
                      )}
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        D
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      {stock.hasTechnicals ? (
                        <div
                          className="w-2 h-2 bg-green-500 rounded-full"
                          title={`Technicals: ${
                            stock.technicalsLastUpdate
                              ? new Date(
                                  stock.technicalsLastUpdate,
                                ).toLocaleDateString()
                              : 'Available'
                          }`}
                        ></div>
                      ) : (
                        <div
                          className="w-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-full"
                          title="No technicals data"
                        ></div>
                      )}
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        T
                      </span>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StocksTable;
