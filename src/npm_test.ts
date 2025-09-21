import { assertEquals } from "@std/assert";
import { readFileSync } from "node:fs";
import { parseNpmLock } from "./npm.ts";

Deno.test("npm lock parser", () => {
  const content = readFileSync("testdata/package-lock.json", "utf8");
  const versions = parseNpmLock(content);

  assertEquals(versions.get("jsonc-parser"), "3.3.1");
  assertEquals(versions.get("yaml"), "2.8.1");
  assertEquals(versions.size, 2);
});
