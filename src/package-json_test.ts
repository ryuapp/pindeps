import { assertEquals } from "@std/assert";
import { parsePackageJson } from "./package-json.ts";
import packageJson from "../testdata/package.json" with { type: "text" };

Deno.test("parsePackageJson - valid package.json", () => {
  const result = parsePackageJson(packageJson);

  assertEquals(result.dependencies?.["jsonc-parser"], "^3.3.1");
  assertEquals(result.dependencies?.["yaml"], "^2.8.1");
  assertEquals(result.devDependencies?.["enogu"], "~0.6.0");
  assertEquals(result.peerDependencies?.["react"], "^18.0.0");
  assertEquals(result.workspaces, ["packages/*", "apps/*"]);
});
