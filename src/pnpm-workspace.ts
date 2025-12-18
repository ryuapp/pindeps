import * as v from "@valibot/valibot";
import { regex } from "arkregex";
import { shouldPinVersion } from "./utils.ts";
import { yamlSchema } from "./schema.ts";

const regexSpecialChars = regex("[.*+?^${}()|[\\]\\\\]", "g");

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
            regexSpecialChars,
            "\\$&",
          );
          const escapedOldVersion = version.replace(
            regexSpecialChars,
            "\\$&",
          );
          const pattern = regex(
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
              regexSpecialChars,
              "\\$&",
            );
            const escapedPackageName = packageName.replace(
              regexSpecialChars,
              "\\$&",
            );
            const escapedOldVersion = version.replace(
              regexSpecialChars,
              "\\$&",
            );

            // Look for the pattern under the specific catalog
            const catalogSectionRegex = regex(
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
