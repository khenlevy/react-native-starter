import { CheckboxListSelect } from '@buydy/cl-select';

const SectorFilter = ({
  sectors = [],
  selectedSectors = [],
  onChange,
  label = 'Sectors',
  searchPlaceholder = 'Search sectors...',
  displayMode = 'multi-line',
  className = '',
  disabled = false,
}) => {
  return (
    <CheckboxListSelect
      items={sectors}
      selectedItems={selectedSectors}
      onChange={onChange}
      label={label}
      searchPlaceholder={searchPlaceholder}
      displayMode={displayMode}
      className={className}
      disabled={disabled}
    />
  );
};

export default SectorFilter;
