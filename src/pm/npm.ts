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

export function parseNpmLock(content: string): Map<string, string> {
  const versions = new Map<string, string>();

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
      // Use 'name' property if available (for aliased packages like npm:@jsr/...)
      // Otherwise extract from path
      const packageName = info.name || path.replace(/^node_modules\//, "");
      if (info.version) {
        versions.set(packageName, info.version);
      }
    }
  }

  // npm v6 and below (lockfileVersion 1)
  if (lockFile.dependencies) {
    for (const [name, info] of Object.entries(lockFile.dependencies)) {
      versions.set(name, info.version);
    }
  }

  return versions;
}
