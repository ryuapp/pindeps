import { parsePackageJson } from "../package-json.ts";

// Extracted the logic for updating package.json content to a utility function
export function updatePackageJsonContent(
  originalContent: string,
  pinnedDeps: Record<string, Record<string, string>>,
  dependencyTypes:
    | readonly ["devDependencies"]
    | readonly ["dependencies", "devDependencies"],
): string {
  let updatedContent = originalContent;

  // Parse original content to get the actual old versions
  const originalParsed = parsePackageJson(originalContent);

  // Update each dependency type section
  for (const depType of dependencyTypes) {
    const originalDeps = originalParsed[depType];
    if (!originalDeps) continue;

    // For each dependency that needs updating
    for (const [pkgName, newVersion] of Object.entries(pinnedDeps[depType])) {
      const oldVersion = originalDeps[pkgName];
      if (oldVersion && oldVersion !== newVersion) {
        // Create a regex that matches the exact dependency line
        const escapedName = pkgName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const pattern = `("${escapedName}"\\s*:\\s*")[^\\"]*(")`;
        const regex = new RegExp(pattern);

        updatedContent = updatedContent.replace(regex, `$1${newVersion}$2`);
      }
    }
  }

  return updatedContent;
}
