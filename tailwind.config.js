module.exports = {
  content: ['./src/renderer/**/*.tsx'],
  mode: 'jit',
  plugins: [require('tailwind-scrollbar-hide'), require('tailwind-scrollbar')],
  variants: {
    scrollbar: ['rounded']
  },
  theme:{
    extend:{
      keyframes:{
        zoominimg: {
          '0%, 100%': { scale: '100%' },
          '100%': { scale: '200%' }
        }
      },
    }
  }
};
