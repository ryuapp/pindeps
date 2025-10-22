import { assertEquals } from "@std/assert";
import { shouldPinVersion } from "./utils.ts";

Deno.test("shouldPinVersion - range operators", () => {
  assertEquals(shouldPinVersion("^1.0.0"), true);
  assertEquals(shouldPinVersion("~1.0.0"), true);
  assertEquals(shouldPinVersion(">1.0.0"), true);
  assertEquals(shouldPinVersion("<1.0.0"), true);
  assertEquals(shouldPinVersion(">=1.0.0"), true);
  assertEquals(shouldPinVersion("<=1.0.0"), true);
});

Deno.test("shouldPinVersion - complex ranges", () => {
  assertEquals(shouldPinVersion("1.0.0 - 2.0.0"), true);
  assertEquals(shouldPinVersion("1.0.0 || 2.0.0"), true);
});

Deno.test("shouldPinVersion - wildcards and special values", () => {
  assertEquals(shouldPinVersion("*"), true);
  assertEquals(shouldPinVersion("latest"), true);
});

Deno.test("shouldPinVersion - partial versions", () => {
  assertEquals(shouldPinVersion("1"), true);
  assertEquals(shouldPinVersion("1.0"), true);
  assertEquals(shouldPinVersion("1.0.0"), false); // Full semver version
});

Deno.test("shouldPinVersion - exact versions", () => {
  assertEquals(shouldPinVersion("1.0.0"), false);
  assertEquals(shouldPinVersion("2.3.4"), false);
  assertEquals(shouldPinVersion("10.20.30"), false);
});

Deno.test("shouldPinVersion - workspace references", () => {
  assertEquals(shouldPinVersion("workspace:*"), false);
  assertEquals(shouldPinVersion("workspace:^1.0.0"), false);
  assertEquals(shouldPinVersion("workspace:~1.0.0"), false);
});

Deno.test("shouldPinVersion - catalog references", () => {
  assertEquals(shouldPinVersion("catalog:"), false);
  assertEquals(shouldPinVersion("catalog:react18"), false);
});

Deno.test("shouldPinVersion - prerelease versions", () => {
  assertEquals(shouldPinVersion("1.0.0-beta3"), false);
  assertEquals(shouldPinVersion("10.20.30-rc1"), false);
  assertEquals(shouldPinVersion("16.0.0-beta.0"), false);
});
