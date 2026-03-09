/**
 * Color Configuration
 * Centralized color definitions for the application
 */
export const COLORS = {
  // Base colors
  white: '#fff',
  black: '#24163E', // Very dark brand purple

  // Primary colors
  primary: '#4B2A7D', // Main logo purple
  primaryDark: '#371B58', // Darker logo purple
  primaryLight: '#F3F0F9', // Very light brand purple for backgrounds

  // Accent colors (Gold/Yellow from logo)
  yellowGreen: '#FBB03B', // Logo Gold
  orchid: '#7C57B7', // Secondary purple
  khaki: '#FFEB99',
  lightSkyBlue: '#AFC0FF',

  // Gray scale
  grayDark: '#4A4A4A',
  gray: '#9CA3AF',
  gainsboro: '#F9FAFB',
  lightGray: '#E5E7EB',

  // Status colors
  salmon: '#EF4444', // Professional red
  green: '#10B981', // Professional green
  limeGreen: '#84CC16',
  orange: '#F59E0B', // Professional orange

  // Text colors
  textOnWhite: '#1F2937',
  textOnDark: '#FFFFFF',

  // Button colors
  buttonPrimary: '#4B2A7D',
  buttonPrimaryBorder: '#4B2A7D',
  buttonHoverText: '#FFFFFF',
  buttonHoverBorder: '#371B58',
} as const;

