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
    // Prevent console usage - use @buydy/se-logger instead
    "no-console": "error",
    "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  },
  overrides: [
    {
      files: ["**/tests/**/*.js", "**/test/**/*.js", "**/__tests__/**/*.js"],
      rules: {
        "no-console": "off", // Allow console in test files
        "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      },
    },
  ],
};
