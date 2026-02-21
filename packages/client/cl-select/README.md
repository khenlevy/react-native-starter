# @buydy/cl-select

Select dropdown component for Buydy web applications.

## Installation

```bash
yarn add @buydy/cl-select
```

## Usage

```javascript
import { Select } from '@buydy/cl-select';
import { Building2 } from 'lucide-react';

function MyComponent() {
  const [value, setValue] = useState('');
  
  const options = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' }
  ];
  
  return (
    <Select
      label="Choose an option"
      icon={Building2}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      options={options}
      placeholder="Select..."
    />
  );
}
```

## Props

- `value`: Currently selected value
- `onChange`: Change handler function
- `options`: Array of option objects with `value` and `label` properties
- `placeholder`: Placeholder text - default: 'Select...'
- `label`: Label text to display above the select
- `icon`: Icon component to display next to the label
- `isLoading`: Whether the select is loading - default: false
- `disabled`: Whether the select is disabled - default: false
- `className`: Additional CSS classes

