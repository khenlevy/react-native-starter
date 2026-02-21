# @buydy/cl-table

Flexible table component for Buydy web applications.

## Installation

```bash
yarn add @buydy/cl-table
```

## Usage

```javascript
import { Table } from '@buydy/cl-table';

function MyComponent() {
  const columns = [
    { key: 'name', label: 'Name', align: 'left' },
    { key: 'age', label: 'Age', align: 'center' },
    { 
      key: 'score', 
      label: 'Score', 
      align: 'center',
      render: (value) => `${value}%`
    }
  ];

  const data = [
    { id: 1, name: 'John', age: 30, score: 85 },
    { id: 2, name: 'Jane', age: 25, score: 92 }
  ];

  const getCellClassName = (row, column, value) => {
    if (column.key === 'score') {
      return value >= 90 ? 'bg-green-500 text-white' : 'bg-yellow-300';
    }
    return '';
  };

  return (
    <Table
      columns={columns}
      data={data}
      getCellClassName={getCellClassName}
      stickyFirstColumn={true}
    />
  );
}
```

## Props

### Required Props

- `columns`: Array of column definitions
  ```javascript
  {
    key: string,           // Data key or unique identifier
    label: string,         // Column header text
    align?: 'left' | 'center' | 'right',  // Text alignment (default: 'left')
    render?: (value, row) => ReactNode,   // Custom renderer
    getTooltip?: (row, value) => string   // Tooltip text
  }
  ```

- `data`: Array of row objects
  - Each row should have a unique `id` property or will use index as fallback

### Optional Props

- `getCellClassName`: Function to determine cell CSS classes
  ```javascript
  (row, column, value) => string
  ```

- `getCellValue`: Function to extract cell value (if not using row[column.key])
  ```javascript
  (row, column) => any
  ```

- `onCellClick`: Click handler for cells
  ```javascript
  (row, column, value) => void
  ```

- `stickyFirstColumn`: Whether to make first column sticky on horizontal scroll
  - Default: `false`

- `className`: Additional CSS classes for the table container

## Column Configuration

### Basic Column
```javascript
{ key: 'name', label: 'Name' }
```

### Column with Alignment
```javascript
{ key: 'score', label: 'Score', align: 'center' }
```

### Column with Custom Renderer
```javascript
{
  key: 'price',
  label: 'Price',
  render: (value) => `$${value.toFixed(2)}`
}
```

### Column with Tooltip
```javascript
{
  key: 'percentile',
  label: 'Percentile',
  getTooltip: (row, value) => `Raw: ${row.raw}\nPercentile: ${value}%`
}
```

## Examples

### Heatmap Table with Color Coding

```javascript
const getPercentileColor = (percentile, threshold = 0) => {
  if (percentile === null || percentile === undefined) return 'bg-gray-100';
  if (percentile < threshold) return 'bg-gray-300';
  if (percentile >= 0.8) return 'bg-green-500 text-white';
  if (percentile >= 0.6) return 'bg-green-300';
  if (percentile >= 0.4) return 'bg-yellow-300';
  if (percentile >= 0.2) return 'bg-orange-300';
  return 'bg-red-300';
};

<Table
  columns={metricColumns}
  data={companies}
  getCellClassName={(row, column, value) => {
    if (column.key.startsWith('metric_')) {
      return getPercentileColor(value, threshold);
    }
    return '';
  }}
  stickyFirstColumn={true}
/>
```

### Interactive Table

```javascript
<Table
  columns={columns}
  data={data}
  onCellClick={(row, column, value) => {
    console.log('Clicked:', { row, column, value });
  }}
  getCellClassName={(row, column) => {
    return column.key === 'action' ? 'cursor-pointer hover:bg-blue-50' : '';
  }}
/>
```

## Features

- Responsive design with horizontal scroll
- Sticky column support for first column
- Customizable cell rendering
- Dynamic cell styling based on data
- Hover states for rows
- Empty state handling
- Tooltip support
- Click handling
- Flexible column configuration

