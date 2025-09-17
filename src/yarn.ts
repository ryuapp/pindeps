import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";

interface YarnLockFile {
  __metadata?: {
    version: number;
    cacheKey: string;
  };
  [key: string]: {
    version?: string;
    resolution?: string;
    dependencies?: Record<string, string>;
    checksum?: string;
    languageName?: string;
    linkType?: string;
    bin?: Record<string, string> | boolean;
  } | {
    version: number;
    cacheKey: string;
  } | undefined;
}

export function parseYarnLock(lockFilePath: string): Map<string, string> {
  const versions = new Map<string, string>();
  const content = readFileSync(lockFilePath, "utf8");
  const lockFile = parseYaml(content) as YarnLockFile;

  for (const [key, packageInfo] of Object.entries(lockFile)) {
    // Skip metadata and undefined entries
    if (key === "__metadata" || !packageInfo) {
      continue;
    }

    // Check if it's a package info with version (not metadata)
    if ("version" in packageInfo && typeof packageInfo.version === "string") {
      // Extract package name from key
      const packageName = extractPackageNameFromYarnKey(key);
      if (packageName) {
        versions.set(packageName, packageInfo.version);
      }
    }
  }

  return versions;
}

function extractPackageNameFromYarnKey(key: string): string | null {
  // Skip workspace entries as they are local packages
  if (key.includes("@workspace:")) {
    return null;
  }

  // Handle scoped packages: "@scope/package@npm:^version"
  let match = key.match(/^(@[^/]+\/[^@]+)@npm:/);
  if (match) {
    return match[1];
  }

  // Handle regular packages: "package@npm:^version"
  match = key.match(/^([^@]+)@npm:/);
  if (match) {
    return match[1];
  }

  // Handle legacy yarn v1 format: "package@^version"
  match = key.match(/^([^@]+)@[^@]+$/);
  if (match) {
    return match[1];
  }

  // Handle scoped packages in legacy format: "@scope/package@^version"
  match = key.match(/^(@[^/]+\/[^@]+)@[^@]+$/);
  if (match) {
    return match[1];
  }

  return null;
}
