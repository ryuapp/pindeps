import { readFileSync } from "node:fs";
import { parse as parseYaml } from "@std/yaml";

interface PnpmLockFile {
  lockfileVersion?: string | number;
  importers?: Record<string, {
    dependencies?: Record<string, { version: string } | string>;
    devDependencies?: Record<string, { version: string } | string>;
    optionalDependencies?: Record<string, { version: string } | string>;
  }>;
  dependencies?: Record<string, { version: string } | string>;
  devDependencies?: Record<string, { version: string } | string>;
  optionalDependencies?: Record<string, { version: string } | string>;
  packages?: Record<string, unknown>;
}

export function parsePnpmLock(lockFilePath: string): Map<string, string> {
  const versions = new Map<string, string>();
  const content = readFileSync(lockFilePath, "utf8");
  const parsed = parseYaml(content);

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid pnpm-lock.yaml file");
  }

  const lockFile = parsed as unknown as PnpmLockFile;

  // Handle root dependencies
  const processDeps = (deps?: Record<string, { version: string } | string>) => {
    if (!deps) return;
    for (const [name, value] of Object.entries(deps)) {
      const version = typeof value === "string"
        ? value.replace(/^[^0-9]*/, "") // Remove prefix like "^", "~", etc.
        : value.version;
      if (
        version && !version.startsWith("link:") && !version.startsWith("file:")
      ) {
        // Extract clean version number
        const cleanVersion = version.split("_")[0].split("(")[0];
        versions.set(name, cleanVersion);
      }
    }
  };

  // Process importers (for monorepos)
  if (lockFile.importers) {
    for (const importer of Object.values(lockFile.importers)) {
      processDeps(
        importer.dependencies as Record<string, { version: string } | string>,
      );
      processDeps(
        importer.devDependencies as Record<
          string,
          { version: string } | string
        >,
      );
      processDeps(
        importer.optionalDependencies as Record<
          string,
          { version: string } | string
        >,
      );
    }
  } else {
    // Process root-level dependencies (for regular repos)
    processDeps(
      lockFile.dependencies as Record<string, { version: string } | string>,
    );
    processDeps(
      lockFile.devDependencies as Record<string, { version: string } | string>,
    );
    processDeps(
      lockFile.optionalDependencies as Record<
        string,
        { version: string } | string
      >,
    );
  }

  return versions;
}
