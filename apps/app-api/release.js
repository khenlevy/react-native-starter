import { releaseToDroplet } from "@buydy/dv-cd";

const config = {
  appName: "app-stocks-api",
  appPort: 3001,
  dropletHost: "kl_droplet",
  dockerImageName: "app-stocks-api",
  workingDirectory: "/opt/app-stocks-api",
  environmentFile: ".env.production"
};

await releaseToDroplet(config);
