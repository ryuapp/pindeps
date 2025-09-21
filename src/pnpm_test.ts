import { assertEquals } from "@std/assert";
import { parsePnpmLock } from "./pnpm.ts";

Deno.test("pnpm lock parser", () => {
  const versions = parsePnpmLock("testdata/pnpm-lock.yaml");

  assertEquals(versions.get("jsonc-parser"), "3.3.1");
  assertEquals(versions.get("yaml"), "2.8.1");
  assertEquals(versions.size, 2);
});
