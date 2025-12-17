import { assertEquals } from "@std/assert";
import { parseBunLock } from "./bun.ts";
import bunLock from "../../testdata/polyrepo/bun.lock" with { type: "text" };
import bunWorkspaceLock from "../../testdata/bun-workspace/bun.lock" with {
  type: "text",
};

Deno.test("parse bun.lock for polyrepo", () => {
  const { versions } = parseBunLock(bunLock);

  assertEquals(versions.get("jsonc-parser"), "3.3.1");
  assertEquals(versions.get("enogu"), "0.6.2");
  assertEquals(versions.get("@hono/react-compat"), "0.0.3");
  assertEquals(versions.get("react"), "19.1.1");
});

Deno.test("parse bun.lock with workspace importers", () => {
  const { importers } = parseBunLock(bunWorkspaceLock);

  // react1: ">=19.1.0 && <19.2.0" is satisfied by global 19.1.4, so no workspace-specific entry
  assertEquals(importers.get("packages/react1"), undefined);

  // react2: ">=19.0.0 && <19.1.0" cannot be satisfied by global 19.1.4, so has workspace-specific 19.0.3
  assertEquals(importers.get("packages/react2")?.get("react"), "19.0.3");

  // react3: "^19.2.1" cannot be satisfied by global 19.1.4, so has workspace-specific 19.2.3
  assertEquals(importers.get("packages/react3")?.get("react"), "19.2.3");
});
