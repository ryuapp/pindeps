import { assertEquals } from "@std/assert";
import { parsePackageJson } from "./package-json.ts";
import packageJson from "../testdata/polyrepo/package.json" with {
  type: "text",
};

Deno.test("parse package.json", () => {
  const result = parsePackageJson(packageJson);

  assertEquals(result.dependencies?.["jsonc-parser"], "^3.3.1");
  assertEquals(result.dependencies?.["@hono/react-compat"], "^0.0.3");
  assertEquals(result.devDependencies?.["enogu"], "~0.6.0");
  assertEquals(result.workspaces, ["packages/*", "apps/*"]);
});

Deno.test("parse package.json with comments", () => {
  const packageJsonWithComments = `{
  // Package configuration
  "name": "test-project",
  "version": "1.0.0",
  "dependencies": {
    // Main dependency
    "enogu": "^1.0.0" // Inline comment
  }
}`;

  const result = parsePackageJson(packageJsonWithComments);

  assertEquals(result.name, "test-project");
  assertEquals(result.version, "1.0.0");
  assertEquals(result.dependencies?.["enogu"], "^1.0.0");
});
