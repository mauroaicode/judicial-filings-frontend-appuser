/** @type {import('tailwindcss').Config} */
const { COLORS } = require('./src/app/core/config/colors.config');

module.exports = {
  content: [
    './src/**/*.{html,ts,scss}',
  ],
  theme: {
    extend: {
      colors: {
        // Custom color palette
        primary: COLORS.primary,
        'primary-dark': COLORS.primaryDark,
        'primary-light': COLORS.primaryLight,
        'yellow-green': COLORS.yellowGreen,
        orchid: COLORS.orchid,
        khaki: COLORS.khaki,
        'light-sky-blue': COLORS.lightSkyBlue,
        'gray-dark': COLORS.grayDark,
        gray: COLORS.gray,
        gainsboro: COLORS.gainsboro,
        'light-gray': COLORS.lightGray,
        salmon: COLORS.salmon,
        green: COLORS.green,
        'lime-green': COLORS.limeGreen,
        orange: COLORS.orange,
        // Text colors
        'text-on-white': COLORS.textOnWhite,
        'text-on-dark': COLORS.textOnDark,
        // Button colors
        'button-primary': COLORS.buttonPrimary,
        'button-primary-border': COLORS.buttonPrimaryBorder,
        'button-hover-text': COLORS.buttonHoverText,
        'button-hover-border': COLORS.buttonHoverBorder,
      },
    },
  },
  plugins: [
    require('daisyui'),
  ],
  daisyui: {
    themes: [
      {
        light: {
          ...require('daisyui/src/theming/themes')['light'],
          // Override with custom colors
          primary: COLORS.primary,
          'primary-content': COLORS.textOnDark,
          secondary: COLORS.orchid,
          'secondary-content': COLORS.textOnDark,
          accent: COLORS.yellowGreen,
          'accent-content': COLORS.textOnDark,
          neutral: COLORS.black,
          'neutral-content': COLORS.textOnDark,
          'base-100': COLORS.white,
          'base-200': COLORS.gainsboro,
          'base-300': COLORS.lightGray,
          'base-content': COLORS.textOnWhite,
          // Keep default DaisyUI colors for other properties
          error: COLORS.salmon,
          'error-content': '#fff',
          info: COLORS.orchid,
          success: COLORS.green,
          warning: COLORS.yellowGreen,
        },
      },
    ],
    base: true,
    styled: true,
    utils: true,
    prefix: '',
    logs: true,
    themeRoot: ':root',
  },
};

