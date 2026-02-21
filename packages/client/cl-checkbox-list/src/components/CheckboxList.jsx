import { useState } from 'react';

const CheckboxList = ({
  items = [],
  selectedItems = [],
  onChange,
  label,
  searchPlaceholder = 'Search...',
  maxHeight = 'max-h-32',
  showSearch = true,
  showSelectAll = true,
  emptyMessage = 'No items found',
  className = '',
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredItems = items.filter((item) =>
    item.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const toggleItem = (item) => {
    if (selectedItems.includes(item)) {
      onChange(selectedItems.filter((i) => i !== item));
    } else {
      onChange([...selectedItems, item]);
    }
  };

  const selectAll = () => {
    onChange(filteredItems);
  };

  const clearAll = () => {
    onChange([]);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Header with Label and Actions */}
      <div className="flex items-center justify-between mb-2">
        {label && (
          <label className="block text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        {showSelectAll && (
          <div className="flex gap-1">
            <button
              onClick={selectAll}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              All
            </button>
            <span className="text-xs text-gray-400">|</span>
            <button
              onClick={clearAll}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Search Input */}
      {showSearch && (
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full text-sm border border-gray-300 rounded px-2 py-1 mb-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      )}

      {/* Checkbox List */}
      <div
        className={`${maxHeight} overflow-y-auto border border-gray-300 rounded-lg p-2`}
      >
        {filteredItems.map((item) => (
          <label
            key={item}
            className="flex items-center mb-1 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded"
          >
            <input
              type="checkbox"
              checked={selectedItems.includes(item)}
              onChange={() => toggleItem(item)}
              className="mr-2 cursor-pointer"
            />
            <span className="text-sm">{item}</span>
          </label>
        ))}
        {filteredItems.length === 0 && (
          <div className="text-sm text-gray-500 text-center py-2">
            {emptyMessage}
          </div>
        )}
      </div>

      {/* Selected Count */}
      <div className="mt-2 text-xs text-gray-600">
        Selected: {selectedItems.length} item
        {selectedItems.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
};

export default CheckboxList;
