# @buydy/cl-checkbox-list

Checkbox list component with search for Buydy web applications.

## Installation

```bash
yarn add @buydy/cl-checkbox-list
```

## Usage

```javascript
import { CheckboxList } from '@buydy/cl-checkbox-list';

function MyComponent() {
  const [selectedItems, setSelectedItems] = useState([]);
  
  const items = ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry'];
  
  return (
    <CheckboxList
      items={items}
      selectedItems={selectedItems}
      onChange={setSelectedItems}
      label="Select fruits"
      searchPlaceholder="Search fruits..."
    />
  );
}
```

## Props

- `items`: Array of items to display (array of strings)
- `selectedItems`: Array of currently selected items
- `onChange`: Change handler function that receives the new selected items array
- `label`: Label text to display above the list
- `searchPlaceholder`: Placeholder text for search input - default: 'Search...'
- `maxHeight`: Maximum height CSS class - default: 'max-h-32'
- `showSearch`: Whether to show search input - default: true
- `showSelectAll`: Whether to show Select All/Clear buttons - default: true
- `emptyMessage`: Message to display when no items match - default: 'No items found'
- `className`: Additional CSS classes

## Features

- Search/filter items
- Select all / Clear all functionality
- Displays count of selected items
- Scrollable list with customizable max height

