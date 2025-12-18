import * as v from "@valibot/valibot";
import { regex } from "arkregex";

const packageSpecPattern = regex("^(.+?)@[^@]+$");
const jsrResolvedPattern = regex("^jsr:(.+?)@([^@]+)$");

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
        members: v.optional(v.record(v.string(), v.unknown())),
      }),
    ),
    remote: v.optional(v.record(v.string(), v.string())),
  }),
);

export function parseDenoLock(content: string): {
  versions: Map<string, string>;
  importers: Map<string, Map<string, string>>;
} {
  const versions = new Map<string, string>();
  const importers = new Map<string, Map<string, string>>();

  const result = v.safeParse(DenoLockFileSchema, content);
  if (!result.success) {
    throw new Error(`Invalid deno.lock format: ${v.flatten(result.issues)}`);
  }

  const lockFile = result.output;

  // Build a map from specifier to resolved version
  const specifierMap = new Map<string, string>();
  if (lockFile.specifiers) {
    for (const [spec, resolved] of Object.entries(lockFile.specifiers)) {
      specifierMap.set(spec, resolved);
    }
  }

  // Helper function to extract package name and version from specifier
  const extractPackageInfo = (
    spec: string,
  ): { name: string; version: string } | null => {
    const resolved = specifierMap.get(spec);
    if (!resolved) return null;

    if (spec.startsWith("npm:")) {
      const specPart = spec.replace("npm:", "");
      const specMatch = specPart.match(packageSpecPattern);
      if (specMatch) {
        const [, packageName] = specMatch;
        if (!resolved.includes(":")) {
          const cleanVersion = resolved.split("_")[0];
          return { name: packageName, version: cleanVersion };
        }
      }
    } else if (spec.startsWith("jsr:")) {
      const specPart = spec.replace("jsr:", "");
      const specMatch = specPart.match(packageSpecPattern);
      if (specMatch) {
        const [, packageName] = specMatch;
        if (resolved.startsWith("jsr:")) {
          const resolvedMatch = resolved.match(jsrResolvedPattern);
          if (resolvedMatch) {
            const [, , version] = resolvedMatch;
            return { name: packageName, version };
          }
        } else if (!resolved.includes(":")) {
          return { name: packageName, version: resolved };
        }
      }
    }
    return null;
  };

  // Process workspace members
  if (lockFile.workspace?.members) {
    for (
      const [memberPath, member] of Object.entries(lockFile.workspace.members)
    ) {
      const memberMap = new Map<string, string>();

      // Type guard: member must be an object
      if (typeof member !== "object" || member === null) continue;

      // Handle package.json dependencies
      if ("packageJson" in member) {
        const pkgJsonMember = member as {
          packageJson?: {
            dependencies?: string[];
            devDependencies?: string[];
          };
        };
        if (pkgJsonMember.packageJson?.dependencies) {
          for (const spec of pkgJsonMember.packageJson.dependencies) {
            const info = extractPackageInfo(spec);
            if (info) {
              memberMap.set(info.name, info.version);
            }
          }
        }
        if (pkgJsonMember.packageJson?.devDependencies) {
          for (const spec of pkgJsonMember.packageJson.devDependencies) {
            const info = extractPackageInfo(spec);
            if (info) {
              memberMap.set(info.name, info.version);
            }
          }
        }
      }

      // Handle deno.json dependencies (imports) - check independently
      if ("dependencies" in member && !("packageJson" in member)) {
        const denoJsonMember = member as { dependencies?: string[] };
        if (denoJsonMember.dependencies) {
          for (const spec of denoJsonMember.dependencies) {
            const info = extractPackageInfo(spec);
            if (info) {
              memberMap.set(info.name, info.version);
            }
          }
        }
      }

      if (memberMap.size > 0) {
        importers.set(memberPath, memberMap);
      }
    }
  }

  // Also populate global versions map from all specifiers
  if (lockFile.specifiers) {
    for (const [spec, _resolved] of Object.entries(lockFile.specifiers)) {
      const info = extractPackageInfo(spec);
      if (info) {
        versions.set(info.name, info.version);
      }
    }
  }

  return { versions, importers };
}
