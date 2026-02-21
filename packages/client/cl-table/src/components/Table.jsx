import { useState } from 'react';

const Table = ({
  columns = [],
  data = [],
  getCellClassName,
  getCellValue,
  onCellClick,
  stickyFirstColumn = false,
  className = '',
}) => {
  const [hoveredRow, setHoveredRow] = useState(null);

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow ${className}`}>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={column.key || index}
                  className={`px-4 py-3 text-${
                    column.align || 'left'
                  } text-xs font-medium text-gray-700 dark:text-gray-300 uppercase ${
                    stickyFirstColumn && index === 0
                      ? 'sticky left-0 bg-gray-100 dark:bg-gray-700 z-20'
                      : ''
                  }`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.map((row, rowIndex) => (
              <tr
                key={row.id || rowIndex}
                className="transition-colors"
                onMouseEnter={() => setHoveredRow(rowIndex)}
                onMouseLeave={() => setHoveredRow(null)}
                style={
                  hoveredRow === rowIndex
                    ? {
                        filter: 'brightness(1.24)',
                        transition:
                          'filter 0.15s ease-in-out, border-color 0.15s ease-in-out',
                        borderTop: '2px solid rgba(147, 197, 253, 0.7)',
                        borderBottom: '2px solid rgba(147, 197, 253, 0.7)',
                      }
                    : {
                        filter: 'none',
                        transition:
                          'filter 0.15s ease-in-out, border-color 0.15s ease-in-out',
                        borderTop: '2px solid transparent',
                        borderBottom: '2px solid transparent',
                      }
                }
              >
                {columns.map((column, colIndex) => {
                  const value = getCellValue
                    ? getCellValue(row, column)
                    : row[column.key];
                  const cellClassName = getCellClassName
                    ? getCellClassName(row, column, value)
                    : '';
                  const isFirstColumn = stickyFirstColumn && colIndex === 0;

                  return (
                    <td
                      key={column.key || colIndex}
                      className={`px-4 py-3 text-${
                        column.align || 'left'
                      } text-sm ${cellClassName} ${
                        isFirstColumn
                          ? 'font-medium text-gray-900 dark:text-gray-100 sticky left-0 bg-white dark:bg-gray-800 z-10'
                          : ''
                      }`}
                      onClick={() =>
                        onCellClick && onCellClick(row, column, value)
                      }
                      title={
                        column.getTooltip
                          ? column.getTooltip(row, value)
                          : undefined
                      }
                    >
                      {column.render ? column.render(value, row) : value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length === 0 && (
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          No data available
        </div>
      )}
    </div>
  );
};

export default Table;
