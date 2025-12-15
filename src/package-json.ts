import * as v from "@valibot/valibot";
import { parseToValue } from "@david/jsonc-morph";

export interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
  [key: string]: unknown;
}

const PackageJsonSchema = v.looseObject({
  dependencies: v.optional(v.record(v.string(), v.string())),
  devDependencies: v.optional(v.record(v.string(), v.string())),
  workspaces: v.optional(
    v.union([
      v.array(v.string()),
      v.object({
        packages: v.optional(v.array(v.string())),
      }),
    ]),
  ),
});

export const DEPENDENCY_TYPES = [
  "dependencies",
  "devDependencies",
] as const;

export function parsePackageJson(content: string): PackageJson {
  const parsed = parseToValue(content);
  const result = v.safeParse(PackageJsonSchema, parsed);
  if (!result.success) {
    throw new Error(`Invalid package.json format: ${v.flatten(result.issues)}`);
  }
  return result.output;
}
