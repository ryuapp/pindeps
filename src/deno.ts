import { readFileSync } from "node:fs";

interface DenoLockFile {
  version?: string;
  specifiers?: Record<string, string>;
  npm?: Record<string, {
    integrity: string;
    dependencies?: Record<string, string>;
    bin?: boolean;
  }>;
  workspace?: {
    packageJson?: {
      dependencies?: string[];
      devDependencies?: string[];
    };
  };
  remote?: Record<string, string>;
}

export function parseDenoLock(lockFilePath: string): Map<string, string> {
  const versions = new Map<string, string>();
  const content = readFileSync(lockFilePath, "utf8");
  const lockFile: DenoLockFile = JSON.parse(content);

  // Parse npm packages from the npm section
  if (lockFile.npm) {
    for (const [key, _value] of Object.entries(lockFile.npm)) {
      // Format: "package-name@version" or "@scope/package@version"
      const match = key.match(/^(.+?)@([^@]+)$/);
      if (match) {
        const [, packageName, version] = match;
        versions.set(packageName, version);
      }
    }
  }

  // Also check specifiers for npm: and jsr: packages to get resolved versions
  if (lockFile.specifiers) {
    for (const [spec, resolved] of Object.entries(lockFile.specifiers)) {
      if (spec.startsWith("npm:")) {
        // Extract package name from npm specifier
        const specPart = spec.replace("npm:", "");
        const specMatch = specPart.match(/^(.+?)@[^@]+$/);
        if (specMatch) {
          const [, packageName] = specMatch;
          // The resolved value is just the version number for npm packages
          if (!resolved.includes(":")) {
            versions.set(packageName, resolved);
          }
        }
      } else if (spec.startsWith("jsr:")) {
        // Extract package name from jsr specifier
        const specPart = spec.replace("jsr:", "");
        const specMatch = specPart.match(/^(.+?)@[^@]+$/);
        if (specMatch) {
          const [, packageName] = specMatch;
          // For jsr packages, the resolved value might be "jsr:@scope/package@version"
          if (resolved.startsWith("jsr:")) {
            const resolvedMatch = resolved.match(/^jsr:(.+?)@([^@]+)$/);
            if (resolvedMatch) {
              const [, , version] = resolvedMatch;
              versions.set(packageName, version);
            }
          } else if (!resolved.includes(":")) {
            // Sometimes it's just the version number
            versions.set(packageName, resolved);
          }
        }
      }
    }
  }

  return versions;
}
