import { assertEquals } from "@std/assert";
import { parseNpmLock } from "./npm.ts";

Deno.test("npm lock parser", () => {
  const versions = parseNpmLock("testdata/package-lock.json");

  assertEquals(versions.get("jsonc-parser"), "3.3.1");
  assertEquals(versions.get("yaml"), "2.8.1");
  assertEquals(versions.size, 2);
});
