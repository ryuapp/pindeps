import * as v from "@valibot/valibot";

const NpmLockFileSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({
    lockfileVersion: v.optional(v.number()),
    dependencies: v.optional(
      v.record(
        v.string(),
        v.object({
          version: v.string(),
        }),
      ),
    ),
    packages: v.optional(
      v.record(
        v.string(),
        v.object({
          name: v.optional(v.string()),
          version: v.optional(v.string()),
          resolved: v.optional(v.string()),
          link: v.optional(v.boolean()),
        }),
      ),
    ),
  }),
);

export function parseNpmLock(
  content: string,
): {
  versions: Map<string, string>;
  importers?: Map<string, Map<string, string>>;
} {
  const versions = new Map<string, string>();
  const importers = new Map<string, Map<string, string>>();

  const result = v.safeParse(NpmLockFileSchema, content);
  if (!result.success) {
    throw new Error(
      `Invalid package-lock.json format: ${v.flatten(result.issues)}`,
    );
  }

  const lockFile = result.output;

  // npm v7+ (lockfileVersion 2 or 3)
  if (lockFile.packages) {
    for (const [path, info] of Object.entries(lockFile.packages)) {
      if (path === "") continue; // Skip root package
      if (info.link) continue; // Skip workspace links

      if (!info.version) continue;

      // Check if this is a workspace-specific package
      if (path.includes("/node_modules/")) {
        const nodeModulesIndex = path.indexOf("/node_modules/");
        const workspacePath = path.substring(0, nodeModulesIndex);
        const packageName = path.substring(nodeModulesIndex + 14); // "/node_modules/".length

        if (!importers.has(workspacePath)) {
          importers.set(workspacePath, new Map());
        }
        importers.get(workspacePath)!.set(packageName, info.version);
        continue;
      }

      // Global package
      // Use 'name' property if available (for aliased packages like npm:@jsr/...)
      // Otherwise extract from path
      const packageName = info.name || path.replace(/^node_modules\//, "");
      versions.set(packageName, info.version);
    }
  }

  // npm v6 and below (lockfileVersion 1)
  if (lockFile.dependencies) {
    for (const [name, info] of Object.entries(lockFile.dependencies)) {
      versions.set(name, info.version);
    }
  }

  return { versions, importers: importers.size > 0 ? importers : undefined };
}
