import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => {
  const backend = loadEnv(
    mode,
    fileURLToPath(new URL("../backend", import.meta.url)),
    "SUPABASE_",
  );
  const frontend = loadEnv(
    mode,
    fileURLToPath(new URL(".", import.meta.url)),
    "VITE_",
  );
  const url =
    process.env.VITE_SUPABASE_URL ||
    backend.SUPABASE_URL ||
    frontend.VITE_SUPABASE_URL;
  const key =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    backend.SUPABASE_PUBLISHABLE_KEY ||
    frontend.VITE_SUPABASE_PUBLISHABLE_KEY;
  return {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(url || ""),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        key || "",
      ),
    },
    plugins: [react(), tailwindcss()],
    publicDir: "landing-public",
    server: {
      fs: {
        deny: [
          ".env",
          ".env.*",
          "*.{crt,pem}",
          "**/.git/**",
          "**/.local-assets/**",
          "**/public/images/**",
        ],
      },
      proxy: {
        "/api": {
          target:
            process.env.STAYTRACK_API_PROXY_TARGET || "http://127.0.0.1:3001",
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
  };
});
