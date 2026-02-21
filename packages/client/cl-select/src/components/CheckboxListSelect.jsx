import { useState, useMemo, useEffect } from 'react';
import Select, { components } from 'react-select';

const CheckboxListSelect = ({
  items = [],
  selectedItems = [],
  onChange,
  label,
  searchPlaceholder = 'Search...',
  displayMode = 'multi-line', // 'single-line' or 'multi-line'
  maxHeight = 200,
  showSelectAll = true,
  showClearAll = true,
  showSearch = true,
  showCount = true,
  className = '',
  disabled = false,
  ...props
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(
        document.documentElement.classList.contains('dark') ||
          window.matchMedia('(prefers-color-scheme: dark)').matches,
      );
    };

    checkDarkMode();

    // Watch for class changes on html element
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    // Watch for system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', checkDarkMode);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', checkDarkMode);
    };
  }, []);

  // Convert items to react-select format
  const options = useMemo(
    () =>
      items.map((item) => ({
        value: item,
        label: item,
      })),
    [items],
  );

  // Filter options based on search term
  const filteredOptions = useMemo(
    () =>
      options.filter((option) =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [options, searchTerm],
  );

  // Convert selected items to react-select format
  const selectedOptions = useMemo(
    () =>
      selectedItems.map((item) => ({
        value: item,
        label: item,
      })),
    [selectedItems],
  );

  const handleChange = (selectedOptions) => {
    const values = selectedOptions
      ? selectedOptions.map((option) => option.value)
      : [];
    onChange(values);
  };

  const selectAll = () => {
    onChange(items);
  };

  const clearAll = () => {
    onChange([]);
  };

  // Custom MultiValue component for truncation
  const CustomMultiValue = (props) => {
    const { index, getValue } = props;
    const allValues = getValue();
    const maxVisible = displayMode === 'single-line' ? 3 : 8; // Show fewer in single-line mode

    if (index >= maxVisible) {
      // Show "..." for the last item if there are more items
      if (index === maxVisible && allValues.length > maxVisible) {
        return (
          <components.MultiValue {...props}>
            <span
              style={{
                color: isDarkMode ? '#60a5fa' : '#1e40af',
                fontSize: '14px',
              }}
            >
              +{allValues.length - maxVisible} more...
            </span>
          </components.MultiValue>
        );
      }
      return null; // Don't render items beyond maxVisible
    }

    return <components.MultiValue {...props} />;
  };

  const customStyles = {
    control: (provided, state) => ({
      ...provided,
      minHeight: '40px',
      backgroundColor: isDarkMode ? '#1f2937' : 'white',
      borderColor: state.isFocused
        ? '#3b82f6'
        : isDarkMode
        ? '#4b5563'
        : '#d1d5db',
      boxShadow: state.isFocused ? '0 0 0 1px #3b82f6' : 'none',
      '&:hover': {
        borderColor: state.isFocused
          ? '#3b82f6'
          : isDarkMode
          ? '#6b7280'
          : '#9ca3af',
      },
    }),
    input: (provided) => ({
      ...provided,
      color: isDarkMode ? '#f3f4f6' : '#111827',
    }),
    placeholder: (provided) => ({
      ...provided,
      color: isDarkMode ? '#9ca3af' : '#6b7280',
    }),
    singleValue: (provided) => ({
      ...provided,
      color: isDarkMode ? '#f3f4f6' : '#111827',
    }),
    multiValue: (provided) => ({
      ...provided,
      backgroundColor: isDarkMode ? '#1e3a8a' : '#dbeafe',
      borderRadius: '6px',
    }),
    multiValueLabel: (provided) => ({
      ...provided,
      color: isDarkMode ? '#93c5fd' : '#1e40af',
      fontSize: '14px',
    }),
    multiValueRemove: (provided) => ({
      ...provided,
      color: isDarkMode ? '#93c5fd' : '#1e40af',
      '&:hover': {
        backgroundColor: isDarkMode ? '#1e40af' : '#93c5fd',
        color: isDarkMode ? '#dbeafe' : '#1e40af',
      },
    }),
    menu: (provided) => ({
      ...provided,
      zIndex: 9999,
      maxHeight: `${maxHeight}px`,
      backgroundColor: isDarkMode ? '#1f2937' : 'white',
      border: isDarkMode ? '1px solid #4b5563' : '1px solid #e5e7eb',
    }),
    menuList: (provided) => ({
      ...provided,
      maxHeight: `${maxHeight}px`,
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected
        ? '#3b82f6'
        : state.isFocused
        ? isDarkMode
          ? '#374151'
          : '#f3f4f6'
        : isDarkMode
        ? '#1f2937'
        : 'white',
      color: state.isSelected ? 'white' : isDarkMode ? '#f3f4f6' : '#374151',
      '&:hover': {
        backgroundColor: state.isSelected
          ? '#3b82f6'
          : isDarkMode
          ? '#374151'
          : '#f3f4f6',
      },
    }),
    valueContainer: (provided) => ({
      ...provided,
      maxHeight: displayMode === 'single-line' ? '40px' : '120px',
      overflow: displayMode === 'single-line' ? 'hidden' : 'auto',
      flexWrap: displayMode === 'single-line' ? 'nowrap' : 'wrap',
    }),
    indicatorsContainer: (provided) => ({
      ...provided,
      color: isDarkMode ? '#9ca3af' : '#6b7280',
    }),
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Header with Label and Actions */}
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
        {(showSelectAll || showClearAll) && (
          <div className="flex gap-1">
            {showSelectAll && (
              <>
                <button
                  onClick={selectAll}
                  disabled={disabled}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  All
                </button>
                {showClearAll && (
                  <>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      |
                    </span>
                    <button
                      onClick={clearAll}
                      disabled={disabled}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Clear
                    </button>
                  </>
                )}
              </>
            )}
            {!showSelectAll && showClearAll && (
              <button
                onClick={clearAll}
                disabled={disabled}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* React Select Component */}
      <Select
        isMulti
        options={filteredOptions}
        value={selectedOptions}
        onChange={handleChange}
        onInputChange={showSearch ? setSearchTerm : undefined}
        placeholder={searchPlaceholder}
        isSearchable={showSearch}
        isClearable={false}
        closeMenuOnSelect={false}
        hideSelectedOptions={false}
        isDisabled={disabled}
        styles={customStyles}
        className="react-select-container"
        classNamePrefix="react-select"
        maxMenuHeight={maxHeight}
        noOptionsMessage={() => `No ${label?.toLowerCase() || 'items'} found`}
        formatOptionLabel={(option) => (
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={selectedItems.includes(option.value)}
              readOnly
              className="mr-2 h-4 w-4 text-blue-600 dark:text-blue-400 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
            />
            <span className={isDarkMode ? 'text-gray-100' : 'text-gray-900'}>
              {option.label}
            </span>
          </div>
        )}
        components={{
          MultiValue: CustomMultiValue,
        }}
        {...props}
      />

      {/* Selected Count */}
      {showCount && (
        <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
          Selected: {selectedItems.length} {label?.toLowerCase() || 'item'}
          {selectedItems.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

export default CheckboxListSelect;
