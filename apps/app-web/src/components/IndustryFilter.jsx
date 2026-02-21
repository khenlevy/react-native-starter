import { CheckboxListSelect } from '@buydy/cl-select';

const IndustryFilter = ({
  industries = [],
  selectedIndustries = [],
  onChange,
  label = 'Industries',
  searchPlaceholder = 'Search industries...',
  displayMode = 'multi-line',
  className = '',
  disabled = false,
}) => {
  return (
    <CheckboxListSelect
      items={industries}
      selectedItems={selectedIndustries}
      onChange={onChange}
      label={label}
      searchPlaceholder={searchPlaceholder}
      displayMode={displayMode}
      className={className}
      disabled={disabled}
    />
  );
};

export default IndustryFilter;
