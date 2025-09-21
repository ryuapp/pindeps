import * as v from "@valibot/valibot";
import { jsoncSchema } from "./schema.ts";

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

export function parseBunLock(content: string): Map<string, string> {
  const versions = new Map<string, string>();

  const result = v.safeParse(BunLockFileSchema, content);
  if (!result.success) {
    throw new Error(`Invalid bun.lock format: ${v.flatten(result.issues)}`);
  }

  const lockFile = result.output;

  // Parse from packages section to get exact versions
  // The packages section contains the resolved versions, not the workspace ranges
  if (lockFile.packages) {
    for (
      const [packageName, packageInfo] of Object.entries(lockFile.packages)
    ) {
      if (Array.isArray(packageInfo) && packageInfo.length > 0) {
        // First element in array is the specifier like "yaml@2.8.1"
        const specifier = String(packageInfo[0]);

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

  return versions;
}
