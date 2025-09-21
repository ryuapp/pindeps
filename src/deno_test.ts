import { assertEquals } from "@std/assert";
import { readFileSync } from "node:fs";
import { parseDenoLock } from "./deno.ts";

Deno.test("deno lock parser", () => {
  const content = readFileSync("testdata/deno.lock", "utf8");
  const versions = parseDenoLock(content);

  assertEquals(versions.get("jsonc-parser"), "3.3.1");
  assertEquals(versions.get("yaml"), "2.8.1");
  assertEquals(versions.size, 2);
});
