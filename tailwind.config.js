/**
 * Tailwind CSS v4 uses a CSS-first configuration approach.
 * The actual theming, DaisyUI plugin setup, and brand colors are defined in:
 *   src/styles/tailwind.css  (via @plugin "daisyui" and @theme directives)
 *   src/styles.scss          (global overrides)
 *
 * This file is kept for the `content` paths array, which Tailwind v4 still
 * reads for class scanning, and for IDE autocompletion support.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{html,ts,scss}',
  ],
};
