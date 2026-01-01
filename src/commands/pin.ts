import { readDirSync } from "@std/fs/unstable-read-dir";
import { readTextFileSync } from "@std/fs/unstable-read-text-file";
import { writeTextFileSync } from "@std/fs/unstable-write-text-file";
import { bold, brightRed, gray, green, red } from "@ryu/enogu";
import { regex } from "arkregex";
import {
  parsePnpmWorkspace,
  pinPnpmWorkspaceCatalogs,
} from "../pnpm-workspace.ts";
import {
  DEPENDENCY_TYPES,
  type PackageJson,
  parsePackageJson,
} from "../package-json.ts";
import { parseDenoJson, updateDenoJsonContent } from "../deno-json.ts";
import { join } from "@std/path/join";
import {
  ensureDirSync,
  ensureFileSync,
  type LockFile,
  type PackageManager,
  shouldPinVersion,
} from "../utils.ts";
import { getLockedVersion } from "../pm/mod.ts";
import { updatePackageJsonContent } from "./utils.ts";

const backslashPattern = regex("\\\\", "g");
const prefixPattern = regex("^(jsr:|npm:)");
const npmPackagePattern = regex("^npm:(@?[^@]+)@");
const jsrPackagePattern = regex("^jsr:(@[^@/]+/[^@]+|[^@]+)@");

