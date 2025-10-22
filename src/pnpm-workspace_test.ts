import { assertEquals } from "@std/assert";
import { parsePnpmWorkspace } from "./pnpm-workspace.ts";
import pnpmWorkspace from "../testdata/pnpm-workspace/pnpm-workspace.yaml" with {
  type: "text",
};

Deno.test("parsePnpmWorkspace - basic workspace", () => {
  const result = parsePnpmWorkspace(pnpmWorkspace);

  assertEquals(result.packages, ["apps/*", "packages/*"]);
  assertEquals(result.catalog?.["enogu"], "^0.6.0");
  assertEquals(result.catalogs?.["react18"]?.["react"], "^18.2.0");
  assertEquals(result.catalogs?.["react19"]?.["react"], "^19.0.0");
});
