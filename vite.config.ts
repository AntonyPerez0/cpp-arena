import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// browsercc's Emscripten glue references its .wasm via new URL(..., import.meta.url),
// which makes Vite copy 65 MB of wasm into /assets. We load the toolchain
// ourselves (public/toolchain, cached), so strip that reference.
function skipBrowserccWasm(): Plugin {
  return {
    name: "skip-browsercc-wasm",
    enforce: "pre",
    transform(code, id) {
      if (!/browsercc[\\/]dist[\\/](clang|lld)\.js$/.test(id)) return null;
      return code.replace(/new URL\("(clang|lld)\.wasm",import\.meta\.url\)\.href/g, '"$1.wasm"');
    },
  };
}

// base "./" keeps every URL relative, so the site works on GitHub Pages
// under any repository name (https://<user>.github.io/<repo>/).
export default defineConfig({
  base: "./",
  plugins: [react(), skipBrowserccWasm()],
  worker: { format: "es", plugins: () => [skipBrowserccWasm()] },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1500,
  },
  optimizeDeps: {
    exclude: ["browsercc"],
  },
});
