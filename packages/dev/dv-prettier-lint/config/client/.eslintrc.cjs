module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react/jsx-runtime", // Support React 17+ JSX transform (no React import needed)
    "prettier",
  ],
  plugins: ["react"],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  settings: {
    react: {
      version: "detect",
    },
  },
  rules: {
    // Add client-specific rules here
    "react/prop-types": "off", // Disable prop-types for shared component libraries
    "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  },
};
