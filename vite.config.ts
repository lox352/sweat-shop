import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  // Served from a project page, so assets resolve under the repository name.
  base: "/sweat-shop/",
  build: {
    rollupOptions: {
      output: {
        /*
         * Each size's settled sweater in a folder of its own, so the offline
         * cache can leave them out: a knitter needs their own size, which is
         * cached when it is first shown, not all eight on every phone. See
         * scripts/build-offline.mjs.
         */
        chunkFileNames: (chunk) =>
          chunk.facadeModuleId?.includes("/data/sweaters/settled/")
            ? "assets/settled/[name]-[hash].js"
            : "assets/[name]-[hash].js",
      },
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
