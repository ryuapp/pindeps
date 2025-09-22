#!/usr/bin/env node

import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { styleText } from "node:util";
import process from "node:process";
import { parseNpmLock } from "./npm.ts";
import { parseYarnLock } from "./yarn.ts";
import { parsePnpmLock } from "./pnpm.ts";
import { parseBunLock } from "./bun.ts";
import { parseDenoLock } from "./deno.ts";
import {
  DEPENDENCY_TYPES,
  type PackageJson,
  parsePackageJson,
} from "./package-json.ts";
import { join } from "node:path";

function detectPackageManager():
  | "npm"
  | "yarn"
  | "pnpm"
  | "bun"
  | "deno"
  | null {
  if (existsSync("deno.lock")) return "deno";
  if (existsSync("bun.lock")) return "bun";
  if (existsSync("pnpm-lock.yaml")) return "pnpm";
  if (existsSync("yarn.lock")) return "yarn";
  if (existsSync("package-lock.json")) return "npm";
  return null;
}

function getLockFileName(): string | null {
  if (existsSync("deno.lock")) return "deno.lock";
  if (existsSync("bun.lock")) return "bun.lock";
  if (existsSync("pnpm-lock.yaml")) return "pnpm-lock.yaml";
  if (existsSync("yarn.lock")) return "yarn.lock";
  if (existsSync("package-lock.json")) return "package-lock.json";
  return null;
}

function getLockedVersions(): Map<string, string> {
  const packageManager = detectPackageManager();

  switch (packageManager) {
    case "deno":
      if (existsSync("deno.lock")) {
        const content = readFileSync("deno.lock", "utf8");
        return parseDenoLock(content);
      }
      break;
    case "bun":
      if (existsSync("bun.lock")) {
        const content = readFileSync("bun.lock", "utf8");
        return parseBunLock(content);
      }
      break;
    case "yarn":
      if (existsSync("yarn.lock")) {
        const content = readFileSync("yarn.lock", "utf8");
        return parseYarnLock(content);
      }
      break;
    case "npm":
      if (existsSync("package-lock.json")) {
        const content = readFileSync("package-lock.json", "utf8");
        return parseNpmLock(content);
      }
      break;
    case "pnpm":
      if (existsSync("pnpm-lock.yaml")) {
        const content = readFileSync("pnpm-lock.yaml", "utf8");
        return parsePnpmLock(content);
      }
      break;
  }

  return new Map();
}

function shouldPin(version: string): boolean {
  // Check if version uses range operators or partial versions
  return version.startsWith("^") ||
    version.startsWith("~") ||
    version.startsWith(">") ||
    version.startsWith("<") ||
    version.startsWith(">=") ||
    version.startsWith("<=") ||
    version.includes(" - ") ||
    version.includes(" || ") ||
    version === "*" ||
    version === "latest" ||
    !version.includes(".") || // Single number versions like "2" or "3"
    version.split(".").length < 3; // Partial versions like "2.1" or "1.0"
}

function findPackageJsonFiles(): string[] {
  const packageFiles = ["package.json"];

  // Look for workspace package.json files
  const rootPackageJson = "package.json";
  if (existsSync(rootPackageJson)) {
    const content = readFileSync(rootPackageJson, "utf8");
    const rootPkg = parsePackageJson(content);

    if (rootPkg.workspaces) {
      const workspaces = Array.isArray(rootPkg.workspaces)
        ? rootPkg.workspaces
        : rootPkg.workspaces.packages || [];

      for (const workspace of workspaces) {
        // Simple glob pattern matching for common patterns like "packages/*"
        if (workspace.endsWith("/*")) {
          const dir = workspace.slice(0, -2);
          if (existsSync(dir)) {
            try {
              const entries = readdirSync(dir);
              for (const entry of entries) {
                const entryPath = join(dir, entry);
                const packageJsonPath = join(entryPath, "package.json");
                if (
                  statSync(entryPath).isDirectory() &&
                  existsSync(packageJsonPath)
                ) {
                  packageFiles.push(packageJsonPath);
                }
              }
            } catch {
              // Ignore errors reading directory
            }
          }
        } else {
          // Direct workspace path
          const packageJsonPath = join(workspace, "package.json");
          if (existsSync(packageJsonPath)) {
            packageFiles.push(packageJsonPath);
          }
        }
      }
    }
  }

  return packageFiles;
}

