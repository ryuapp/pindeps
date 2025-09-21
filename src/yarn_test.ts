import { assertEquals } from "@std/assert";
import { parseYarnLock } from "./yarn.ts";
import yarnLock from "../testdata/yarn.lock" with { type: "text" };

Deno.test("yarn lock parser", () => {
  const versions = parseYarnLock(yarnLock);

  assertEquals(versions.get("jsonc-parser"), "3.3.1");
  assertEquals(versions.get("yaml"), "2.8.1");
  assertEquals(versions.size, 2);
});
