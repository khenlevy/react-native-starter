const Select = ({
  value,
  onChange,
  options = [],
  placeholder = 'Select...',
  label,
  icon: Icon,
  isLoading = false,
  disabled = false,
  className = '',
  ...props
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          {Icon && <Icon className="h-4 w-4" />}
          <span>{label}</span>
        </label>
      )}
      <select
        value={value}
        onChange={onChange}
        disabled={disabled || isLoading}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {isLoading ? (
          <option disabled>Loading...</option>
        ) : (
          options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))
        )}
      </select>
    </div>
  );
};

export default Select;
