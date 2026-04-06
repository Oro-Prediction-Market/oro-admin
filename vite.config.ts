import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    fs: {
      // Restrict serving to tara-admin's own directory only,
      // preventing Vite from accidentally resolving files from
      // the sibling Tara monorepo workspace.
      allow: ["."],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  esbuild: {
    sourcemap: false,
  },
  build: {
    minify: "esbuild",
    target: "es2020",
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
          "vendor-radix": ["radix-ui"],
          "vendor-lucide": ["lucide-react"],
        },
      },
    },
  },
})
