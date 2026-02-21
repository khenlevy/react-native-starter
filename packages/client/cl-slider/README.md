# @buydy/cl-slider

Slider components (single and dual-handle) for Buydy web applications.

## Installation

```bash
yarn add @buydy/cl-slider
```

## Usage

### Single Handle Slider

```javascript
import { Slider } from '@buydy/cl-slider';
import { DollarSign } from 'lucide-react';

function MyComponent() {
  const [value, setValue] = useState(50);
  
  return (
    <Slider
      label="Select a value"
      icon={DollarSign}
      value={value}
      onChange={setValue}
      min={0}
      max={100}
      step={1}
      formatValue={(v) => `$${v}`}
    />
  );
}
```

### Dual Handle Slider

```javascript
import { DualSlider } from '@buydy/cl-slider';
import { DollarSign } from 'lucide-react';

function MyComponent() {
  const [range, setRange] = useState([20, 80]);
  
  return (
    <DualSlider
      label="Select a range"
      icon={DollarSign}
      value={range}
      onChange={setRange}
      min={0}
      max={100}
      step={1}
      formatValue={(v) => `$${v}`}
      showResetButton={true}
      onReset={() => setRange([0, 100])}
    />
  );
}
```

## Slider Props

- `value`: Current value (number)
- `onChange`: Change handler function
- `min`: Minimum value - default: 0
- `max`: Maximum value - default: 100
- `step`: Step size - default: 1
- `label`: Label text to display above the slider
- `icon`: Icon component to display next to the label
- `showValues`: Whether to show value labels - default: true
- `formatValue`: Function to format displayed values
- `className`: Additional CSS classes

## DualSlider Props

- `value`: Current range [min, max] (array of two numbers)
- `onChange`: Change handler function
- `min`: Minimum value - default: 0
- `max`: Maximum value - default: 100
- `step`: Step size - default: 1
- `label`: Label text to display above the slider
- `icon`: Icon component to display next to the label
- `showValues`: Whether to show value labels - default: true
- `formatValue`: Function to format displayed values
- `showResetButton`: Whether to show reset button - default: false
- `onReset`: Reset handler function
- `className`: Additional CSS classes

