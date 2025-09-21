import { assertEquals } from "@std/assert";
import { parseDenoLock } from "./deno.ts";

Deno.test("deno lock parser", () => {
  const versions = parseDenoLock("testdata/deno.lock");

  assertEquals(versions.get("jsonc-parser"), "3.3.1");
  assertEquals(versions.get("yaml"), "2.8.1");
  assertEquals(versions.size, 2);
});
