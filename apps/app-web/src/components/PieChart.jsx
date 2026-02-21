const PieChart = ({
  data,
  title,
  colors = [
    '#3B82F6',
    '#10B981',
    '#F59E0B',
    '#EF4444',
    '#8B5CF6',
    '#06B6D4',
    '#84CC16',
    '#F97316',
  ],
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500">
        <span>No data available</span>
      </div>
    );
  }

  // Calculate total for percentages
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500">
        <span>No data available</span>
      </div>
    );
  }

  // Calculate angles for pie slices
  let currentAngle = 0;
  const slices = data.map((item, index) => {
    const percentage = (item.value / total) * 100;
    const angle = (item.value / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;

    currentAngle += angle;

    // Calculate path for pie slice
    const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
    const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
    const x2 = 50 + 40 * Math.cos((endAngle * Math.PI) / 180);
    const y2 = 50 + 40 * Math.sin((endAngle * Math.PI) / 180);

    const largeArcFlag = angle > 180 ? 1 : 0;

    const pathData = [
      `M 50 50`,
      `L ${x1} ${y1}`,
      `A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      'Z',
    ].join(' ');

    return {
      ...item,
      percentage: percentage.toFixed(1),
      pathData,
      color: colors[index % colors.length],
    };
  });

  return (
    <div className="space-y-4">
      {title && (
        <h4 className="text-sm font-medium text-gray-900 text-center">
          {title}
        </h4>
      )}

      <div className="flex items-center justify-center">
        <svg
          width="120"
          height="120"
          viewBox="0 0 100 100"
          className="transform -rotate-90"
        >
          {slices.map((slice, index) => (
            <path
              key={index}
              d={slice.pathData}
              fill={slice.color}
              stroke="white"
              strokeWidth="1"
              className="hover:opacity-80 transition-opacity cursor-pointer"
              title={`${slice.label}: ${slice.value} (${slice.percentage}%)`}
            />
          ))}
        </svg>
      </div>

      <div className="space-y-2">
        {slices.map((slice, index) => (
          <div
            key={index}
            className="flex items-center justify-between text-xs"
          >
            <div className="flex items-center space-x-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: slice.color }}
              />
              <span
                className="text-gray-600 truncate max-w-20"
                title={slice.label}
              >
                {slice.label}
              </span>
            </div>
            <div className="text-right">
              <div className="font-medium text-gray-900">{slice.value}</div>
              <div className="text-gray-500">{slice.percentage}%</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PieChart;
