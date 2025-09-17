import { readFileSync } from "node:fs";

interface NpmLockFile {
  lockfileVersion?: number;
  dependencies?: Record<string, { version: string }>;
  packages?: Record<string, { version?: string }>;
}

export function parseNpmLock(lockFilePath: string): Map<string, string> {
  const versions = new Map<string, string>();
  const content = readFileSync(lockFilePath, "utf8");
  const lockFile: NpmLockFile = JSON.parse(content);

  // npm v7+ (lockfileVersion 2 or 3)
  if (lockFile.packages) {
    for (const [path, info] of Object.entries(lockFile.packages)) {
      if (path === "") continue; // Skip root package
      const packageName = path.replace(/^node_modules\//, "");
      if (info.version) {
        versions.set(packageName, info.version);
      }
    }
  }

  // npm v6 and below (lockfileVersion 1)
  if (lockFile.dependencies) {
    for (const [name, info] of Object.entries(lockFile.dependencies)) {
      versions.set(name, info.version);
    }
  }

  return versions;
}
