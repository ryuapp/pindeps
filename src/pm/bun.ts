import * as v from "@valibot/valibot";
import { jsoncSchema } from "../schema.ts";

const BunLockFileSchema = v.pipe(
  v.string(),
  jsoncSchema,
  v.object({
    lockfileVersion: v.number(),
    workspaces: v.optional(
      v.record(
        v.string(),
        v.object({
          name: v.optional(v.string()),
          dependencies: v.optional(v.record(v.string(), v.string())),
          devDependencies: v.optional(v.record(v.string(), v.string())),
        }),
      ),
    ),
    packages: v.optional(
      v.record(v.string(), v.array(v.union([v.string(), v.object({})]))),
    ),
  }),
);

export function parseBunLock(content: string): {
  versions: Map<string, string>;
  importers: Map<string, Map<string, string>>;
} {
  const versions = new Map<string, string>();
  const importers = new Map<string, Map<string, string>>();

  const result = v.safeParse(BunLockFileSchema, content);
  if (!result.success) {
    throw new Error(`Invalid bun.lock format: ${v.flatten(result.issues)}`);
  }

  const lockFile = result.output;

  // Build workspace name → path mapping from workspaces field
  const workspaceNameToPath = new Map<string, string>();
  if (lockFile.workspaces) {
    for (const [path, workspaceInfo] of Object.entries(lockFile.workspaces)) {
      if (workspaceInfo.name) {
        workspaceNameToPath.set(workspaceInfo.name, path);
      }
    }
  }

  // Parse from packages section to get exact versions
  // The packages section contains the resolved versions, not the workspace ranges
  if (lockFile.packages) {
    for (
      const [packageName, packageInfo] of Object.entries(lockFile.packages)
    ) {
      if (Array.isArray(packageInfo) && packageInfo.length > 0) {
        // First element in array is the specifier like "yaml@2.8.1"
        const specifier = String(packageInfo[0]);

        // Check if this is a workspace-specific package (e.g., "react2/react")
        // But skip scoped packages like "@scope/name"
        const workspaceMatch = packageName.match(/^([^/@]+)\/(.+)$/);
        if (workspaceMatch && !packageName.startsWith("@")) {
          const [, workspaceName, pkgName] = workspaceMatch;
          // Look up workspace path from name
          const workspacePath = workspaceNameToPath.get(workspaceName);
          if (!workspacePath) continue; // Skip if workspace not found

          // Extract version from specifier
          let match = specifier.match(/^(@[^/]+\/[^@]+)@([^@]+)$/);
          if (match) {
            const [, , version] = match;
            if (!importers.has(workspacePath)) {
              importers.set(workspacePath, new Map());
            }
            importers.get(workspacePath)!.set(pkgName, version);
          } else {
            match = specifier.match(/^([^@]+)@([^@]+)$/);
            if (match) {
              const [, , version] = match;
              if (!importers.has(workspacePath)) {
                importers.set(workspacePath, new Map());
              }
              importers.get(workspacePath)!.set(pkgName, version);
            }
          }
          continue;
        }

        // Regular package (not workspace-specific)
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

  return { versions, importers };
}
