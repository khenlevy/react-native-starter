module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  extends: ["eslint:recommended", "prettier"],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
  },
  rules: {
    // Add server-specific rules here
    "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
  },
};
