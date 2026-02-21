const DualSlider = ({
  value = [0, 100], // [minValue, maxValue]
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  icon: Icon,
  showValues = true,
  formatValue,
  showResetButton = false,
  onReset,
  className = '',
  ...props
}) => {
  const [minValue, maxValue] = value;

  const handleMinChange = (e) => {
    const newMin = parseFloat(e.target.value);
    if (newMin <= maxValue) {
      onChange([newMin, maxValue]);
    }
  };

  const handleMaxChange = (e) => {
    const newMax = parseFloat(e.target.value);
    if (newMax >= minValue) {
      onChange([minValue, newMax]);
    }
  };

  const displayMinValue = formatValue ? formatValue(minValue) : minValue;
  const displayMaxValue = formatValue ? formatValue(maxValue) : maxValue;

  const hasCustomRange = minValue !== min || maxValue !== max;

  return (
    <div className={`space-y-3 ${className}`}>
      {label && (
        <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
          {Icon && <Icon className="h-4 w-4" />}
          <span>{label}</span>
        </label>
      )}

      {/* Range Slider Container */}
      <div className="relative px-4 py-2">
        <div className="relative">
          {/* Track */}
          <div className="absolute top-1/2 left-0 right-0 h-2 bg-gray-200 rounded-lg transform -translate-y-1/2"></div>

          {/* Active Range */}
          <div
            className="absolute top-1/2 h-2 bg-blue-500 rounded-lg transform -translate-y-1/2"
            style={{
              left: `${((minValue - min) / (max - min)) * 100}%`,
              width: `${((maxValue - minValue) / (max - min)) * 100}%`,
            }}
          ></div>

          {/* Min Range Input */}
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={minValue}
            onChange={handleMinChange}
            className="absolute top-1/2 left-0 right-0 w-full h-2 bg-transparent appearance-none cursor-pointer transform -translate-y-1/2 slider-thumb"
            {...props}
          />

          {/* Max Range Input */}
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={maxValue}
            onChange={handleMaxChange}
            className="absolute top-1/2 left-0 right-0 w-full h-2 bg-transparent appearance-none cursor-pointer transform -translate-y-1/2 slider-thumb"
            {...props}
          />
        </div>
      </div>

      {/* Range Values Display */}
      {showValues && (
        <div className="flex justify-between items-center text-sm px-2">
          <div className="flex flex-col items-center px-2">
            <span className="text-gray-500 text-xs mb-1">Min</span>
            <span className="font-medium text-blue-600 text-xs">
              {displayMinValue}
            </span>
          </div>
          <div className="flex flex-col items-center px-2">
            <span className="text-gray-500 text-xs mb-1">Max</span>
            <span className="font-medium text-blue-600 text-xs">
              {displayMaxValue}
            </span>
          </div>
        </div>
      )}

      {/* Reset Range Button */}
      {showResetButton && hasCustomRange && (
        <div className="flex justify-center px-2">
          <button
            onClick={onReset}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Reset to full range
          </button>
        </div>
      )}
    </div>
  );
};

export default DualSlider;
