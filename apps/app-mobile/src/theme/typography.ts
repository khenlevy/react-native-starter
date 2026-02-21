import { TextStyle } from 'react-native';
import colors from './colors';

export const typography = {
  h1: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 32,
    lineHeight: 40,
    color: colors.text.primary,
  } as TextStyle,
  
  h2: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 24,
    lineHeight: 32,
    color: colors.text.primary,
  } as TextStyle,

  body1: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 16,
    lineHeight: 24,
    color: colors.text.secondary,
  } as TextStyle,

  body2: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.secondary,
  } as TextStyle,

  button: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: colors.text.inverse,
  } as TextStyle,
} as const;

export type TypographyType = typeof typography; 