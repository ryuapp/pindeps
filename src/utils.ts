import { statSync } from "@std/fs/unstable-stat";
import { tryParse } from "@std/semver/try-parse";

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

  // HTTP/HTTPS URLs should not be pinned
  if (version.startsWith("http://") || version.startsWith("https://")) {
    return false;
  }

  // Extract version part from protocol prefixes (jsr:, npm:)
  let versionToCheck = version;

  // For jsr: prefix, extract the version after the last "@"
  // e.g., "jsr:@ryu/enogu@0.6.2" -> "0.6.2"
  if (version.startsWith("jsr:")) {
    const lastAtIndex = version.lastIndexOf("@");
    if (lastAtIndex > 4) { // Make sure there's an @ after "jsr:"
      versionToCheck = version.slice(lastAtIndex + 1);
    } else {
      // No package name specified, just version after "jsr:"
      versionToCheck = version.slice(4); // Remove "jsr:"
    }
  }

  // For npm: prefix, extract the version after the last "@"
  // e.g., "npm:@jsr/ryu__enogu@0.6.2" -> "0.6.2"
  if (version.startsWith("npm:")) {
    const lastAtIndex = version.lastIndexOf("@");
    if (lastAtIndex > 4) { // Make sure there's an @ after "npm:"
      versionToCheck = version.slice(lastAtIndex + 1);
    }
  }

  // Use @std/semver to validate if it's a valid semver version
  // If it's a valid semver (e.g., 1.0.0, 1.0.0-beta.0), don't pin it
  // If it's a range (e.g., ^1.0.0, ~1.0.0, *), pin it
  return !tryParse(versionToCheck);
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
