import { assertEquals } from "@std/assert";
import { parseYarnLock } from "./yarn.ts";
import yarnLock from "../../testdata/polyrepo/yarn.lock" with { type: "text" };

Deno.test("parse yarn.lock for polyrepo", () => {
  const versions = parseYarnLock(yarnLock);

  assertEquals(versions.get("jsonc-parser"), "3.3.1");
  assertEquals(versions.get("enogu"), "0.6.2");
  assertEquals(versions.get("@hono/react-compat"), "0.0.3");
  // Yarn unsupport peer dependencies
  // assertEquals(versions.get("react"), "19.1.1");
});
