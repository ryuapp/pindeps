import { readFileSync } from "node:fs";
import { parse as parseYaml } from "@std/yaml";
import * as v from "@valibot/valibot";

const YarnLockFileSchema = v.record(
  v.string(),
  v.union([
    v.object({
      version: v.optional(v.string()),
      resolution: v.optional(v.string()),
      dependencies: v.optional(v.record(v.string(), v.string())),
      checksum: v.optional(v.string()),
      languageName: v.optional(v.string()),
      linkType: v.optional(v.string()),
      bin: v.optional(v.union([v.record(v.string(), v.string()), v.boolean()])),
    }),
    v.object({
      version: v.number(),
      cacheKey: v.string(),
    }),
    v.undefined_(),
  ]),
);

export function parseYarnLock(lockFilePath: string): Map<string, string> {
  const versions = new Map<string, string>();
  const content = readFileSync(lockFilePath, "utf8");
  const parsed = parseYaml(content);

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid yarn.lock file");
  }

  const result = v.safeParse(YarnLockFileSchema, parsed);

  if (!result.success) {
    throw new Error(`Invalid yarn.lock format: ${v.flatten(result.issues)}`);
  }

  const lockFile = result.output;

  for (const [key, packageInfo] of Object.entries(lockFile)) {
    // Skip metadata and undefined entries
    if (key === "__metadata" || !packageInfo) {
      continue;
    }

    // Check if it's a package info with version (not metadata)
    if ("version" in packageInfo && typeof packageInfo.version === "string") {
      // Extract package name from key
      const packageName = extractPackageNameFromYarnKey(key);
      if (packageName) {
        versions.set(packageName, packageInfo.version);
      }
    }
  }

  return versions;
}

function extractPackageNameFromYarnKey(key: string): string | null {
  // Skip workspace entries as they are local packages
  if (key.includes("@workspace:")) {
    return null;
  }

  // Handle scoped packages: "@scope/package@npm:^version"
  let match = key.match(/^(@[^/]+\/[^@]+)@npm:/);
  if (match) {
    return match[1];
  }

  // Handle regular packages: "package@npm:^version"
  match = key.match(/^([^@]+)@npm:/);
  if (match) {
    return match[1];
  }

  // Handle legacy yarn v1 format: "package@^version"
  match = key.match(/^([^@]+)@[^@]+$/);
  if (match) {
    return match[1];
  }

  // Handle scoped packages in legacy format: "@scope/package@^version"
  match = key.match(/^(@[^/]+\/[^@]+)@[^@]+$/);
  if (match) {
    return match[1];
  }

  return null;
}
