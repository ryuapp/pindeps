import { assertEquals } from "@std/assert";
import { parseNpmLock } from "../src/npm.ts";
import { parseYarnLock } from "../src/yarn.ts";
import { parsePnpmLock } from "../src/pnpm.ts";
import { parseBunLock } from "../src/bun.ts";
import { parseDenoLock } from "../src/deno.ts";

Deno.test("npm lock parser", () => {
  const versions = parseNpmLock("test/fixtures/package-lock.json");

  assertEquals(versions.get("jsonc-parser"), "3.3.1");
  assertEquals(versions.get("yaml"), "2.8.1");
  assertEquals(versions.size, 2);
});

Deno.test("yarn lock parser", () => {
  const versions = parseYarnLock("test/fixtures/yarn.lock");

  assertEquals(versions.get("jsonc-parser"), "3.3.1");
  assertEquals(versions.get("yaml"), "2.8.1");
  assertEquals(versions.size, 2);
});

Deno.test("pnpm lock parser", () => {
  const versions = parsePnpmLock("test/fixtures/pnpm-lock.yaml");

  assertEquals(versions.get("jsonc-parser"), "3.3.1");
  assertEquals(versions.get("yaml"), "2.8.1");
  assertEquals(versions.size, 2);
});

Deno.test("bun lock parser", () => {
  const versions = parseBunLock("test/fixtures/bun.lock");

  assertEquals(versions.get("jsonc-parser"), "3.3.1");
  assertEquals(versions.get("yaml"), "2.8.1");
  assertEquals(versions.size, 2);
});

Deno.test("deno lock parser", () => {
  const versions = parseDenoLock("test/fixtures/deno.lock");

  assertEquals(versions.get("jsonc-parser"), "3.3.1");
  assertEquals(versions.get("yaml"), "2.8.1");
  assertEquals(versions.size, 2);
});
