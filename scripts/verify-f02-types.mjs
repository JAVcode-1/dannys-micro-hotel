import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import prettier from "prettier";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const projectRef = "pgbierfxeviouyjsmjnh";
const linkedRef = readFileSync(
  resolve(root, "supabase/.temp/project-ref"),
  "utf8",
).trim();
if (linkedRef !== projectRef)
  throw new Error("Linked Supabase project differs from approved F02 target.");

const cliVersion = JSON.parse(
  readFileSync(resolve(root, "node_modules/supabase/package.json"), "utf8"),
).version;
if (cliVersion !== "3.2.0")
  throw new Error(`Expected Supabase CLI 3.2.0; found ${cliVersion}.`);

const generated = spawnSync(
  process.execPath,
  [
    resolve(root, "node_modules/supabase/dist/supabase.js"),
    "gen",
    "types",
    "typescript",
    "--remote=" + projectRef,
    "--schema",
    "public",
    "--schema",
    "staytrack",
  ],
  {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1" },
  },
);
if (generated.error) throw generated.error;
if (generated.status !== 0)
  throw new Error(
    `Supabase type generation failed (exit ${generated.status}).`,
  );
if (
  !generated.stdout.includes("export type Database") ||
  !generated.stdout.includes("  staytrack: {")
) {
  throw new Error(
    "Supabase did not return the expected staytrack database types.",
  );
}

const target = resolve(root, "packages/shared/src/database.types.ts");
const options = { filepath: target };
const expected = await prettier.format(generated.stdout, options);
const committed = await prettier.format(readFileSync(target, "utf8"), options);
if (expected !== committed) {
  const generatedLines = expected.split("\n");
  const committedLines = committed.split("\n");
  const firstDifference =
    generatedLines.findIndex((line, index) => line !== committedLines[index]) +
    1;
  throw new Error(
    `Database type drift near line ${firstDifference}: regenerate with Supabase CLI 3.2.0 for --remote=` +
      projectRef +
      " --schema public --schema staytrack, format with Prettier, and review the diff.",
  );
}
console.log(
  "F02 database types match linked public and staytrack schemas (Supabase CLI 3.2.0).",
);
