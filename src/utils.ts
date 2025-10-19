import { readFileSync } from "node:fs";
import { parseNpmLock } from "./npm.ts";
import { parseYarnLock } from "./yarn.ts";
import { parsePnpmLock, parsePnpmLockForCatalogs } from "./pnpm.ts";
import { parseBunLock } from "./bun.ts";
import { parseDenoLock } from "./deno.ts";

export type PackageManager = "npm" | "yarn" | "pnpm" | "bun" | "deno";

export interface LockFile {
  path: string;
  type: PackageManager;
}

export interface LockData {
  versions: Map<string, string>;
  catalog?: Record<string, string>;
  catalogs?: Record<string, Record<string, string>>;
}

export function getLockedVersion(lockFile: LockFile): LockData {
  const content = readFileSync(lockFile.path, "utf8");

  let versions: Map<string, string>;
  let catalog: Record<string, string> | undefined;
  let catalogs: Record<string, Record<string, string>> | undefined;

  switch (lockFile.type) {
    case "deno":
      versions = parseDenoLock(content);
      break;
    case "bun":
      versions = parseBunLock(content);
      break;
    case "yarn":
      versions = parseYarnLock(content);
      break;
    case "npm":
      versions = parseNpmLock(content);
      break;
    case "pnpm":
      {
        versions = parsePnpmLock(content);
        const pnpmData = parsePnpmLockForCatalogs(content);
        catalog = pnpmData.catalog;
        catalogs = pnpmData.catalogs;
      }
      break;
    default:
      throw new Error(
        `Unsupported lockfile type: ${lockFile.type satisfies never}`,
      );
  }

  return { versions, catalog, catalogs };
}

export function shouldPinVersion(version: string): boolean {
  if (version.startsWith("workspace:") || version.startsWith("catalog:")) {
    return false;
  }

  // Check if version uses range operators or partial versions
  return (
    version.startsWith("^") ||
    version.startsWith("~") ||
    version.startsWith(">") ||
    version.startsWith("<") ||
    version.startsWith(">=") ||
    version.startsWith("<=") ||
    version.includes(" - ") ||
    version.includes(" || ") ||
    version === "*" ||
    version === "latest" ||
    !version.includes(".") ||
    version.split(".").length < 3
  );
}
