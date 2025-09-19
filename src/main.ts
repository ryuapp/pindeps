#!/usr/bin/env node

import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { styleText } from "node:util";
import process from "node:process";
import { parseNpmLock } from "./npm.ts";
import { parseYarnLock } from "./yarn.ts";
import { parsePnpmLock } from "./pnpm.ts";
import { parseBunLock } from "./bun.ts";
import { parseDenoLock } from "./deno.ts";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  overrides?: Record<string, string>;
  resolutions?: Record<string, string>;
}

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
        return parseDenoLock("deno.lock");
      }
      break;
    case "bun":
      if (existsSync("bun.lock")) {
        return parseBunLock("bun.lock");
      }
      break;
    case "yarn":
      if (existsSync("yarn.lock")) {
        return parseYarnLock("yarn.lock");
      }
      break;
    case "npm":
      if (existsSync("package-lock.json")) {
        return parseNpmLock("package-lock.json");
      }
      break;
    case "pnpm":
      if (existsSync("pnpm-lock.yaml")) {
        return parsePnpmLock("pnpm-lock.yaml");
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

function findPackageJsonFiles(): string[] {
  const packageFiles = ["package.json"];

  // Look for workspace package.json files
  const rootPackageJson = "package.json";
  if (existsSync(rootPackageJson)) {
    const rootPkg = JSON.parse(readFileSync(rootPackageJson, "utf8"));

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

function main() {
  try {
    const packageJsonFiles = findPackageJsonFiles();

    if (packageJsonFiles.length === 0) {
      console.error("❌ Error: package.json not found");
      process.exit(1);
    }

    // Get locked versions from lock file
    console.log("🔍 Analyzing lock file...");
    const lockedVersions = getLockedVersions();

    if (lockedVersions.size === 0) {
      console.log(
        "⚠️  Warning: No lock file found or unable to parse lock file",
      );
      console.log(
        "   Please run 'npm/yarn/pnpm/bun install' or 'deno cache' first",
      );
    } else {
      const lockFileName = getLockFileName();
      console.log(
        `📦 Found ${lockedVersions.size} dependencies in ${lockFileName}`,
      );
    }

    // Calculate max package name and version length across all package.json files for alignment
    let maxNameLength = 0;
    let maxVersionLength = 0;
    const packageJsonContents: Array<{ path: string; json: PackageJson }> = [];

    for (const packageJsonPath of packageJsonFiles) {
      const packageJson: PackageJson = JSON.parse(
        readFileSync(packageJsonPath, "utf8"),
      );
      packageJsonContents.push({ path: packageJsonPath, json: packageJson });

      const depTypes: Array<keyof PackageJson> = [
        "dependencies",
        "devDependencies",
        "peerDependencies",
        "optionalDependencies",
        "overrides",
        "resolutions",
      ];

      for (const depType of depTypes) {
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

    let totalChanges = false;

    // Process each package.json file
    for (
      const { path: packageJsonPath, json: packageJson } of packageJsonContents
    ) {
      console.log(`\n${packageJsonPath}:`);

      let hasChanges = false;

      // Process all dependency types
      const depTypes: Array<keyof PackageJson> = [
        "dependencies",
        "devDependencies",
        "peerDependencies",
        "optionalDependencies",
        "overrides",
        "resolutions",
      ];

      for (const depType of depTypes) {
        if (packageJson[depType]) {
          const pinned = pinDependencies(
            packageJson[depType] as Record<string, string>,
            lockedVersions,
            maxNameLength,
            maxVersionLength,
          );

          if (JSON.stringify(pinned) !== JSON.stringify(packageJson[depType])) {
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
      console.log("\n✅ Dependencies pinned successfully!");
      console.log(
        "   Run your package manager install command to update the lock file",
      );
    } else {
      console.log("\n📌 All dependencies are already pinned!");
    }
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
