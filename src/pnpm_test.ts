import { assertEquals } from "@std/assert";
import { parsePnpmLock } from "./pnpm.ts";
import pnpmLock from "../testdata/pnpm-lock.yaml" with { type: "text" };

Deno.test("pnpm lock parser", () => {
  const versions = parsePnpmLock(pnpmLock);

  assertEquals(versions.get("jsonc-parser"), "3.3.1");
  assertEquals(versions.get("yaml"), "2.8.1");
  assertEquals(versions.size, 2);
});
