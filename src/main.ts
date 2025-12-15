#!/usr/bin/env node

import { parseArgs } from "@std/cli/parse-args";
import packageJson from "../package.json" with { type: "json" };
import { runPinCommand } from "./commands/pin.ts";

function isDeno(): boolean {
  return globalThis.navigator?.userAgent?.includes("Deno");
}

function exit(code: number): void {
  isDeno() ? Deno.exit(code) : globalThis.process.exit(code);
}

function main(): void {
  const inputArgs = isDeno() ? Deno.args : globalThis.process.argv.slice(2);
  const args = parseArgs(inputArgs, {
    boolean: ["version", "dev"],
  });
  if (args.version) {
    console.log(`pindeps ${packageJson.version}`);
    exit(0);
  }

  const exitCode = runPinCommand({ dev: args.dev });
  exit(exitCode);
}

main();
