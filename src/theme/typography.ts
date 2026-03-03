import { TextStyle } from 'react-native';
import { colors } from './colors';

interface TypographyScale {
  title: TextStyle;
  h1: TextStyle;
  h2: TextStyle;
  body: TextStyle;
  caption: TextStyle;
}

export const typography: TypographyScale = {
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    color: colors.text,
  },
  h1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    color: colors.text,
  },
  h2: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    color: colors.text,
  },
  body: {
    fontSize: 16,
    lineHeight: 23,
    color: colors.text2,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.text3,
  },
};
