import { assertEquals } from "@std/assert";
import { parseNpmLock } from "./npm.ts";
import packageLockJson from "../testdata/package-lock.json" with {
  type: "text",
};

Deno.test("npm lock parser", () => {
  const versions = parseNpmLock(packageLockJson);

  assertEquals(versions.get("jsonc-parser"), "3.3.1");
  assertEquals(versions.get("yaml"), "2.8.1");
  assertEquals(versions.size, 2);
});
