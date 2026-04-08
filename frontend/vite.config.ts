import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig(async () => {
  // Workaround for ESM-only package loading inside Vite config.
  const mod = await import("@tailwindcss/vite");
  const tailwindcss = mod.default ?? mod;

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      host: true  // Listen on all network interfaces for LAN access
    }
  };
});

