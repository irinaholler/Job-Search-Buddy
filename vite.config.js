import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/job-search-buddy/", // lowercase + hyphens, with leading+trailing slash
});
