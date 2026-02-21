import { MongoClient } from "mongodb";
import logger from "@buydy/se-logger";

export async function waitForMongo(uri, retries = 5, delay = 1000) {
  logger.business("🏥 Checking MongoDB connection...");
  logger.business("📍 MongoDB URI", { uri });

  for (let i = 0; i < retries; i++) {
    try {
      logger.business(`🔄 Attempt ${i + 1}/${retries}...`);

      const client = new MongoClient(uri, {
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000, // 5 second timeout
        connectTimeoutMS: 5000,
      });

      await client.connect();
      await client.db().command({ ping: 1 });
      await client.close();

      logger.business("✅ MongoDB is live and ready!");
      return true;
    } catch (err) {
      logger.business(`❌ Attempt ${i + 1} failed`, { error: err.message });

      if (i < retries - 1) {
        logger.business(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise((res) => setTimeout(res, delay));
      }
    }
  }

  logger.business("❌ MongoDB connection failed after all retries");
  logger.business("💡 Please check:");
  logger.business("   - MongoDB container is running: docker ps | grep mongo");
  logger.business("   - MongoDB port is accessible: docker logs mongo");
  logger.business("   - Network connectivity: docker network ls");

  throw new Error("MongoDB did not become ready in time");
}
