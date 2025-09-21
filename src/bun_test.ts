import { assertEquals } from "@std/assert";
import { readFileSync } from "node:fs";
import { parseBunLock } from "./bun.ts";

Deno.test("bun lock parser", () => {
  const content = readFileSync("testdata/bun.lock", "utf8");
  const versions = parseBunLock(content);

  assertEquals(versions.get("jsonc-parser"), "3.3.1");
  assertEquals(versions.get("yaml"), "2.8.1");
  assertEquals(versions.size, 2);
});
