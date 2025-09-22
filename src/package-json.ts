import * as v from "@valibot/valibot";

const PackageJsonSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({
    dependencies: v.optional(v.record(v.string(), v.string())),
    devDependencies: v.optional(v.record(v.string(), v.string())),
    peerDependencies: v.optional(v.record(v.string(), v.string())),
    workspaces: v.optional(
      v.union([
        v.array(v.string()),
        v.object({
          packages: v.optional(v.array(v.string())),
        }),
      ]),
    ),
  }),
);

export type PackageJson = v.InferOutput<typeof PackageJsonSchema>;

export const DEPENDENCY_TYPES = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
] as const;

export function parsePackageJson(content: string): PackageJson {
  const result = v.safeParse(PackageJsonSchema, content);
  if (!result.success) {
    throw new Error(`Invalid package.json format: ${v.flatten(result.issues)}`);
  }
  return result.output;
}
