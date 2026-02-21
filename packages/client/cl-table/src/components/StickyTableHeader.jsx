const StickyTableHeader = ({
  columns = [],
  data = [],
  getCellClassName,
  getCellValue,
  onCellClick,
  headerClassName = '',
  tbodyClassName = '',
  className = '',
  containerClassName = '',
}) => {
  return (
    <div className={`flex flex-col h-full ${containerClassName}`}>
      <div className="flex-1 overflow-auto min-h-0">
        <table className={`relative w-full border ${className}`}>
          <thead>
            <tr>
              {columns.map((column, index) => {
                const alignClass =
                  column.align === 'left'
                    ? 'text-left'
                    : column.align === 'right'
                    ? 'text-right'
                    : 'text-center';
                const headerBgClass =
                  column.headerClassName || headerClassName || 'bg-gray-100';
                return (
                  <th
                    key={column.key || index}
                    className={`sticky top-0 px-6 py-3 ${alignClass} text-xs font-medium uppercase z-20 ${headerBgClass}`}
                  >
                    {column.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className={`divide-y ${tbodyClassName}`}>
            {data.map((row, rowIndex) => (
              <tr key={row.id || rowIndex}>
                {columns.map((column, colIndex) => {
                  const value = getCellValue
                    ? getCellValue(row, column)
                    : row[column.key];
                  const cellClassName = getCellClassName
                    ? getCellClassName(row, column, value)
                    : '';
                  const alignClass =
                    column.align === 'left'
                      ? 'text-left'
                      : column.align === 'right'
                      ? 'text-right'
                      : 'text-center';

                  return (
                    <td
                      key={column.key || colIndex}
                      className={`px-6 py-4 ${alignClass} text-sm ${cellClassName} ${
                        column.cellClassName || ''
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
        <div className="text-center text-gray-500 py-8">No data available</div>
      )}
    </div>
  );
};

export default StickyTableHeader;
