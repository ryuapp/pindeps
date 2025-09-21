import { assertEquals } from "@std/assert";
import { readFileSync } from "node:fs";
import { parsePnpmLock } from "./pnpm.ts";

Deno.test("pnpm lock parser", () => {
  const content = readFileSync("testdata/pnpm-lock.yaml", "utf8");
  const versions = parsePnpmLock(content);

  assertEquals(versions.get("jsonc-parser"), "3.3.1");
  assertEquals(versions.get("yaml"), "2.8.1");
  assertEquals(versions.size, 2);
});
