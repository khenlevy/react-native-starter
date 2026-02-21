#!/usr/bin/env node

import { execSync } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findPackageJson(dir) {
  const pkgPath = path.join(dir, "package.json");
  if (fs.existsSync(pkgPath)) return pkgPath;
  const parent = path.dirname(dir);
  if (parent === dir) return null;
  return findPackageJson(parent);
}

function detectContext(targetDir) {
  // Look for package.json and use name or keywords to infer context
  const pkgPath = findPackageJson(targetDir);
  if (!pkgPath) return "client"; // default to client
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const name = pkg.name || "";
  const keywords = pkg.keywords || [];

  // CLI tools in packages/dev/ should use CLI config
  if (
    pkgPath.includes("/dev/") &&
    (name.includes("dv-") ||
      keywords.includes("cli") ||
      keywords.includes("dev"))
  ) {
    return "cli";
  }

  // Special case: dv-prettier-lint is a Node.js tool package
  if (name.includes("dv-prettier-lint")) return "cli";

  if (name.includes("server") || keywords.includes("server")) return "server";
  if (name.includes("client") || keywords.includes("client")) return "client";
  // fallback: if in packages/server or packages/client
  if (pkgPath.includes("/server/")) return "server";
  if (pkgPath.includes("/client/")) return "client";
  return "client";
}

// 1. Define a list of default source directories to lint
const DEFAULT_SOURCE_DIRS = ["src", "lib", "source", "app", "apps"];

// 2. Function to find which of these directories exist in the current working directory
function getExistingSourceDirs(baseDir) {
  return DEFAULT_SOURCE_DIRS.filter((dir) =>
    fs.existsSync(path.join(baseDir, dir))
  );
}

const args = process.argv.slice(2);
let targets = args;
if (targets.length === 0) {
  targets = getExistingSourceDirs(process.cwd());
  if (targets.length === 0) {
    // fallback: lint everything
    targets = ["."];
  }
}

const context = detectContext(process.cwd());
const configDir = path.join(__dirname, "../config", context);
const eslintConfig = path.join(configDir, ".eslintrc.cjs");
const prettierConfig = path.join(configDir, ".prettierrc.cjs");

try {
  console.log(`\nDetected context: ${context}`);

  // Run ESLint with auto-fix
  console.log(`\n🔍 Running ESLint on ${targets.join(", ")} ...`);
  try {
    const lintCmd = `npx eslint --config "${eslintConfig}" --ext .js,.jsx,.ts,.tsx --fix ${targets.join(" ")}`;
    execSync(lintCmd, { stdio: "inherit" });
    console.log("✅ ESLint: All files are clean!");
  } catch (err) {
    console.log(
      "❌ ESLint: Some files have issues that could not be auto-fixed."
    );
    // Continue to Prettier even if ESLint has issues
  }

  // Run Prettier with auto-fix
  console.log(`\n🎨 Running Prettier on ${targets.join(", ")} ...`);
  try {
    const prettierCmd = `npx prettier --config "${prettierConfig}" --write "${targets.join("/**/*.{js,jsx,ts,tsx,json,css,md}")}"`;
    execSync(prettierCmd, { stdio: "inherit" });
    console.log("✅ Prettier: All files formatted successfully!");
  } catch (err) {
    console.log("❌ Prettier: Some files could not be formatted.");
    process.exit(1);
  }

  console.log("\n🎉 All checks completed successfully!");
} catch (err) {
  console.log("\n💥 Something went wrong during the lint/prettier process.");
  process.exit(1);
}
