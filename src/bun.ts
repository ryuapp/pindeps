import { readFileSync } from "node:fs";
import { parse as parseJsonc } from "jsonc-parser";

interface BunLockFile {
  lockfileVersion: number;
  workspaces?: Record<string, {
    name?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  }>;
  packages?: Record<string, Array<string | object>>;
}

export function parseBunLock(lockFilePath: string): Map<string, string> {
  const versions = new Map<string, string>();
  const content = readFileSync(lockFilePath, "utf8");
  const lockFile: BunLockFile = parseJsonc(content);

  // Parse from packages section to get exact versions
  // The packages section contains the resolved versions, not the workspace ranges
  if (lockFile.packages) {
    for (
      const [packageName, packageInfo] of Object.entries(lockFile.packages)
    ) {
      if (Array.isArray(packageInfo) && packageInfo.length > 0) {
        // First element in array is the specifier like "yaml@2.8.1"
        const specifier = packageInfo[0] as string;

        // Only process if packageName matches the package name in specifier exactly
        // Handle @scope/package@version format
        let match = specifier.match(/^(@[^/]+\/[^@]+)@([^@]+)$/);
        if (match) {
          const [, name, version] = match;
          if (packageName === name) {
            versions.set(name, version);
          }
        } else {
          // Handle regular package@version format
          match = specifier.match(/^([^@]+)@([^@]+)$/);
          if (match) {
            const [, name, version] = match;
            if (packageName === name) {
              versions.set(name, version);
            }
          }
        }
      }
    }
  }

  return versions;
}
