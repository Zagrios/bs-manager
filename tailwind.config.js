

const colors = require('tailwindcss/colors');
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.tsx'],
  mode: 'jit',
  plugins: [require('tailwind-scrollbar-hide'), require('tailwind-scrollbar')],
  variants: {
    scrollbar: ['rounded']
  },
  theme:{
    colors:{
      ...colors,
      'main-color': {
        1: '#202225',
        2: '#2C2F33',
        3: '#40444b',
      },
    },
    extend:{
      keyframes:{
      },
      boxShadow: {
        'center': '0px 0px 8px 0px',
      }
    }
  }
};
