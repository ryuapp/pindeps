import { parse as parseYaml } from "@std/yaml";
import * as v from "@valibot/valibot";

const PnpmLockFileSchema = v.object({
  lockfileVersion: v.optional(v.union([v.string(), v.number()])),
  importers: v.optional(
    v.record(
      v.string(),
      v.object({
        dependencies: v.optional(
          v.record(
            v.string(),
            v.union([v.string(), v.object({ version: v.string() })]),
          ),
        ),
        devDependencies: v.optional(
          v.record(
            v.string(),
            v.union([v.string(), v.object({ version: v.string() })]),
          ),
        ),
        optionalDependencies: v.optional(
          v.record(
            v.string(),
            v.union([v.string(), v.object({ version: v.string() })]),
          ),
        ),
      }),
    ),
  ),
  dependencies: v.optional(
    v.record(
      v.string(),
      v.union([v.string(), v.object({ version: v.string() })]),
    ),
  ),
  devDependencies: v.optional(
    v.record(
      v.string(),
      v.union([v.string(), v.object({ version: v.string() })]),
    ),
  ),
  optionalDependencies: v.optional(
    v.record(
      v.string(),
      v.union([v.string(), v.object({ version: v.string() })]),
    ),
  ),
  packages: v.optional(v.record(v.string(), v.unknown())),
});

export function parsePnpmLock(content: string): Map<string, string> {
  const versions = new Map<string, string>();
  const parsed = parseYaml(content);

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid pnpm-lock.yaml file");
  }

  const result = v.safeParse(PnpmLockFileSchema, parsed);

  if (!result.success) {
    throw new Error(
      `Invalid pnpm-lock.yaml format: ${v.flatten(result.issues)}`,
    );
  }

  const lockFile = result.output;

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
