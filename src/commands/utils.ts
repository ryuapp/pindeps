import { parse } from "@david/jsonc-morph";

// Extracted the logic for updating package.json content to a utility function
export function updatePackageJsonContent(
  originalContent: string,
  pinnedDeps: Record<string, Record<string, string>>,
  dependencyTypes:
    | readonly ["devDependencies"]
    | readonly ["dependencies", "devDependencies"],
): string {
  // Use jsonc-morph to preserve formatting
  const root = parse(originalContent);
  const rootObj = root.asObjectOrForce();

  // Update each dependency type section
  for (const depType of dependencyTypes) {
    const depsToUpdate = pinnedDeps[depType];
    if (!depsToUpdate || Object.keys(depsToUpdate).length === 0) continue;

    // Get or skip if the dependency section doesn't exist
    const depsObj = rootObj.getIfObject(depType);
    if (!depsObj) continue;

    // Update each dependency
    for (const [pkgName, newVersion] of Object.entries(depsToUpdate)) {
      const prop = depsObj.get(pkgName);
      if (prop) {
        prop.setValue(newVersion);
      }
    }
  }

  return root.toString();
}
