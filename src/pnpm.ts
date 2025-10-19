import * as v from "@valibot/valibot";
import { yamlSchema } from "./schema.ts";
import { shouldPinVersion } from "./utils.ts";

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
        catalog = {};
        for (const [packageName, packageInfo] of Object.entries(catalogData)) {
          const version = typeof packageInfo === "string"
            ? packageInfo
            : packageInfo.version;
          catalog[packageName] = version;
        }
      } else {
        catalogs[catalogName] = {};
        for (const [packageName, packageInfo] of Object.entries(catalogData)) {
          const version = typeof packageInfo === "string"
            ? packageInfo
            : packageInfo.version;
          catalogs[catalogName][packageName] = version;
        }
      }
    }
  }

  return { catalog, catalogs };
}

export function parsePnpmLock(content: string): Map<string, string> {
  const versions = new Map<string, string>();

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

  // Add catalog versions to the main versions map
  for (const [key, version] of catalogVersions) {
    versions.set(`catalog:${key}`, version);
  }

  return versions;
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

export const PnpmWorkspaceSchema = v.pipe(
  v.string(),
  yamlSchema,
  v.object({
    packages: v.optional(v.array(v.string())),
    catalog: v.optional(v.record(v.string(), v.string())),
    catalogs: v.optional(
      v.record(
        v.string(),
        v.record(v.string(), v.string()),
      ),
    ),
  }),
);

export function parsePnpmWorkspace(
  content: string,
): v.InferOutput<typeof PnpmWorkspaceSchema> {
  const result = v.safeParse(PnpmWorkspaceSchema, content);

  if (!result.success) {
    throw new Error(
      `Invalid pnpm-workspace.yaml format: ${v.flatten(result.issues)}`,
    );
  }

  return result.output;
}

export function pinPnpmWorkspaceCatalogs(
  workspaceContent: string,
  lockedVersions: Map<string, string>,
  lockData?: {
    catalog?: Record<string, string>;
    catalogs?: Record<string, Record<string, string>>;
  },
): {
  content: string;
  hasChanges: boolean;
  changes: Array<{ name: string; oldVersion: string; newVersion: string }>;
} {
  const workspace = parsePnpmWorkspace(workspaceContent);
  let hasChanges = false;
  let updatedContent = workspaceContent;
  const changes: Array<
    { name: string; oldVersion: string; newVersion: string }
  > = [];

  // Get catalog and catalogs from lock data
  const lockCatalog = lockData?.catalog;
  const lockCatalogs = lockData?.catalogs;

  // Pin default catalog
  if (workspace.catalog) {
    for (const [packageName, version] of Object.entries(workspace.catalog)) {
      if (shouldPinVersion(version)) {
        // Try to get version from lockfile catalog first, then fall back to regular locked versions
        const lockedVersion = lockCatalog?.[packageName] ||
          lockedVersions.get(packageName);
        if (lockedVersion && lockedVersion !== version) {
          // Replace the version in the content
          const escapedName = packageName.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&",
          );
          const escapedOldVersion = version.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&",
          );
          const pattern = new RegExp(
            `(\\s+${escapedName}:\\s*["']?)${escapedOldVersion}(["']?)`,
            "g",
          );
          updatedContent = updatedContent.replace(
            pattern,
            `$1${lockedVersion}$2`,
          );
          hasChanges = true;
          changes.push({
            name: `catalog.${packageName}`,
            oldVersion: version,
            newVersion: lockedVersion,
          });
        }
      }
    }
  }

  // Pin named catalogs
  if (workspace.catalogs) {
    for (const [catalogName, catalog] of Object.entries(workspace.catalogs)) {
      for (const [packageName, version] of Object.entries(catalog)) {
        if (shouldPinVersion(version)) {
          // Try to get version from lockfile catalog first, then fall back to regular locked versions
          const lockedVersion = lockCatalogs?.[catalogName]?.[packageName] ||
            lockedVersions.get(packageName);
          if (lockedVersion && lockedVersion !== version) {
            // Replace the version in the content
            const escapedCatalogName = catalogName.replace(
              /[.*+?^${}()|[\]\\]/g,
              "\\$&",
            );
            const escapedPackageName = packageName.replace(
              /[.*+?^${}()|[\]\\]/g,
              "\\$&",
            );
            const escapedOldVersion = version.replace(
              /[.*+?^${}()|[\]\\]/g,
              "\\$&",
            );

            // Look for the pattern under the specific catalog
            const catalogSectionRegex = new RegExp(
              `(\\s+${escapedCatalogName}:[\\s\\S]*?\\s+${escapedPackageName}:\\s*["']?)${escapedOldVersion}(["']?)`,
              "g",
            );
            updatedContent = updatedContent.replace(
              catalogSectionRegex,
              `$1${lockedVersion}$2`,
            );
            hasChanges = true;
            changes.push({
              name: `catalogs.${catalogName}.${packageName}`,
              oldVersion: version,
              newVersion: lockedVersion,
            });
          }
        }
      }
    }
  }

  return { content: updatedContent, hasChanges, changes };
}
