import { assertEquals } from "@std/assert";
import { parseBunLock } from "./bun.ts";
import bunLock from "../testdata/bun.lock" with { type: "text" };

Deno.test("bun lock parser", () => {
  const versions = parseBunLock(bunLock);

  assertEquals(versions.get("jsonc-parser"), "3.3.1");
  assertEquals(versions.get("yaml"), "2.8.1");
  assertEquals(versions.size, 2);
});
