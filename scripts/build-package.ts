#!/usr/bin/env -S deno -W=bin --unstable
await Deno.remove("./bin").catch(() => {});
await Deno.bundle({
  entrypoints: ["./src/main.ts"],
  outputPath: "./bin",
});
