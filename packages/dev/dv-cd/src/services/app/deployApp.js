// services/app/index.js
export async function deployApp(conn, basePath, releasePath, imageName) {
  const containerName = `${imageName}-app`;

  // Stop/remove old container if running
  await conn.execCommand(`docker rm -f ${containerName} || true`);

  // Ensure buydy-network exists before deployment
  // This prevents iptables chain errors when Docker tries to attach containers
  await conn.execCommand(`
    docker network create buydy-network --driver bridge 2>/dev/null || true
  `);

  // Verify Docker iptables chains exist (critical for networking)
  // If chains are missing, Docker won't be able to set up port forwarding
  await conn.execCommand(`
    # Check if DOCKER chain exists in filter table
    if ! iptables -t filter -L DOCKER >/dev/null 2>&1; then
      echo "⚠️ DOCKER iptables chain missing, attempting to fix..."
      # Create Docker chains
      iptables -t filter -N DOCKER 2>/dev/null || true
      iptables -t filter -N DOCKER-USER 2>/dev/null || true
      # Restart Docker to rebuild chains properly
      systemctl restart docker || service docker restart || true
      # Wait for Docker to fully initialize
      sleep 3
      # Verify chains exist now
      if iptables -t filter -L DOCKER >/dev/null 2>&1; then
        echo "✅ Docker iptables chains restored"
      else
        echo "❌ Warning: Docker chains still missing, container may fail to start"
      fi
    fi
  `);

  // Determine port binding based on app name
  // Scanner and API should be localhost-only for security (SSH tunneling)
  const portBinding =
    imageName === "app-stocks-scanner"
      ? "127.0.0.1:4001:4001" // Scanner: localhost only
      : imageName === "app-stocks-api"
      ? "127.0.0.1:3001:3001" // API: localhost only
      : "4001:4001"; // Default

  // Build MongoDB URL based on authentication requirements
  let mongoUrl = process.env.MONGO_URL;

  // If MONGO_URL is not provided or doesn't have credentials, build it from components
  if (
    !mongoUrl ||
    (!mongoUrl.includes("@") &&
      process.env.MONGO_USERNAME &&
      process.env.MONGO_PASSWORD)
  ) {
    const host = process.env.MONGO_HOST || "mongo";
    const port = process.env.MONGO_PORT || "27017";
    const database = process.env.MONGO_DATABASE || "markets_data";
    const username = process.env.MONGO_USERNAME;
    const password = process.env.MONGO_PASSWORD;

    if (username && password) {
      mongoUrl = `mongodb://${username}:${password}@${host}:${port}/${database}?authSource=admin`;
    } else {
      mongoUrl = `mongodb://${host}:${port}/${database}`;
    }
  }

  // Start new container with environment variables and memory limits
  // Memory limit: Scanner needs 1GB due to large percentile calculations, API can use 512MB
  const memoryLimit = imageName === "app-stocks-scanner" ? "1100m" : "512m";
  const memorySwap = imageName === "app-stocks-scanner" ? "2200m" : "1g";

  await conn.execCommand(`
    docker run -d \
      --name ${containerName} \
      --restart always \
      --network buydy-network \
      --memory="${memoryLimit}" \
      --memory-swap="${memorySwap}" \
      -p ${portBinding} \
      -e NODE_ENV="${process.env.NODE_ENV || "production"}" \
      -e DEBUG_MODE="${process.env.DEBUG_MODE || "false"}" \
      -e API_PORT="${process.env.API_PORT}" \
      -e API_HOST="${process.env.API_HOST}" \
      -e MONGO_URL="${mongoUrl}" \
      -e MONGO_HOST="${process.env.MONGO_HOST}" \
      -e MONGO_PORT="${process.env.MONGO_PORT}" \
      -e MONGO_DATABASE="${process.env.MONGO_DATABASE}" \
      -e MONGO_USERNAME="${process.env.MONGO_USERNAME}" \
      -e MONGO_PASSWORD="${process.env.MONGO_PASSWORD}" \
      -e API_EODHD_API_TOKEN="${
        process.env.API_EODHD_API_TOKEN || "your_eodhd_api_key_here"
      }" \
      ${imageName}
  `);

  console.log(`🚀 Started container: ${containerName}`);
}
