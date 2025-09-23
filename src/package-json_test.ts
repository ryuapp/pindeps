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
  assertEquals(result.peerDependencies?.["react"], ">=18.0.0");
  assertEquals(result.workspaces, ["packages/*", "apps/*"]);
});
