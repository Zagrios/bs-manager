module.exports = {
  extends: 'erb',
  rules: {
    // A temporary hack related to IDE not resolving correct package.json
    'import/no-extraneous-dependencies': 'off',
    'import/no-unresolved': 'error',
    // Since React 17 and typescript 4.1 you can safely disable the rule
    'react/react-in-jsx-scope': 'off',
    'prettier/prettier': 0,
    "global-require": 0,
    "import/prefer-default-export": "off",
    "no-empty-function": "off",
    "no-await-in-loop": "off",
    "no-continue": "off",
    "@typescript-eslint/no-empty-function": "off",
    '@typescript-eslint/lines-between-class-members': "off",
    "class-methods-use-this": "off",
    "promise/catch-or-return": "off",
    "promise/always-return": "off",
    "import/order": "off",
    "react/destructuring-assignment": "off",
    "promise/no-nesting": "off",
    "react-hooks/exhaustive-deps": "off",
    "@typescript-eslint/no-shadow": "off",
    "@typescript-eslint/no-use-before-define": "off",
    "jsx-a11y/click-events-have-key-events": "off",
    "jsx-a11y/no-static-element-interactions": "off",
    "react/require-default-props": "off",
    "consistent-return": "off",
    "no-underscore-dangle": "off",
    "no-restricted-syntax": "off",
    "@typescript-eslint/no-throw-literal": "off",
    "@typescript-eslint/no-unused-expressions": "off",
    "no-param-reassign": "off",
    "no-useless-escape": "off",
    "jsx-a11y/no-noninteractive-element-interactions": "off",
    "no-async-promise-executor": "off",
    "new-cap": "off"
  },
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
    createDefaultProgram: true,
  },
  settings: {
    'import/resolver': {
      // See https://github.com/benmosher/eslint-plugin-import/issues/1396#issuecomment-575727774 for line below
      node: {},
      webpack: {
        config: require.resolve('./.erb/configs/webpack.config.eslint.ts'),
      },
      typescript: {},
    },
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx'],
    },
  },
};
