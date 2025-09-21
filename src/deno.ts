import * as v from "@valibot/valibot";

const DenoLockFileSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({
    version: v.optional(v.string()),
    specifiers: v.optional(v.record(v.string(), v.string())),
    npm: v.optional(
      v.record(
        v.string(),
        v.object({
          integrity: v.string(),
          dependencies: v.optional(v.record(v.string(), v.string())),
          bin: v.optional(v.boolean()),
        }),
      ),
    ),
    workspace: v.optional(
      v.object({
        packageJson: v.optional(
          v.object({
            dependencies: v.optional(v.array(v.string())),
            devDependencies: v.optional(v.array(v.string())),
          }),
        ),
      }),
    ),
    remote: v.optional(v.record(v.string(), v.string())),
  }),
);

export function parseDenoLock(content: string): Map<string, string> {
  const versions = new Map<string, string>();

  const result = v.safeParse(DenoLockFileSchema, content);
  if (!result.success) {
    throw new Error(`Invalid deno.lock format: ${v.flatten(result.issues)}`);
  }

  const lockFile = result.output;

  // Parse npm packages from the npm section
  if (lockFile.npm) {
    for (const [key, _value] of Object.entries(lockFile.npm)) {
      // Format: "package-name@version" or "@scope/package@version"
      const match = key.match(/^(.+?)@([^@]+)$/);
      if (match) {
        const [, packageName, version] = match;
        versions.set(packageName, version);
      }
    }
  }

  // Also check specifiers for npm: and jsr: packages to get resolved versions
  if (lockFile.specifiers) {
    for (const [spec, resolved] of Object.entries(lockFile.specifiers)) {
      if (spec.startsWith("npm:")) {
        // Extract package name from npm specifier
        const specPart = spec.replace("npm:", "");
        const specMatch = specPart.match(/^(.+?)@[^@]+$/);
        if (specMatch) {
          const [, packageName] = specMatch;
          // The resolved value is just the version number for npm packages
          if (!resolved.includes(":")) {
            versions.set(packageName, resolved);
          }
        }
      } else if (spec.startsWith("jsr:")) {
        // Extract package name from jsr specifier
        const specPart = spec.replace("jsr:", "");
        const specMatch = specPart.match(/^(.+?)@[^@]+$/);
        if (specMatch) {
          const [, packageName] = specMatch;
          // For jsr packages, the resolved value might be "jsr:@scope/package@version"
          if (resolved.startsWith("jsr:")) {
            const resolvedMatch = resolved.match(/^jsr:(.+?)@([^@]+)$/);
            if (resolvedMatch) {
              const [, , version] = resolvedMatch;
              versions.set(packageName, version);
            }
          } else if (!resolved.includes(":")) {
            // Sometimes it's just the version number
            versions.set(packageName, resolved);
          }
        }
      }
    }
  }

  return versions;
}
