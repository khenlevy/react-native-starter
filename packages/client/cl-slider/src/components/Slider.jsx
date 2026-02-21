const Slider = ({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  icon: Icon,
  showValues = true,
  formatValue,
  className = '',
  ...props
}) => {
  const handleChange = (e) => {
    onChange(parseFloat(e.target.value));
  };

  const displayValue = formatValue ? formatValue(value) : value;

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
          {Icon && <Icon className="h-4 w-4" />}
          <span>{label}</span>
        </label>
      )}
      <div className="relative px-2 py-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-thumb"
          {...props}
        />
      </div>
      {showValues && (
        <div className="flex justify-between items-center text-sm px-2">
          <span className="text-gray-500 text-xs">
            {formatValue ? formatValue(min) : min}
          </span>
          <span className="font-medium text-blue-600 text-xs">
            {displayValue}
          </span>
          <span className="text-gray-500 text-xs">
            {formatValue ? formatValue(max) : max}
          </span>
        </div>
      )}
    </div>
  );
};

export default Slider;
