import { spawn } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const servers = ["dev:frontend", "dev:backend"].map((script) =>
  spawn(npm, ["run", script], {
    stdio: "inherit",
    shell: process.platform === "win32",
  }),
);

function stop() {
  for (const server of servers) server.kill();
}

for (const server of servers) {
  server.on("error", (error) => {
    console.error(error);
    stop();
    process.exitCode = 1;
  });
  server.on("exit", (code) => {
    stop();
    if (code) process.exitCode = code;
  });
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
