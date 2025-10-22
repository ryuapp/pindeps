export type PackageManager = "npm" | "yarn" | "pnpm" | "bun" | "deno";

export interface LockFile {
  path: string;
  type: PackageManager;
}

export interface LockData {
  versions: Map<string, string>;
  catalog?: Record<string, string>;
  catalogs?: Record<string, Record<string, string>>;
}

export function shouldPinVersion(version: string): boolean {
  if (version.startsWith("workspace:") || version.startsWith("catalog:")) {
    return false;
  }

  // Check if version uses range operators or partial versions
  return (
    version.startsWith("^") ||
    version.startsWith("~") ||
    version.startsWith(">") ||
    version.startsWith("<") ||
    version.startsWith(">=") ||
    version.startsWith("<=") ||
    version.includes(" - ") ||
    version.includes(" || ") ||
    version === "*" ||
    version === "latest" ||
    !version.includes(".") ||
    version.split(".").length < 3
  );
}
