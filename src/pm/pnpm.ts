import * as v from "@valibot/valibot";
import { yamlSchema } from "../schema.ts";

const PnpmLockFileSchema = v.pipe(
  v.string(),
  yamlSchema,
  v.object({
    lockfileVersion: v.optional(v.union([v.string(), v.number()])),
    catalogs: v.optional(
      v.record(
        v.string(),
        v.record(
          v.string(),
          v.union([
            v.string(),
            v.object({
              specifier: v.string(),
              version: v.string(),
            }),
          ]),
        ),
      ),
    ),
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
  }),
);

function extractCatalogVersions(
  catalogData: Record<
    string,
    string | { specifier: string; version: string }
  >,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [packageName, packageInfo] of Object.entries(catalogData)) {
    const version = typeof packageInfo === "string"
      ? packageInfo
      : packageInfo.version;
    result[packageName] = version;
  }
  return result;
}

export function parsePnpmLockForCatalogs(
  content: string,
): {
  catalog?: Record<string, string>;
  catalogs?: Record<string, Record<string, string>>;
} {
  const result = v.safeParse(PnpmLockFileSchema, content);

  if (!result.success) {
    throw new Error(
      `Invalid pnpm-lock.yaml format: ${v.flatten(result.issues)}`,
    );
  }

  const lockFile = result.output;
  let catalog: Record<string, string> | undefined;
  let catalogs: Record<string, Record<string, string>> | undefined;

  if (lockFile.catalogs) {
    catalogs = {};
    for (
      const [catalogName, catalogData] of Object.entries(lockFile.catalogs)
    ) {
      if (catalogName === "default") {
        catalog = extractCatalogVersions(catalogData);
      } else {
        catalogs[catalogName] = extractCatalogVersions(catalogData);
      }
    }
  }

  return { catalog, catalogs };
}

export function parsePnpmLock(content: string): {
  versions: Map<string, string>;
  importers: Map<string, Map<string, string>>;
} {
  const versions = new Map<string, string>();
  const importers = new Map<string, Map<string, string>>();

  const result = v.safeParse(PnpmLockFileSchema, content);

  if (!result.success) {
    throw new Error(
      `Invalid pnpm-lock.yaml format: ${v.flatten(result.issues)}`,
    );
  }

  const lockFile = result.output;

  // Build catalog lookup map
  const catalogVersions = new Map<string, string>();
  if (lockFile.catalogs) {
    for (const [catalogName, catalog] of Object.entries(lockFile.catalogs)) {
      for (const [packageName, packageInfo] of Object.entries(catalog)) {
        const version = typeof packageInfo === "string"
          ? packageInfo
          : packageInfo.version;
        const catalogKey = catalogName === "default"
          ? packageName
          : `${catalogName}:${packageName}`;
        catalogVersions.set(catalogKey, version);
      }
    }
  }

  // Handle root dependencies
  const processDeps = (
    deps?: Record<string, { version: string } | string>,
    importerPath?: string,
  ) => {
    if (!deps) return;
    for (const [name, value] of Object.entries(deps)) {
      const version = typeof value === "string"
        ? value.replace(/^[^0-9]*/, "") // Remove prefix like "^", "~", etc.
        : value.version;
      if (
        version && !version.startsWith("link:") && !version.startsWith("file:")
      ) {
        // Extract clean version number
        // Handle JSR packages like "@jsr/ryu__enogu@0.6.2"
        let cleanVersion = version;
        const lastAtIndex = version.lastIndexOf("@");
        if (lastAtIndex > 0 && version.startsWith("@")) {
          // For scoped packages like "@jsr/ryu__enogu@0.6.2", extract version after last @
          cleanVersion = version.substring(lastAtIndex + 1);
        }
        cleanVersion = cleanVersion.split("_")[0].split("(")[0];

        // Store in global versions map
        versions.set(name, cleanVersion);

        // Also store in importer-specific map if importerPath is provided
        if (importerPath !== undefined) {
          if (!importers.has(importerPath)) {
            importers.set(importerPath, new Map());
          }
          importers.get(importerPath)!.set(name, cleanVersion);
        }
      }
    }
  };

  // Process importers (for monorepos)
  if (lockFile.importers) {
    for (const [importerPath, importer] of Object.entries(lockFile.importers)) {
      processDeps(
        importer.dependencies as Record<string, { version: string } | string>,
        importerPath,
      );
      processDeps(
        importer.devDependencies as Record<
          string,
          { version: string } | string
        >,
        importerPath,
      );
      processDeps(
        importer.optionalDependencies as Record<
          string,
          { version: string } | string
        >,
        importerPath,
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

  // Add catalog versions to the main versions map
  for (const [key, version] of catalogVersions) {
    versions.set(`catalog:${key}`, version);
  }

  return { versions, importers };
}

export function resolveCatalogVersion(
  catalogRef: string,
  catalogVersions: Map<string, string>,
): string | undefined {
  // catalogRef can be:
  // - "catalog:" (default catalog)
  // - "catalog:name" (named catalog)

  if (catalogRef === "catalog:") {
    // This is handled by package-specific resolution in main.ts
    return undefined;
  }

  if (catalogRef.startsWith("catalog:")) {
    const catalogName = catalogRef.slice(8); // Remove "catalog:" prefix
    return catalogVersions.get(catalogName);
  }

  return undefined;
}
