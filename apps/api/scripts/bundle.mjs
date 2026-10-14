// Bundles the server (and the shared workspace package) into dist/ so it runs with plain
// `node dist/server.js`. Third-party packages stay external and are installed normally.
import { readFileSync } from "node:fs";
import { build } from "esbuild";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const external = Object.keys(pkg.dependencies).filter((name) => name !== "@coffee/shared");

await build({
  entryPoints: { server: "src/server.ts", "create-org": "src/scripts/createOrg.ts" },
  outdir: "dist",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  sourcemap: true,
  external,
  logLevel: "info",
});
