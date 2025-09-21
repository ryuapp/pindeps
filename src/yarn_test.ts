import { assertEquals } from "@std/assert";
import { readFileSync } from "node:fs";
import { parseYarnLock } from "./yarn.ts";

Deno.test("yarn lock parser", () => {
  const content = readFileSync("testdata/yarn.lock", "utf8");
  const versions = parseYarnLock(content);

  assertEquals(versions.get("jsonc-parser"), "3.3.1");
  assertEquals(versions.get("yaml"), "2.8.1");
  assertEquals(versions.size, 2);
});
