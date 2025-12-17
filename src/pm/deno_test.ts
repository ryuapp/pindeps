import { assertEquals } from "@std/assert";
import { parseDenoLock } from "./deno.ts";
import denoLock from "../../testdata/polyrepo/deno.lock" with { type: "text" };
import jsrNpmDenoLock from "../../testdata/deno/deno.lock" with {
  type: "text",
};
import denoWorkspaceLock from "../../testdata/deno-workspace/deno.lock" with {
  type: "text",
};

Deno.test("parse deno.lock for polyrepo", () => {
  const { versions } = parseDenoLock(denoLock);

  assertEquals(versions.get("jsonc-parser"), "3.3.1");
  assertEquals(versions.get("enogu"), "0.6.2");
  assertEquals(versions.get("@hono/react-compat"), "0.0.3");
  // Deno unsupport peer dependencies
  // assertEquals(versions.get("react"), "19.1.1");
});

Deno.test("parse deno.lock for JSR and npm packages", () => {
  const { versions } = parseDenoLock(jsrNpmDenoLock);

  // JSR package: jsr:@ryu/enogu@~0.6.2
  assertEquals(versions.get("@ryu/enogu"), "0.6.2");

  // npm package: npm:enogu@~0.6.2
  assertEquals(versions.get("enogu"), "0.6.2");
});

Deno.test("parse deno.lock with workspace importers", () => {
  const { versions, importers } = parseDenoLock(denoWorkspaceLock);

  // Global versions
  assertEquals(versions.get("react"), "19.2.3");

  // Workspace-specific versions
  assertEquals(importers.get("packages/react1")?.get("react"), "19.0.3");
  assertEquals(importers.get("packages/react2")?.get("react"), "19.2.3");
});
