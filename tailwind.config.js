module.exports = {
  content: ['./src/renderer/**/*.tsx'],
  mode: 'jit',
  plugins: [require('tailwind-scrollbar-hide'), require('tailwind-scrollbar')],
  variants: {
    scrollbar: ['rounded']
  }
};
