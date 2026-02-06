import { readTextFileSync } from "@std/fs/unstable-read-text-file";
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
  importers?: Map<string, Map<string, string>>;
}

const LOCK_PARSERS = {
  deno: parseDenoLock,
  bun: parseBunLock,
  yarn: parseYarnLock,
  npm: parseNpmLock,
  pnpm: parsePnpmLock,
} as const;

export function getLockedVersion(lockFile: LockFile): LockData {
  const content = readTextFileSync(lockFile.path);
  const parser = LOCK_PARSERS[lockFile.type];

  if (!parser) {
    throw new Error(`Unsupported lockfile type: ${lockFile.type}`);
  }

  const { versions, importers } = parser(content);

  // pnpm is the only package manager that needs special catalog handling
  if (lockFile.type === "pnpm") {
    const { catalog, catalogs } = parsePnpmLockForCatalogs(content);
    return { versions, importers, catalog, catalogs };
  }

  return { versions, importers };
}
