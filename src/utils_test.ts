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
  assertEquals(shouldPinVersion("0.0.0-experimental-1235"), false);
});

Deno.test("shouldPinVersion - jsr: protocol", () => {
  assertEquals(shouldPinVersion("jsr:^0.6.2"), true);
  assertEquals(shouldPinVersion("jsr:~1.0.0"), true);
  assertEquals(shouldPinVersion("jsr:0.6.2"), false);
  assertEquals(shouldPinVersion("jsr:1.0.0"), false);
  assertEquals(shouldPinVersion("jsr:1.0.0-beta.0"), false);
  assertEquals(shouldPinVersion("jsr:@ryu/enogu@^0.6.2"), true);
  assertEquals(shouldPinVersion("jsr:@ryu/enogu@~1.0.0"), true);
  assertEquals(shouldPinVersion("jsr:@ryu/enogu@0.6.2"), false);
  assertEquals(shouldPinVersion("jsr:@ryu/enogu@1.0.0"), false);
});

Deno.test("shouldPinVersion - npm: protocol", () => {
  assertEquals(shouldPinVersion("npm:@jsr/ryu__enogu@^0.6.2"), true);
  assertEquals(shouldPinVersion("npm:@jsr/ryu__enogu@~1.0.0"), true);
  assertEquals(shouldPinVersion("npm:@jsr/ryu__enogu@0.6.2"), false);
  assertEquals(shouldPinVersion("npm:@jsr/ryu__enogu@1.0.0"), false);
  assertEquals(shouldPinVersion("npm:package@^1.0.0"), true);
  assertEquals(shouldPinVersion("npm:package@1.0.0"), false);
  assertEquals(shouldPinVersion("npm:react@0.0.0-experimental-1235"), false);
});

Deno.test("shouldPinVersion - HTTP/HTTPS URLs", () => {
  assertEquals(
    shouldPinVersion("https://deno.land/x/enogu@0.6.0/mod.ts"),
    false,
  );
  assertEquals(shouldPinVersion("http://example.com/example.js"), false);
  assertEquals(shouldPinVersion("https://esm.sh/react@^18.0.0"), false);
  assertEquals(shouldPinVersion("https://cdn.skypack.dev/react"), false);
});
