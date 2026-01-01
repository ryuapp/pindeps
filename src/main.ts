#!/usr/bin/env node

import { parseArgs } from "@std/cli/parse-args";
import { bold, brightRed } from "@ryu/enogu";
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
    boolean: ["version", "dev", "help", "check"],
    alias: { h: "help" },
    unknown: (arg: string) => {
      if (arg.startsWith("-")) {
        console.error(
          `${bold(brightRed("error"))}: unexpected argument '${arg}' found`,
        );
        console.error("\nRun 'pindeps --help' for usage information.");
        exit(1);
      }
      return false;
    },
  });

  if (args.version) {
    showVersion();
    exit(0);
  }

  if (args.help) {
    showHelp();
    exit(0);
  }

  const exitCode = runPinCommand({ dev: args.dev, check: args.check });
  exit(exitCode);
}

main();
