# @buydy/cl-button

Button component for Buydy web applications.

## Installation

```bash
yarn add @buydy/cl-button
```

## Usage

```javascript
import { Button } from '@buydy/cl-button';

function MyComponent() {
  return (
    <Button 
      onClick={() => console.log('clicked')}
      variant="primary"
      size="md"
    >
      Click me
    </Button>
  );
}
```

## Props

- `children`: Content to display inside the button
- `onClick`: Click handler function
- `type`: Button type ('button', 'submit', 'reset') - default: 'button'
- `variant`: Button style variant - default: 'primary'
  - 'primary': Blue button
  - 'secondary': Gray button
  - 'success': Green button
  - 'danger': Red button
  - 'outline': Outlined button
  - 'ghost': Text button with hover effect
- `size`: Button size - default: 'md'
  - 'sm': Small
  - 'md': Medium
  - 'lg': Large
- `disabled`: Whether the button is disabled - default: false
- `className`: Additional CSS classes

