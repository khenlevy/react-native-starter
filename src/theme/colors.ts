const colors = {
  brand: {
    primary: '#5572C3',
    background: '#F9F6FF',
  },
  text: {
    primary: '#32253C',
    secondary: '#666666',
    inverse: '#ffffff',
  },
  background: {
    primary: '#F9F6FF',
    secondary: '#ffffff',
    card: '#ffffff',
  },
  state: {
    success: '#4CAF50',
    error: '#F44336',
    warning: '#FFC107',
    info: '#2196F3'
  },
  common: {
    white: '#ffffff',
    black: '#000000',
    transparent: 'transparent'
  }
};

// Type definitions for better TypeScript support
export type ColorScheme = typeof colors;
export type BrandColors = typeof colors.brand;
export type TextColors = typeof colors.text;
export type BackgroundColors = typeof colors.background;
export type StateColors = typeof colors.state;
export type CommonColors = typeof colors.common;

export default colors;