function pinDependencies(
  deps: Record<string, string>,
  lockedVersions: Map<string, string>,
  maxNameLength: number,
  maxVersionLength: number,
): Record<string, string> {
  const pinned: Record<string, string> = {};

  for (const [name, version] of Object.entries(deps)) {
    if (shouldPin(version)) {
      const lockedVersion = lockedVersions.get(name);
      if (lockedVersion) {
        pinned[name] = lockedVersion;
        const paddedName = name.padEnd(maxNameLength);
        const paddedVersion = version.padEnd(maxVersionLength);
        const oldVersion = styleText("gray", paddedVersion);
        const newVersion = styleText("green", lockedVersion);
        console.log(`   ${paddedName}: ${oldVersion} -> ${newVersion}`);
      } else {
        pinned[name] = version;
        console.log(`⚠️ ${name}: no locked version found`);
      }
    } else {
      pinned[name] = version;
    }
  }

  return pinned;
}

function main() {
  try {
    const packageJsonFiles = findPackageJsonFiles();

    if (packageJsonFiles.length === 0) {
      console.error("❌ Error: package.json not found");
      process.exit(1);
    }

    // Get locked versions from lock file
    const lockedVersions = getLockedVersions();

    if (lockedVersions.size === 0) {
      console.log(
        "⚠️  Warning: No lock file found or unable to parse lock file\n",
      );
    }

    // Calculate max package name and version length across all package.json files for alignment
    let maxNameLength = 0;
    let maxVersionLength = 0;
    const packageJsonContents: Array<{ path: string; json: PackageJson }> = [];

    for (const packageJsonPath of packageJsonFiles) {
      const content = readFileSync(packageJsonPath, "utf8");
      const packageJson = parsePackageJson(content);
      packageJsonContents.push({ path: packageJsonPath, json: packageJson });

      for (const depType of DEPENDENCY_TYPES) {
        if (packageJson[depType]) {
          const deps = packageJson[depType] as Record<string, string>;
          for (const [name, version] of Object.entries(deps)) {
            maxNameLength = Math.max(maxNameLength, name.length);
            if (shouldPin(version)) {
              maxVersionLength = Math.max(maxVersionLength, version.length);
            }
          }
        }
      }
    }

    // Check if there will be any changes across all package.json files
    let willHaveAnyChanges = false;
    for (const { json: packageJson } of packageJsonContents) {
      for (const depType of DEPENDENCY_TYPES) {
        if (packageJson[depType]) {
          const deps = packageJson[depType] as Record<string, string>;
          const hasChanges = Object.entries(deps).some(([name, version]) => {
            return shouldPin(version) && lockedVersions.has(name);
          });
          if (hasChanges) {
            willHaveAnyChanges = true;
            break;
          }
        }
      }
      if (willHaveAnyChanges) break;
    }

    if (willHaveAnyChanges) {
      const lockFileName = getLockFileName();
      console.log(
        `📦 Found ${lockedVersions.size} dependencies in ${lockFileName}`,
      );
    }

    let totalChanges = false;

    // Process each package.json file
    for (
      const { path: packageJsonPath, json: packageJson } of packageJsonContents
    ) {
      let hasChanges = false;
      let hasOutput = false;

      // Process all dependency types

      for (const depType of DEPENDENCY_TYPES) {
        if (packageJson[depType]) {
          const originalDeps = packageJson[depType] as Record<string, string>;

          // Check if any dependencies will be pinned before processing
          const willHaveChanges = Object.entries(originalDeps).some(
            ([name, version]) => {
              return shouldPin(version) && lockedVersions.has(name);
            },
          );

          if (willHaveChanges && !hasOutput) {
            console.log(`\n${packageJsonPath}:`);
            hasOutput = true;
          }

          const pinned = pinDependencies(
            originalDeps,
            lockedVersions,
            maxNameLength,
            maxVersionLength,
          );

          if (JSON.stringify(pinned) !== JSON.stringify(originalDeps)) {
            (packageJson as Record<string, Record<string, string>>)[depType] =
              pinned;
            hasChanges = true;
          }
        }
      }

      if (hasChanges) {
        writeFileSync(
          packageJsonPath,
          JSON.stringify(packageJson, null, 2) + "\n",
        );
        totalChanges = true;
      }
    }

    if (totalChanges) {
      console.log("\n📌 Dependencies pinned successfully!");
      const lockFileName = getLockFileName();
      const packageManager = detectPackageManager();
      const installCommand = packageManager === "yarn"
        ? "yarn"
        : `${packageManager} install`;
      console.log(
        `   Run \`${installCommand}\` to update ${lockFileName}.`,
      );
    } else {
      console.log("📌 All dependencies are already pinned!");
    }
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
