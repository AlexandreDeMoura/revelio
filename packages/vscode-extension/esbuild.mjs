// Bundles the extension host code (`src/extension.ts`) into `dist/extension.js`, the file VS Code loads.
//   --watch        rebuild on every change, for the "vscode-extension: watch" task
//   --production   minify, without source maps, for the packaged extension
//   --integration  bundle the integration tests into `out/integration` instead
import * as esbuild from "esbuild";
import fs from "node:fs";
import { createRequire } from "node:module";

const flags = new Set(process.argv.slice(2));
const watch = flags.has("--watch");
const production = flags.has("--production");
const integration = flags.has("--integration");

// Prints the lines the watch task's problem matcher in `.vscode/tasks.json` reads.
const watchLog = {
  name: "watch-log",
  setup(build) {
    build.onStart(() => console.log("[watch] build started"));
    build.onEnd(({ errors }) => {
      for (const { text, location } of errors) {
        console.error(`✘ [ERROR] ${text}`);
        if (location) console.error(`    ${location.file}:${location.line}:${location.column}:`);
      }
      console.log("[watch] build finished");
    });
  },
};

// The repo root's code the extension bundles finds its files from where it runs
// (`import.meta.url`): tree-sitter's `web-tree-sitter.wasm` beside `dist/extension.js`, and the
// grammars in `grammars/`, as in the root package. They are copied there.
function copyTreeSitterFiles() {
  const root = new URL("../../", import.meta.url);
  const grammars = new URL("grammars/", root);
  if (!fs.existsSync(grammars)) throw new Error("No grammars at the repo root: run `npm run grammars` there first.");
  fs.mkdirSync(new URL("dist/", import.meta.url), { recursive: true });
  fs.cpSync(grammars, new URL("grammars/", import.meta.url), { recursive: true });
  const runtime = createRequire(new URL("package.json", root)).resolve("web-tree-sitter/web-tree-sitter.wasm");
  fs.copyFileSync(runtime, new URL("dist/web-tree-sitter.wasm", import.meta.url));
}

if (!integration) copyTreeSitterFiles();

const context = await esbuild.context({
  ...(integration
    ? { entryPoints: ["test/integration/*.test.ts"], outdir: "out/integration" }
    : { entryPoints: ["src/extension.ts"], outfile: "dist/extension.js" }),
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node20",
  external: ["vscode"],
  // A CommonJS bundle has no `import.meta`: its URL is the bundle's own.
  define: { "import.meta.url": "__importMetaUrl" },
  banner: { js: 'const __importMetaUrl = require("node:url").pathToFileURL(__filename).href;' },
  minify: production,
  sourcemap: !production,
  sourcesContent: false,
  logLevel: watch ? "silent" : "info",
  plugins: watch ? [watchLog] : [],
});

if (watch) {
  await context.watch();
} else {
  await context.rebuild();
  await context.dispose();
}
