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

export function getLockedVersion(lockFile: LockFile): LockData {
  const content = readTextFileSync(lockFile.path);

  let versions: Map<string, string>;
  let catalog: Record<string, string> | undefined;
  let catalogs: Record<string, Record<string, string>> | undefined;
  let importers: Map<string, Map<string, string>> | undefined;

  switch (lockFile.type) {
    case "deno":
      {
        const denoLockData = parseDenoLock(content);
        versions = denoLockData.versions;
        importers = denoLockData.importers;
      }
      break;
    case "bun":
      {
        const bunLockData = parseBunLock(content);
        versions = bunLockData.versions;
        importers = bunLockData.importers;
      }
      break;
    case "yarn":
      {
        const yarnLockData = parseYarnLock(content);
        versions = yarnLockData.versions;
        importers = yarnLockData.importers;
      }
      break;
    case "npm":
      versions = parseNpmLock(content);
      break;
    case "pnpm":
      {
        const pnpmLockData = parsePnpmLock(content);
        versions = pnpmLockData.versions;
        importers = pnpmLockData.importers;
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

  return { versions, catalog, catalogs, importers };
}
