import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

if (process.env.NODE_ENV === "production")
  throw new Error(
    "npm run dev is local-only. Use the separate production startup.",
  );

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const file = resolve(root, "backend/.env");
const settings = {
  ...(existsSync(file) ? parseEnv(readFileSync(file, "utf8")) : {}),
  ...process.env,
};
for (const name of ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "DATABASE_URL"])
  if (
    !settings[name] ||
    /REPLACE_ME|YOUR_PROJECT_REF|USER:PASSWORD/.test(settings[name])
  )
    throw new Error(
      `Configure ${name} in backend/.env before starting development.`,
    );

const port = Number(settings.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT must be an integer between 1 and 65535.");

const children = [];
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
function start(args, cwd, env) {
  const child = spawn(process.execPath, args, {
    cwd: resolve(root, cwd),
    env,
    stdio: "inherit",
    windowsHide: true,
  });
  children.push(child);
  child.on("error", () => {
    console.error(
      "Development startup failed. Install workspace dependencies with npm ci.",
    );
    process.exitCode = 1;
    stop();
  });
  child.on("exit", (code) => {
    if (!stopping) {
      process.exitCode = code || 1;
      stop();
    }
  });
  return child;
}
const backend = start(
  ["--import", "tsx", "--watch", "src/server.ts"],
  "backend",
  {
    ...settings,
    NODE_ENV: "development",
    PORT: String(port),
  },
);
let ready = false;
for (let attempt = 0; attempt < 60 && !stopping; attempt++) {
  if (backend.exitCode !== null) break;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/ready`, {
      signal: AbortSignal.timeout(1000),
    });
    if (response.ok) {
      ready = true;
      break;
    }
  } catch {
    // The API validates hosted schema and private storage before listening.
  }
  await new Promise((resume) => setTimeout(resume, 250));
}
if (!ready) {
  stop();
  throw new Error(
    "Hosted API startup is incomplete. Resolve the configuration or migration error above before restarting.",
  );
}
// Never pass backend secrets or database credentials to the frontend process.
const frontendEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    ([name]) =>
      !/^(?:SUPABASE_|DATABASE_|TEST_DATABASE_|RESEND_|MAIL_|SMTP_|VITE_)/.test(
        name,
      ),
  ),
);
start(
  [
    resolve(root, "node_modules/vite/bin/vite.js"),
    "--host",
    "127.0.0.1",
    "--port",
    "5173",
    "--strictPort",
  ],
  "frontend",
  {
    ...frontendEnv,
    NODE_ENV: "development",
    VITE_SUPABASE_URL: settings.SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: settings.SUPABASE_PUBLISHABLE_KEY,
    STAYTRACK_API_PROXY_TARGET: `http://127.0.0.1:${port}`,
  },
);
console.log(
  "Real Supabase development: http://127.0.0.1:5173. No migrations or seed records are applied by startup.",
);
