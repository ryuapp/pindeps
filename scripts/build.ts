#!/usr/bin/env -S deno run -WRES --allow-ffi scripts/build.ts
import denoPlugin from "@deno/rolldown-plugin";
import { build } from "tsdown";

await Deno.remove("./bin").catch(() => { });

await build({
  config: false,
  entry: {
    bin: "./src/main.ts",
  },
  format: "esm",
  target: false,
  clean: false,
  outDir: ".",
  plugins: [denoPlugin()],
  outputOptions: {
    entryFileNames: "bin",
  },
});
