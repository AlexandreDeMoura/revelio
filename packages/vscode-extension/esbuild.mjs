// Bundles the extension host code (`src/extension.ts`) into `dist/extension.js`, the file VS Code loads.
//   --watch        rebuild on every change, for the "vscode-extension: watch" task
//   --production   minify, without source maps, for the packaged extension
//   --integration  bundle the integration tests into `out/integration` instead
import * as esbuild from "esbuild";

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

const context = await esbuild.context({
  ...(integration
    ? { entryPoints: ["test/integration/*.test.ts"], outdir: "out/integration" }
    : { entryPoints: ["src/extension.ts"], outfile: "dist/extension.js" }),
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node20",
  external: ["vscode"],
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
