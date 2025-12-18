import * as v from "@valibot/valibot";
import { regex } from "arkregex";
import { yamlSchema } from "../schema.ts";

const workspaceResolutionPattern = regex("@workspace:(.+)$");
const scopedJsrPattern = regex("^(@[^/]+/[^@]+)@jsr:");
const regularJsrPattern = regex("^([^@]+)@jsr:");
const scopedNpmPattern = regex("^(@[^/]+/[^@]+)@npm:");
const regularNpmPattern = regex("^([^@]+)@npm:");
const regularLegacyPattern = regex("^([^@]+)@[^@]+$");
const scopedLegacyPattern = regex("^(@[^/]+/[^@]+)@[^@]+$");

const YarnLockFileSchema = v.pipe(
  v.string(),
  yamlSchema,
  v.record(
    v.string(),
    v.union([
      v.object({
        version: v.optional(v.string()),
        resolution: v.optional(v.string()),
        dependencies: v.optional(
          v.record(v.string(), v.union([v.string(), v.number()])),
        ),
        checksum: v.optional(v.string()),
        languageName: v.optional(v.string()),
        linkType: v.optional(v.string()),
        bin: v.optional(
          v.union([v.record(v.string(), v.string()), v.boolean()]),
        ),
      }),
      v.object({
        version: v.number(),
        cacheKey: v.union([v.string(), v.number()]),
      }),
      v.undefined_(),
    ]),
  ),
);

export function parseYarnLock(content: string): {
  versions: Map<string, string>;
  importers: Map<string, Map<string, string>>;
} {
  const versions = new Map<string, string>();
  const importers = new Map<string, Map<string, string>>();

  const result = v.safeParse(YarnLockFileSchema, content);
  if (!result.success) {
    throw new Error(`Invalid yarn.lock format: ${v.flatten(result.issues)}`);
  }

  const lockFile = result.output;

  // First pass: build a map of dependency ranges to resolved versions
  const rangeToVersion = new Map<string, string>();
  for (const [key, packageInfo] of Object.entries(lockFile)) {
    if (key === "__metadata" || !packageInfo) continue;

    if ("version" in packageInfo && typeof packageInfo.version === "string") {
      rangeToVersion.set(key, packageInfo.version);

      const packageName = extractPackageNameFromYarnKey(key);
      if (packageName) {
        versions.set(packageName, packageInfo.version);
      }
    }
  }

  // Second pass: process workspace entries
  for (const [key, packageInfo] of Object.entries(lockFile)) {
    if (key === "__metadata" || !packageInfo) continue;

    // Check if this is a workspace entry
    if (key.includes("@workspace:") && "resolution" in packageInfo) {
      const resolution = packageInfo.resolution;
      if (typeof resolution !== "string") continue;

      // Extract workspace path from resolution
      // e.g., "react1@workspace:packages/react1" → "packages/react1"
      const workspaceMatch = resolution.match(workspaceResolutionPattern);
      if (!workspaceMatch) continue;

      const workspacePath = workspaceMatch[1];

      // Get dependencies for this workspace
      if ("dependencies" in packageInfo && packageInfo.dependencies) {
        const deps = packageInfo.dependencies as Record<
          string,
          string | number
        >;
        const workspaceVersions = new Map<string, string>();

        for (const [depName, depRange] of Object.entries(deps)) {
          if (typeof depRange !== "string") continue;

          // Look up the resolved version for this range
          const resolvedVersion = rangeToVersion.get(`${depName}@${depRange}`);
          if (resolvedVersion) {
            workspaceVersions.set(depName, resolvedVersion);
          }
        }

        if (workspaceVersions.size > 0) {
          importers.set(workspacePath, workspaceVersions);
        }
      }
    }
  }

  return { versions, importers };
}

function extractPackageNameFromYarnKey(key: string): string | null {
  // Skip workspace entries as they are local packages
  if (key.includes("@workspace:")) {
    return null;
  }

  // Handle scoped packages: "@scope/package@jsr:^version"
  let match = key.match(scopedJsrPattern);
  if (match) {
    return match[1];
  }

  // Handle regular packages: "package@jsr:^version"
  match = key.match(regularJsrPattern);
  if (match) {
    return match[1];
  }

  // Handle scoped packages: "@scope/package@npm:^version"
  match = key.match(scopedNpmPattern);
  if (match) {
    return match[1];
  }

  // Handle regular packages: "package@npm:^version"
  match = key.match(regularNpmPattern);
  if (match) {
    return match[1];
  }

  // Handle legacy yarn v1 format: "package@^version"
  match = key.match(regularLegacyPattern);
  if (match) {
    return match[1];
  }

  // Handle scoped packages in legacy format: "@scope/package@^version"
  match = key.match(scopedLegacyPattern);
  if (match) {
    return match[1];
  }

  return null;
}
