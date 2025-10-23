#!/usr/bin/env node

import { parseArgs } from "@std/cli/parse-args";
import packageJson from "../package.json" with { type: "json" };
import { runPinCommand } from "./commands/pin.ts";
import process from "node:process";

function main(): void {
  const args = parseArgs(process.argv.slice(2), {
    boolean: ["version", "dev"],
  });
  if (args.version) {
    console.log(`pindeps ${packageJson.version}`);
    process.exit(0);
  }

  const exitCode = runPinCommand({ dev: args.dev });
  process.exit(exitCode);
}

main();
