// Load environment variables FIRST
import { loadEnvironmentVariables } from "./src/config/envLoader.js";
loadEnvironmentVariables();

import logger from "@buydy/se-logger";
import { StocksScannerApp } from "./src/init/index.js";
import "./src/server.js"; // Start HTTP server

/**
 * Main application entry point
 */
async function main() {
  const app = new StocksScannerApp();

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    logger.business("\n⚠️  Received SIGINT, shutting down gracefully...");
    await app.shutdown();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    logger.business("\n⚠️  Received SIGTERM, shutting down gracefully...");
    await app.shutdown();
    process.exit(0);
  });

  // Start the application
  await app.start();
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.business("💥 Fatal error", { error: error.message, stack: error.stack });
    process.exit(1);
  });
}

export { main };