export function runPinCommand(
  options: { dev?: boolean; check?: boolean } = {},
): number {
  const dependencyTypes = options.dev
    ? ["devDependencies"] as const
    : DEPENDENCY_TYPES;
  const checkMode = options.check ?? false;

  try {
    const pmFiles = findPackageManagerFiles();
    const packageJsonFiles = pmFiles.filter((f) => f.endsWith("package.json"));
    const pnpmWorkspaceFile = pmFiles.find((file) =>
      file === "pnpm-workspace.yaml"
    );
    const denoJsonFile = ensureFileSync("deno.json")
      ? "deno.json"
      : ensureFileSync("deno.jsonc")
      ? "deno.jsonc"
      : null;

    if (packageJsonFiles.length === 0 && !denoJsonFile) {
      console.error(
        `${
          bold(brightRed("error"))
        }: package.json or deno.json/deno.jsonc not found`,
      );
      return 1;
    }

    // TODO: Error handling for multiple lockfiles
    const lockFile = getLockFiles().at(0);
    if (!lockFile) {
      console.error(
        `${
          bold(brightRed("error"))
        }: No lockfile found (package-lock.json, yarn.lock, pnpm-lock.yaml, deno.lock or bun.lock)`,
      );
      return 1;
    }

    // Get locked versions from lockfile
    const lockData = getLockedVersion(lockFile);
    if (lockData.versions.size === 0) {
      console.error(
        `${
          bold(brightRed("error"))
        }: No lockfile found or unable to parse lockfile`,
      );
      return 1;
    }
    const lockedVersions = lockData.versions;

    // Find workspace files if in deno workspace
    const denoWorkspaceFiles = lockFile.type === "deno" && lockData.importers
      ? findDenoWorkspaceFiles(lockData.importers)
      : [];

    // Add deno workspace package.json files to packageJsonFiles
    if (lockFile.type === "deno" && lockData.importers) {
      for (const [importerPath] of lockData.importers) {
        if (importerPath === ".") continue;
        const packageJsonPath = join(importerPath, "package.json");
        if (
          ensureFileSync(packageJsonPath) &&
          !packageJsonFiles.includes(packageJsonPath)
        ) {
          packageJsonFiles.push(packageJsonPath);
        }
      }
    }

    // Calculate max package name and version length across all package.json files for alignment
    let maxNameLength = 0;
    let maxVersionLength = 0;
    const packageJsonContents: Array<
      { path: string; content: string; json: PackageJson }
    > = [];

    for (const packageJsonPath of packageJsonFiles) {
      const content = readTextFileSync(packageJsonPath);
      const packageJson = parsePackageJson(content);
      packageJsonContents.push({
        path: packageJsonPath,
        content,
        json: packageJson,
      });

      for (const depType of dependencyTypes) {
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

    // Include deno.json imports in alignment calculation
    if (denoJsonFile && lockFile?.type === "deno") {
      const denoJsonContent = readTextFileSync(denoJsonFile);
      const denoJson = parseDenoJson(denoJsonContent);

      if (denoJson.imports) {
        for (const [name, version] of Object.entries(denoJson.imports)) {
          maxNameLength = Math.max(maxNameLength, name.length);
          if (shouldPinVersion(version)) {
            maxVersionLength = Math.max(maxVersionLength, version.length);
          }
        }
      }
    }

    // Include workspace deno.json files in alignment calculation
    for (const workspaceDenoJsonFile of denoWorkspaceFiles) {
      const denoJsonContent = readTextFileSync(workspaceDenoJsonFile);
      const denoJson = parseDenoJson(denoJsonContent);

      if (denoJson.imports) {
        for (const [name, version] of Object.entries(denoJson.imports)) {
          maxNameLength = Math.max(maxNameLength, name.length);
          if (shouldPinVersion(version)) {
            maxVersionLength = Math.max(maxVersionLength, version.length);
          }
        }
      }
    }

    // Include pnpm-workspace.yaml catalog entries in alignment calculation
    if (pnpmWorkspaceFile && lockFile?.type === "pnpm") {
      const workspaceContent = readTextFileSync(pnpmWorkspaceFile);
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
      for (const depType of dependencyTypes) {
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

    const lockFileName = getLockFileName(lockFile);
    console.log(`🔒 Lockfile: ${lockFileName}`);

    let totalChanges = false;
    let unpinnedCount = 0;
    let totalChecked = 0;

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

      // Determine which version map to use for this package
      const versionsToUse = getVersionsForPackage(
        packageJsonPath,
        lockedVersions,
        lockData.importers,
      );

      // Process all dependency types
      for (const depType of dependencyTypes) {
        if (packageJson[depType]) {
          const originalDeps = packageJson[depType] as Record<string, string>;

          // Check if any dependencies will be pinned before processing
          const willHaveChanges = Object.entries(originalDeps).some(
            ([name, version]) => {
              return shouldPinVersion(version) && versionsToUse.has(name);
            },
          );

          if (willHaveChanges && !hasOutput) {
            console.log(`\n${packageJsonPath}:`);
            hasOutput = true;
          }

          const {
            pinned,
            unpinnedCount: depUnpinnedCount,
            totalCount: depTotalCount,
          } = pinDependencies(
            originalDeps,
            versionsToUse,
            maxNameLength,
            maxVersionLength,
            checkMode,
          );

          unpinnedCount += depUnpinnedCount;
          totalChecked += depTotalCount;

          if (JSON.stringify(pinned) !== JSON.stringify(originalDeps)) {
            (packageJson as Record<string, Record<string, string>>)[depType] =
              pinned;
            hasChanges = true;
          }
        }
      }

      if (hasChanges) {
        if (!checkMode) {
          const updatedContent = updatePackageJsonContent(
            originalContent,
            packageJson as Record<string, Record<string, string>>,
            dependencyTypes,
          );

          writeTextFileSync(packageJsonPath, updatedContent);
        }
        totalChanges = true;
      }
    }

    // Handle pnpm-workspace.yaml catalog pinning
    if (pnpmWorkspaceFile && lockFile?.type === "pnpm") {
      const workspaceContent = readTextFileSync(pnpmWorkspaceFile);
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

        unpinnedCount += changes.length;
        totalChecked += changes.length;

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

          if (checkMode) {
            // Check mode: red old version, green new version
            const oldVersion = red(paddedVersion);
            const newVersion = green(change.newVersion);
            console.log(`   ${paddedName}: ${oldVersion} -> ${newVersion}`);
          } else {
            // Pin mode: gray old version, green new version
            const oldVersion = gray(paddedVersion);
            const newVersion = green(change.newVersion);
            console.log(`   ${paddedName}: ${oldVersion} -> ${newVersion}`);
          }
        }

        if (!checkMode) {
          writeTextFileSync(pnpmWorkspaceFile, updatedWorkspaceContent);
        }
        totalChanges = true;
      }
    }

    // Handle deno.json pinning (root and workspace files)
    if (lockFile?.type === "deno") {
      const allDenoJsonFiles = denoJsonFile
        ? [denoJsonFile, ...denoWorkspaceFiles]
        : denoWorkspaceFiles;

      for (const currentDenoJsonFile of allDenoJsonFiles) {
        const denoJsonContent = readTextFileSync(currentDenoJsonFile);
        const denoJson = parseDenoJson(denoJsonContent);

        if (denoJson.imports) {
          let hasChanges = false;
          let hasOutput = false;

          // Determine which version map to use for this deno.json
          const versionsToUse = getVersionsForDenoJson(
            currentDenoJsonFile,
            lockedVersions,
            lockData.importers,
          );

          // Check if any imports will be pinned before processing
          const willHaveChanges = Object.entries(denoJson.imports).some(
            ([name, version]) => {
              return shouldPinVersion(version) && versionsToUse.has(name);
            },
          );

          if (willHaveChanges && !hasOutput) {
            console.log(`\n${currentDenoJsonFile}:`);
            hasOutput = true;
          }

          const {
            pinned,
            unpinnedCount: depUnpinnedCount,
            totalCount: depTotalCount,
          } = pinDependencies(
            denoJson.imports,
            versionsToUse,
            maxNameLength,
            maxVersionLength,
            checkMode,
          );

          unpinnedCount += depUnpinnedCount;
          totalChecked += depTotalCount;

          if (JSON.stringify(pinned) !== JSON.stringify(denoJson.imports)) {
            denoJson.imports = pinned;
            hasChanges = true;
          }

          if (hasChanges) {
            if (!checkMode) {
              const updatedContent = updateDenoJsonContent(
                denoJsonContent,
                denoJson,
              );
              writeTextFileSync(currentDenoJsonFile, updatedContent);
            }
            totalChanges = true;
          }
        }
      }
    }

    if (checkMode) {
      if (totalChanges) {
        console.error(
          `\n${
            bold(brightRed("error"))
          }: Found ${unpinnedCount} not pinned dependencies in ${totalChecked} dependencies`,
        );
        return 1;
      } else {
        console.log(`Checked ${totalChecked} dependencies`);
        return 0;
      }
    } else {
      if (totalChanges) {
        const lockFileName = getLockFileName(lockFile);
        const packageManager = getPackageManagerName(lockFile);
        const installCommand = packageManager === "yarn"
          ? "yarn"
          : packageManager === "deno"
          ? "deno install"
          : `${packageManager} install`;
        console.log(`\nℹ️ Run \`${installCommand}\` to update ${lockFileName}`);
      }
      console.log(`📌 Pinned ${lockedVersions.size} dependencies`);
    }
  } catch (error) {
    console.error(
      `${bold(brightRed("error"))}:`,
      error instanceof Error ? error.message : error,
    );
    return 1;
  }
  return 0;
}

// Helper functions (extracted from original main.ts)
function getLockFiles(): LockFile[] {
  const lockFiles: LockFile[] = [];

  if (ensureFileSync("deno.lock")) {
    lockFiles.push({ path: "deno.lock", type: "deno" });
  }
  if (ensureFileSync("bun.lock")) {
    lockFiles.push({ path: "bun.lock", type: "bun" });
  }
  if (ensureFileSync("pnpm-lock.yaml")) {
    lockFiles.push({ path: "pnpm-lock.yaml", type: "pnpm" });
  }
  if (ensureFileSync("yarn.lock")) {
    lockFiles.push({ path: "yarn.lock", type: "yarn" });
  }
  if (ensureFileSync("package-lock.json")) {
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
  const packageFiles: string[] = [];

  // Add package.json if it exists
  if (ensureFileSync("package.json")) {
    packageFiles.push("package.json");
  }

  // Check for pnpm-workspace.yaml first
  if (ensureFileSync("pnpm-workspace.yaml")) {
    packageFiles.push("pnpm-workspace.yaml");
    const workspaceContent = readTextFileSync("pnpm-workspace.yaml");
    const workspaces = parsePnpmWorkspace(workspaceContent).packages || [];

    for (const workspace of workspaces) {
      // Handle glob patterns
      if (workspace.includes("*")) {
        // Support patterns like "packages/*", "packages/**", "apps/*", etc.
        if (workspace.endsWith("/*")) {
          const dir = workspace.slice(0, -2);
          if (ensureDirSync(dir)) {
            try {
              for (const entry of readDirSync(dir)) {
                const entryPath = join(dir, entry.name);
                const packageJsonPath = join(entryPath, "package.json");
                if (
                  ensureDirSync(entryPath) &&
                  ensureFileSync(packageJsonPath)
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
          if (ensureDirSync(dir)) {
            try {
              const findPackagesRecursively = (dirPath: string) => {
                for (const entry of readDirSync(dirPath)) {
                  const entryPath = join(dirPath, entry.name);
                  if (ensureDirSync(entryPath)) {
                    const packageJsonPath = join(entryPath, "package.json");
                    if (ensureFileSync(packageJsonPath)) {
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
          ensureFileSync(packageJsonPath) &&
          !packageFiles.includes(packageJsonPath)
        ) {
          packageFiles.push(packageJsonPath);
        }
      }
    }
  } else {
    // Fall back to package.json workspaces if no pnpm-workspace.yaml
    const rootPackageJson = "package.json";
    if (ensureFileSync(rootPackageJson)) {
      const content = readTextFileSync(rootPackageJson);
      const rootPkg = parsePackageJson(content);

      if (rootPkg.workspaces) {
        const workspaces = Array.isArray(rootPkg.workspaces)
          ? rootPkg.workspaces
          : rootPkg.workspaces.packages || [];

        for (const workspace of workspaces) {
          // Simple glob pattern matching for common patterns like "packages/*"
          if (workspace.endsWith("/*")) {
            const dir = workspace.slice(0, -2);
            if (ensureDirSync(dir)) {
              try {
                for (const entry of readDirSync(dir)) {
                  const entryPath = join(dir, entry.name);
                  const packageJsonPath = join(entryPath, "package.json");
                  if (
                    ensureDirSync(entryPath) &&
                    ensureFileSync(packageJsonPath)
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
            if (ensureFileSync(packageJsonPath)) {
              packageFiles.push(packageJsonPath);
            }
          }
        }
      }
    }
  }

  return packageFiles;
}

function getVersionsForFile(
  filePath: string,
  globalVersions: Map<string, string>,
  importers?: Map<string, Map<string, string>>,
): Map<string, string> {
  if (!importers || importers.size === 0) {
    return globalVersions;
  }

  // Convert Windows path to forward slashes for matching
  const normalizedPath = filePath.replace(backslashPattern, "/");

  // Try to find importer by matching path
  // package.json / deno.json -> "."
  // apps/api/package.json -> "apps/api"
  // packages/react2/deno.json -> "packages/react2"
  let importerPath = ".";
  const rootFiles = ["package.json", "deno.json", "deno.jsonc"];
  if (!rootFiles.includes(normalizedPath)) {
    // Remove /package.json, /deno.json, or /deno.jsonc from the end
    importerPath = normalizedPath.replace(
      /\/(package\.json|deno\.json|deno\.jsonc)$/,
      "",
    );
  }

  const importerVersions = importers.get(importerPath);
  if (importerVersions && importerVersions.size > 0) {
    // Merge importer-specific versions with global versions
    const merged = new Map(globalVersions);
    for (const [key, value] of importerVersions) {
      merged.set(key, value);
    }
    return merged;
  }

  return globalVersions;
}

function getVersionsForPackage(
  packageJsonPath: string,
  globalVersions: Map<string, string>,
  importers?: Map<string, Map<string, string>>,
): Map<string, string> {
  return getVersionsForFile(packageJsonPath, globalVersions, importers);
}

function getVersionsForDenoJson(
  denoJsonPath: string,
  globalVersions: Map<string, string>,
  importers?: Map<string, Map<string, string>>,
): Map<string, string> {
  return getVersionsForFile(denoJsonPath, globalVersions, importers);
}

function findDenoWorkspaceFiles(
  importers: Map<string, Map<string, string>>,
): string[] {
  const denoJsonFiles: string[] = [];

  for (const [importerPath] of importers) {
    if (importerPath === ".") continue; // Root is handled separately

    // Check for deno.json or deno.jsonc in the workspace member directory
    const denoJsonPath = join(importerPath, "deno.json");
    const denoJsoncPath = join(importerPath, "deno.jsonc");

    if (ensureFileSync(denoJsonPath)) {
      denoJsonFiles.push(denoJsonPath);
    } else if (ensureFileSync(denoJsoncPath)) {
      denoJsonFiles.push(denoJsoncPath);
    }
  }

  return denoJsonFiles;
}

function pinDependencies(
  deps: Record<string, string>,
  lockedVersions: Map<string, string>,
  maxNameLength: number,
  maxVersionLength: number,
  checkMode = false,
): {
  pinned: Record<string, string>;
  unpinnedCount: number;
  totalCount: number;
} {
  const pinned: Record<string, string> = {};
  let unpinnedCount = 0;
  let totalCount = 0;

  for (const [name, version] of Object.entries(deps)) {
    totalCount++;
    if (shouldPinVersion(version)) {
      let lockedVersion: string | undefined;
      let prefix = "";
      let lookupName = name;

      // Extract prefix (jsr:, npm:, etc.)
      const prefixMatch = version.match(prefixPattern);
      if (prefixMatch) {
        prefix = prefixMatch[1];

        // For npm: protocol, extract the actual package name
        // e.g., "npm:@jsr/ryu__enogu@^0.6.2" -> "@jsr/ryu__enogu"
        if (prefix === "npm:") {
          const npmMatch = version.match(npmPackagePattern);
          if (npmMatch) {
            lookupName = npmMatch[1];
          }
        } else if (prefix === "jsr:") {
          // For jsr: protocol, extract the actual package name
          // e.g., "jsr:@ryu/enogu@^0.6.2" -> "@ryu/enogu"
          // Handle scoped packages like @scope/name
          const jsrMatch = version.match(jsrPackagePattern);
          if (jsrMatch) {
            lookupName = jsrMatch[1];
          }
        }
      }

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
        // Regular package lookup (use actual package name for npm: protocol)
        lockedVersion = lockedVersions.get(lookupName);
      }

      if (lockedVersion) {
        // Preserve prefix (jsr:, npm:, etc.)
        let pinnedVersion: string;
        if (prefix === "npm:" || prefix === "jsr:") {
          // For npm: and jsr: protocols, reconstruct the full specifier
          // e.g., "npm:@jsr/ryu__enogu@0.6.2" or "jsr:@ryu/enogu@0.6.2"
          pinnedVersion = `${prefix}${lookupName}@${lockedVersion}`;
        } else {
          pinnedVersion = prefix + lockedVersion;
        }
        pinned[name] = pinnedVersion;
        unpinnedCount++;

        if (checkMode) {
          // Check mode: red old version, green new version
          const paddedName = name.padEnd(maxNameLength);
          const paddedVersion = version.padEnd(maxVersionLength);
          const oldVersion = red(paddedVersion);
          const newVersion = green(pinnedVersion);
          console.log(`   ${paddedName}: ${oldVersion} -> ${newVersion}`);
        } else {
          // Pin mode: gray old version, green new version
          const paddedName = name.padEnd(maxNameLength);
          const paddedVersion = version.padEnd(maxVersionLength);
          const oldVersion = gray(paddedVersion);
          const newVersion = green(pinnedVersion);
          console.log(`   ${paddedName}: ${oldVersion} -> ${newVersion}`);
        }
      } else {
        pinned[name] = version;
        console.error(
          `${bold(brightRed("error"))}: ${name}: no locked version found`,
        );
      }
    } else {
      pinned[name] = version;
    }
  }

  return { pinned, unpinnedCount, totalCount };
}
