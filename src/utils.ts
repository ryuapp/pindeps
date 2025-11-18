import { statSync } from "@std/fs/unstable-stat";

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

export function shouldPinVersion(version: string): boolean {
  if (version.startsWith("workspace:") || version.startsWith("catalog:")) {
    return false;
  }

  // Check if version is not in the format 'number.number.number' or 'number.number.number-suffix'
  const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;
  return !semverRegex.test(version);
}

export function ensureFileSync(path: string): boolean {
  try {
    return statSync(path).isFile;
  } catch {
    return false;
  }
}

export function ensureDirSync(path: string): boolean {
  try {
    return statSync(path).isDirectory;
  } catch {
    return false;
  }
}
