#!/usr/bin/env node

import { parseArgs } from "@std/cli/parse-args";
import { runPinCommand } from "./commands/pin.ts";
import { showHelp } from "./commands/help.ts";
import { showVersion } from "./commands/version.ts";

function isDeno(): boolean {
  return globalThis.navigator?.userAgent?.includes("Deno");
}

function exit(code: number): void {
  isDeno() ? Deno.exit(code) : globalThis.process.exit(code);
}

function main(): void {
  const inputArgs = isDeno() ? Deno.args : globalThis.process.argv.slice(2);
  const args = parseArgs(inputArgs, {
    boolean: ["version", "dev", "help"],
    alias: { h: "help" },
  });

  if (args.version) {
    showVersion();
    exit(0);
  }

  if (args.help) {
    showHelp();
    exit(0);
  }

  const exitCode = runPinCommand({ dev: args.dev });
  exit(exitCode);
}

main();
