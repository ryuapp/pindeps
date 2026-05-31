import type { PackageJson } from "./package-json.ts";
import type { DenoJson } from "./deno-json.ts";
import { DEPENDENCY_TYPES } from "./package-json.ts";
import { shouldPinVersion } from "./utils.ts";

export interface DenoCatalogVersions {
  catalog: Map<string, string>;
  catalogs: Map<string, Map<string, string>>;
}

export interface DenoCatalogChange {
  name: string;
  oldVersion: string;
  newVersion: string;
}

export function getDenoCatalogVersions(
  packageJsonContents: Array<{ path: string; json: PackageJson }>,
  getVersionsForPackage: (path: string) => Map<string, string>,
  dependencyTypes: readonly string[] = DEPENDENCY_TYPES,
): DenoCatalogVersions {
  const catalog = new Map<string, string>();
  const catalogs = new Map<string, Map<string, string>>();

  for (const { path, json: packageJson } of packageJsonContents) {
    const versionsToUse = getVersionsForPackage(path);

    for (const depType of dependencyTypes) {
      const deps = packageJson[depType] as Record<string, string> | undefined;
      if (!deps) continue;

      for (const [name, version] of Object.entries(deps)) {
        if (!version.startsWith("catalog:")) continue;

        const lockedVersion = versionsToUse.get(name);
        if (!lockedVersion) continue;

        if (version === "catalog:" || version === "catalog:default") {
          catalog.set(name, lockedVersion);
        } else {
          const catalogName = version.slice(8);
          const namedCatalog = catalogs.get(catalogName) ??
            new Map<string, string>();
          namedCatalog.set(name, lockedVersion);
          catalogs.set(catalogName, namedCatalog);
        }
      }
    }
  }

  return { catalog, catalogs };
}

export function pinDenoJsonCatalogs(
  denoJson: DenoJson,
  denoCatalogVersions: DenoCatalogVersions,
): {
  hasChanges: boolean;
  unpinnedCount: number;
  totalCount: number;
  changes: DenoCatalogChange[];
} {
  let hasChanges = false;
  let unpinnedCount = 0;
  let totalCount = 0;
  const changes: DenoCatalogChange[] = [];

  if (denoJson.catalog) {
    const result = pinCatalogEntries(
      denoJson.catalog,
      denoCatalogVersions.catalog,
    );
    denoJson.catalog = result.pinned;
    hasChanges = hasChanges || result.hasChanges;
    unpinnedCount += result.unpinnedCount;
    totalCount += result.totalCount;
    changes.push(...result.changes);
  }

  if (denoJson.catalogs) {
    for (const [catalogName, catalog] of Object.entries(denoJson.catalogs)) {
      const result = pinCatalogEntries(
        catalog,
        denoCatalogVersions.catalogs.get(catalogName),
      );
      denoJson.catalogs[catalogName] = result.pinned;
      hasChanges = hasChanges || result.hasChanges;
      unpinnedCount += result.unpinnedCount;
      totalCount += result.totalCount;
      changes.push(...result.changes);
    }
  }

  return { hasChanges, unpinnedCount, totalCount, changes };
}

function pinCatalogEntries(
  deps: Record<string, string>,
  catalogVersions: Map<string, string> | undefined,
): {
  pinned: Record<string, string>;
  hasChanges: boolean;
  unpinnedCount: number;
  totalCount: number;
  changes: DenoCatalogChange[];
} {
  const pinned: Record<string, string> = {};
  let hasChanges = false;
  let unpinnedCount = 0;
  let totalCount = 0;
  const changes: DenoCatalogChange[] = [];

  for (const [name, version] of Object.entries(deps)) {
    totalCount++;

    if (!shouldPinVersion(version)) {
      pinned[name] = version;
      continue;
    }

    const lockedVersion = catalogVersions?.get(name);

    if (!lockedVersion) {
      pinned[name] = version;
      continue;
    }

    pinned[name] = lockedVersion;
    hasChanges = hasChanges || lockedVersion !== version;
    unpinnedCount++;
    changes.push({ name, oldVersion: version, newVersion: lockedVersion });
  }

  return { pinned, hasChanges, unpinnedCount, totalCount, changes };
}
