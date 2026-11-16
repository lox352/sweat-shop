import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import { livePatterns } from "./scripts/live-patterns.mjs";
import { physicsNow } from "./scripts/shapes.mjs";

export default defineConfig({
  // Developing, patterns come from the designs as they are in hand: see scripts/live-patterns.mjs.
  plugins: [react(), livePatterns()],
  // What the settling runs on, hashed, as the shapes are named by it: for a sweater settled on the device to be named as one settled here (see src/physics/naming.ts).
  define: { __PHYSICS__: JSON.stringify(physicsNow()) },
  // Served from a project page, so assets resolve under the repository name.
  base: "/sweat-shop/",
  build: {
    /*
     * Raw sizes, which say little: three.js and a settled 4XL are each over a
     * megabyte raw and a fifth of that over the wire. What a phone fetches is
     * held to budgets, gzipped, by scripts/budgets.mjs.
     */
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test-setup.ts"],
  },
});
