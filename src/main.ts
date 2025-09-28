#!/usr/bin/env node

import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { gray, green } from "@ryu/enogu";
import { parseArgs } from "@std/cli";
import process from "node:process";
import { parsePnpmWorkspace, pinPnpmWorkspaceCatalogs } from "./pnpm.ts";
import {
  DEPENDENCY_TYPES,
  type PackageJson,
  parsePackageJson,
} from "./package-json.ts";
import { join } from "node:path";
import {
  getLockedVersion,
  type LockFile,
  type PackageManager,
  shouldPinVersion,
} from "./utils.ts";
import packageJson from "../package.json" with { type: "json" };

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

function findPackageManagerFiles(): string[] {
  const packageFiles = ["package.json"];

  // Check for pnpm-workspace.yaml first
  if (existsSync("pnpm-workspace.yaml")) {
    packageFiles.push("pnpm-workspace.yaml");
    const workspaceContent = readFileSync("pnpm-workspace.yaml", "utf8");
    const workspaces = parsePnpmWorkspace(workspaceContent).packages || [];

    for (const workspace of workspaces) {
      // Handle glob patterns
      if (workspace.includes("*")) {
        // Support patterns like "packages/*", "packages/**", "apps/*", etc.
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
        } else if (workspace.endsWith("/**")) {
          // Handle recursive patterns like "packages/**"
          const dir = workspace.slice(0, -3);
          if (existsSync(dir)) {
            try {
              const findPackagesRecursively = (dirPath: string) => {
                const entries = readdirSync(dirPath);
                for (const entry of entries) {
                  const entryPath = join(dirPath, entry);
                  if (statSync(entryPath).isDirectory()) {
                    const packageJsonPath = join(entryPath, "package.json");
                    if (existsSync(packageJsonPath)) {
                      packageFiles.push(packageJsonPath);
                    }
                    // Recurse into subdirectories
                    findPackagesRecursively(entryPath);
                  }
                }
              };
              findPackagesRecursively(dir);
            } catch {
              // Ignore errors reading directory
            }
          }
        }
      } else {
        // Direct workspace path
        const packageJsonPath = workspace === "."
          ? "package.json"
          : join(workspace, "package.json");
        if (
          existsSync(packageJsonPath) && !packageFiles.includes(packageJsonPath)
        ) {
          packageFiles.push(packageJsonPath);
        }
      }
    }
  } else {
    // Fall back to package.json workspaces if no pnpm-workspace.yaml
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
    if (shouldPinVersion(version)) {
      let lockedVersion: string | undefined;

      if (version.startsWith("catalog:")) {
        // Handle catalog references
        if (version === "catalog:") {
          // Default catalog: look for package in default catalog
          lockedVersion = lockedVersions.get(`catalog:${name}`);
        } else {
          // Named catalog: extract catalog name and look up package
          const catalogName = version.slice(8); // Remove "catalog:" prefix
          lockedVersion = lockedVersions.get(`catalog:${catalogName}:${name}`);
        }
      } else {
        // Regular package lookup
        lockedVersion = lockedVersions.get(name);
      }

      if (lockedVersion) {
        pinned[name] = lockedVersion;
        const paddedName = name.padEnd(maxNameLength);
        const paddedVersion = version.padEnd(maxVersionLength);
        const oldVersion = gray(paddedVersion);
        const newVersion = green(lockedVersion);
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
  const args = parseArgs(process.argv.slice(2), {
    boolean: ["version"],
  });

  // --version flag
  if (args.version) {
    console.log(`pindeps ${packageJson.version}`);
    process.exit(0);
  }

  try {
    const packageManagerFiles = findPackageManagerFiles();
    const packageJsonFiles = packageManagerFiles.filter((file) =>
      file.endsWith("package.json")
    );
    const pnpmWorkspaceFile = packageManagerFiles.find((file) =>
      file === "pnpm-workspace.yaml"
    );

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
    const lockData = getLockedVersion(lockFile);
    if (lockData.versions.size === 0) {
      console.log(
        "❌ Error: No lock file found or unable to parse lock file",
      );
      process.exit(1);
    }
    const lockedVersions = lockData.versions;

    // Calculate max package name and version length across all package.json files for alignment
    let maxNameLength = 0;
    let maxVersionLength = 0;
    const packageJsonContents: Array<
      { path: string; content: string; json: PackageJson }
    > = [];

    for (const packageJsonPath of packageJsonFiles) {
      const content = readFileSync(packageJsonPath, "utf8");
      const packageJson = parsePackageJson(content);
      packageJsonContents.push({
        path: packageJsonPath,
        content,
        json: packageJson,
      });

      for (const depType of DEPENDENCY_TYPES) {
        if (packageJson[depType]) {
          const deps = packageJson[depType] as Record<string, string>;
          for (const [name, version] of Object.entries(deps)) {
            maxNameLength = Math.max(maxNameLength, name.length);
            if (shouldPinVersion(version)) {
              maxVersionLength = Math.max(maxVersionLength, version.length);
            }
          }
        }
      }
    }

    // Include pnpm-workspace.yaml catalog entries in alignment calculation
    if (pnpmWorkspaceFile && lockFile?.type === "pnpm") {
      const workspaceContent = readFileSync(pnpmWorkspaceFile, "utf8");
      const workspace = parsePnpmWorkspace(workspaceContent);

      if (workspace.catalog) {
        for (const [name, version] of Object.entries(workspace.catalog)) {
          maxNameLength = Math.max(maxNameLength, name.length);
          if (shouldPinVersion(version)) {
            maxVersionLength = Math.max(maxVersionLength, version.length);
          }
        }
      }

      if (workspace.catalogs) {
        for (const catalog of Object.values(workspace.catalogs)) {
          for (const [name, version] of Object.entries(catalog)) {
            maxNameLength = Math.max(maxNameLength, name.length);
            if (shouldPinVersion(version)) {
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
            return shouldPinVersion(version) && lockedVersions.has(name);
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
      const {
        path: packageJsonPath,
        content: originalContent,
        json: packageJson,
      } of packageJsonContents
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
              return shouldPinVersion(version) && lockedVersions.has(name);
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
        // Preserve original formatting by doing targeted string replacement
        let updatedContent = originalContent;

        // Parse original content to get the actual old versions
        const originalParsed = parsePackageJson(originalContent);

        // Update each dependency type section
        for (const depType of DEPENDENCY_TYPES) {
          const originalDeps = originalParsed[depType];
          if (!originalDeps) continue;

          const pinnedDeps =
            (packageJson as Record<string, Record<string, string>>)[depType];

          // For each dependency that needs updating
          for (const [pkgName, newVersion] of Object.entries(pinnedDeps)) {
            const oldVersion = originalDeps[pkgName];
            if (oldVersion && oldVersion !== newVersion) {
              // Create a regex that matches the exact dependency line
              // This preserves any formatting (spaces, tabs, etc.)
              const escapedName = pkgName.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&",
              );
              const escapedOldVersion = oldVersion.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&",
              );

              // Match pattern: "package-name" : "old-version"
              // with flexible whitespace
              const pattern =
                `("${escapedName}"\\s*:\\s*")${escapedOldVersion}(")`;
              const regex = new RegExp(pattern);

              updatedContent = updatedContent.replace(
                regex,
                `$1${newVersion}$2`,
              );
            }
          }
        }

        writeFileSync(packageJsonPath, updatedContent);
        totalChanges = true;
      }
    }

    // Handle pnpm-workspace.yaml catalog pinning
    if (pnpmWorkspaceFile && lockFile?.type === "pnpm") {
      const workspaceContent = readFileSync(pnpmWorkspaceFile, "utf8");
      const {
        content: updatedWorkspaceContent,
        hasChanges: workspaceChanges,
        changes,
      } = pinPnpmWorkspaceCatalogs(workspaceContent, lockedVersions, {
        catalog: lockData.catalog,
        catalogs: lockData.catalogs,
      });

      if (workspaceChanges) {
        console.log("\npnpm-workspace.yaml:");

        // Simplify names by removing prefixes
        const simplifiedChanges = changes.map((change) => {
          let simpleName: string;
          if (change.name.startsWith("catalog.")) {
            simpleName = change.name.slice(8); // Remove "catalog."
          } else if (change.name.startsWith("catalogs.")) {
            const parts = change.name.split(".");
            simpleName = parts.slice(2).join("."); // Remove "catalogs.catalogName."
          } else {
            simpleName = change.name;
          }
          return { ...change, simpleName };
        });

        // Calculate combined maxVersionLength including catalog changes
        let combinedMaxVersionLength = maxVersionLength;
        for (const change of simplifiedChanges) {
          combinedMaxVersionLength = Math.max(
            combinedMaxVersionLength,
            change.oldVersion.length,
          );
        }

        // Use same padding as package.json files for alignment
        for (const change of simplifiedChanges) {
          const paddedName = change.simpleName.padEnd(maxNameLength);
          const paddedVersion = change.oldVersion.padEnd(
            combinedMaxVersionLength,
          );
          const oldVersion = gray(paddedVersion);
          const newVersion = green(change.newVersion);
          console.log(`   ${paddedName}: ${oldVersion} -> ${newVersion}`);
        }

        writeFileSync(pnpmWorkspaceFile, updatedWorkspaceContent);
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
