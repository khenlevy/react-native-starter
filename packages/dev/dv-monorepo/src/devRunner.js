import { spawn, exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

/**
 * Kill processes running on specified ports
 */
async function killProcessesOnPorts(ports) {
  console.log(
    `${colors.yellow}🔍 Checking for existing processes...${colors.reset}`
  );

  for (const [service, port] of Object.entries(ports)) {
    try {
      const { stdout } = await execAsync(`lsof -ti:${port}`);
      const pids = stdout
        .trim()
        .split("\n")
        .filter((pid) => pid);

      if (pids.length > 0) {
        console.log(
          `${
            colors.red
          }🔄 Killing existing ${service} processes on port ${port} (PIDs: ${pids.join(
            ", "
          )})${colors.reset}`
        );

        for (const pid of pids) {
          try {
            await execAsync(`kill -9 ${pid}`);
            console.log(
              `${colors.green}✅ Killed process ${pid}${colors.reset}`
            );
          } catch (error) {
            console.log(
              `${colors.yellow}⚠️  Process ${pid} may have already been terminated${colors.reset}`
            );
          }
        }
      } else {
        console.log(
          `${colors.green}✅ No existing ${service} processes found on port ${port}${colors.reset}`
        );
      }
    } catch (error) {
      if (error.code === 1) {
        console.log(
          `${colors.green}✅ No existing ${service} processes found on port ${port}${colors.reset}`
        );
      } else {
        console.log(
          `${colors.yellow}⚠️  Could not check port ${port}: ${error.message}${colors.reset}`
        );
      }
    }
  }

  console.log(
    `${colors.blue}⏳ Waiting for processes to terminate...${colors.reset}`
  );
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

/**
 * Start development servers
 */
function startDevServers(services) {
  console.log(
    `${colors.cyan}🚀 Starting development servers...${colors.reset}\n`
  );

  const spawnedProcesses = [];

  services.forEach(({ name, command, args, color = "cyan" }) => {
    console.log(`${colors[color]}📦 Starting ${name}...${colors.reset}`);

    const child = spawn(command, args, {
      stdio: "inherit",
      shell: true,
      env: { ...process.env },
    });

    child.on("error", (error) => {
      console.error(
        `${colors.red}❌ Error starting ${name}: ${error.message}${colors.reset}`
      );
    });

    child.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        console.error(
          `${colors.red}❌ ${name} exited with code ${code}${colors.reset}`
        );
        // Kill other processes if one fails
        spawnedProcesses.forEach((p) => {
          if (p.pid !== child.pid) {
            p.kill("SIGTERM");
          }
        });
      }
    });

    spawnedProcesses.push(child);
  });

  // Handle graceful shutdown
  const cleanup = () => {
    console.log(
      `\n${colors.yellow}🛑 Shutting down development servers...${colors.reset}`
    );
    spawnedProcesses.forEach((child) => {
      child.kill("SIGTERM");
    });

    // Force kill after 5 seconds if processes don't exit gracefully
    setTimeout(() => {
      spawnedProcesses.forEach((child) => {
        child.kill("SIGKILL");
      });
      process.exit(0);
    }, 5000);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // Keep the script running
  return new Promise(() => {});
}

/**
 * Main development runner
 */
export async function runDevelopmentServers(options = {}) {
  const {
    services = [],
    ports = {},
    title = "Development Environment",
  } = options;

  try {
    console.log(`${colors.magenta}🎯 ${title}${colors.reset}`);
    console.log(
      `${colors.magenta}${"=".repeat(title.length + 3)}${colors.reset}\n`
    );

    if (Object.keys(ports).length > 0) {
      await killProcessesOnPorts(ports);
      console.log();
    }

    await startDevServers(services);
  } catch (error) {
    console.error(
      `${colors.red}❌ Fatal error: ${error.message}${colors.reset}`
    );
    process.exit(1);
  }
}
