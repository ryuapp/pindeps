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

type PackageManager = "npm" | "yarn" | "pnpm" | "bun" | "deno";
interface LockFile {
  path: string;
  type: PackageManager;
}

function getLockFiles(): LockFile[] {
  const lockFiles: LockFile[] = [];

  if (existsSync("deno.lock")) {
    lockFiles.push({ path: "deno.lock", type: "deno" });
  }
  if (existsSync("bun.lock")) {
    lockFiles.push({ path: "bun.lock", type: "bun" });
  }
  if (existsSync("pnpm-lock.yaml")) {
    lockFiles.push({ path: "pnpm-lock.yaml", type: "pnpm" });
  }
  if (existsSync("yarn.lock")) {
    lockFiles.push({ path: "yarn.lock", type: "yarn" });
  }
  if (existsSync("package-lock.json")) {
    lockFiles.push({ path: "package-lock.json", type: "npm" });
  }

  return lockFiles;
}

function getPackageManagerName(
  lockFile: LockFile,
): PackageManager | null {
  return lockFile ? lockFile.type : null;
}

function getLockFileName(lockFile: LockFile): string | null {
  return lockFile ? lockFile.path : null;
}

function getLockedVersion(lockFile: LockFile): Map<string, string> {
  if (!lockFile) {
    return new Map();
  }

  const content = readFileSync(lockFile.path, "utf8");

  switch (lockFile.type) {
    case "deno":
      return parseDenoLock(content);
    case "bun":
      return parseBunLock(content);
    case "yarn":
      return parseYarnLock(content);
    case "npm":
      return parseNpmLock(content);
    case "pnpm":
      return parsePnpmLock(content);
    default:
      return new Map();
  }
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

    // TODO: Error handling for multiple lock files
    const lockFile = getLockFiles().at(0);
    if (!lockFile) {
      console.error(
        "❌ Error: No lock file found (deno.lock, bun.lock, pnpm-lock.yaml, yarn.lock, or package-lock.json)",
      );
      process.exit(1);
    }

    // Get locked versions from lock file
    const lockedVersions = getLockedVersion(lockFile);
    if (lockedVersions.size === 0) {
      console.log(
        "❌ Error: No lock file found or unable to parse lock file",
      );
      process.exit(1);
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
      const lockFileName = getLockFileName(lockFile);
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
      const lockFileName = getLockFileName(lockFile);
      const packageManager = getPackageManagerName(lockFile);
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
