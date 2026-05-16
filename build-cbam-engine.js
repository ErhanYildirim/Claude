// esbuild ile src/cbam/ → cbam-engine.js (browser IIFE bundle)
// Kullanım: node build-cbam-engine.js

import { build } from "esbuild";

await build({
  entryPoints: ["src/cbam/browser.ts"],
  bundle:      true,
  format:      "iife",
  globalName:  "CBAMEngine",
  outfile:     "cbam-engine.js",
  target:      ["es2020", "chrome90", "firefox88", "safari14"],
  platform:    "browser",
  minify:      false,   // okunabilirlik için; prod'da true yap
  sourcemap:   true,
  logLevel:    "info",
});

console.log("✓ cbam-engine.js oluşturuldu");
