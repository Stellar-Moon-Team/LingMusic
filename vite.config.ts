import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "./",
  plugins: [vue(), tailwindcss()],
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
});
