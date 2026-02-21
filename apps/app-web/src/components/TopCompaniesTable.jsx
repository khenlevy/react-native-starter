import { useState } from 'react';
import { Table } from '@buydy/cl-table';

const TopCompaniesTable = ({ topCompanies, optimizationMethodName }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!topCompanies || topCompanies.length === 0) {
    return null;
  }

  return (
    <div className="p-6">
      <button
        type="button"
        className={`w-full flex items-center justify-between px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-accent-dark ${
          isExpanded
            ? 'bg-gray-100 dark:bg-gray-800'
            : 'bg-gray-200 dark:bg-gray-700'
        }`}
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
      >
        <span className="flex items-center space-x-2">
          <span className="text-base font-semibold dark:text-white">
            Top Companies by {optimizationMethodName}
          </span>
          <svg
            className={`h-4 w-4 text-gray-500 dark:text-gray-300 transform transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 12a1 1 0 01-.707-.293l-4-4a1 1 0 111.414-1.414L10 9.586l3.293-3.293a1 1 0 111.414 1.414l-4 4A1 1 0 0110 12z"
              clipRule="evenodd"
            />
          </svg>
        </span>
        <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300">
          Showing {topCompanies.length} companies
        </span>
      </button>
      {isExpanded && (
        <div className="mt-2 bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 rounded-lg">
          <Table
            className="max-h-80 overflow-y-auto text-sm"
            columns={[
              {
                key: 'symbol',
                label: 'Company',
                align: 'left',
              },
              {
                key: 'score',
                label: 'Score',
                align: 'right',
                render: (value) => {
                  if (value === null || value === undefined) return '-';
                  return (value * 100).toFixed(1) + '%';
                },
              },
            ]}
            data={topCompanies.map((company) => ({
              id: company.symbol,
              symbol: company.symbol,
              score: company.score,
            }))}
            getCellValue={(row, column) => {
              return row[column.key];
            }}
            getCellClassName={(row, column) => {
              if (column.key === 'symbol') {
                return 'font-medium';
              }
              return 'text-right';
            }}
            stickyFirstColumn={false}
          />
        </div>
      )}
    </div>
  );
};

export default TopCompaniesTable;
