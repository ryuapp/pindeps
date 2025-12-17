import { assertEquals } from "@std/assert";
import { parsePnpmLock, parsePnpmLockForCatalogs } from "./pnpm.ts";
import pnpmLock from "../../testdata/polyrepo/pnpm-lock.yaml" with {
  type: "text",
};
import pnpmWorkspaceLock from "../../testdata/pnpm-workspace/pnpm-lock.yaml" with {
  type: "text",
};
import jsrPnpmLock from "../../testdata/jsr/pnpm-lock.yaml" with {
  type: "text",
};

Deno.test("parse pnpm-lock.yaml for polyrepo", () => {
  const { versions } = parsePnpmLock(pnpmLock);

  assertEquals(versions.get("jsonc-parser"), "3.3.1");
  assertEquals(versions.get("enogu"), "0.6.2");
  assertEquals(versions.get("@hono/react-compat"), "0.0.3");
  assertEquals(versions.get("react"), "19.1.1");
});

Deno.test("parsePnpmLockForCatalogs - workspace lockfile", () => {
  const result = parsePnpmLockForCatalogs(pnpmWorkspaceLock);

  // Test default catalog (becomes catalog)
  assertEquals(result.catalog?.["enogu"], "0.6.2");

  // Test named catalogs (react18, react19)
  assertEquals(result.catalogs?.["react18"]?.["react"], "18.3.1");
  assertEquals(result.catalogs?.["react19"]?.["react"], "19.1.1");
});

Deno.test("parse pnpm-lock.yaml for JSR packages", () => {
  const { versions } = parsePnpmLock(jsrPnpmLock);

  assertEquals(versions.get("@ryu/enogu"), "0.6.2");
});

Deno.test("parse pnpm-lock.yaml with workspace importers", () => {
  const { versions, importers } = parsePnpmLock(pnpmWorkspaceLock);

  // Global versions map contains versions (last processed value for duplicates)
  assertEquals(versions.get("enogu"), "0.6.2");
  assertEquals(versions.get("clsx"), "1.2.1");

  // Importers should have path-specific versions
  assertEquals(importers.get(".")?.get("enogu"), "0.6.2");
  assertEquals(importers.get(".")?.get("react"), "19.1.1");
  assertEquals(importers.get("apps/api")?.get("react"), "17.0.2");
  assertEquals(importers.get("apps/web")?.get("react"), "18.3.1");
  assertEquals(importers.get("packages/ui")?.get("clsx"), "1.2.1");
  assertEquals(importers.get("packages/ui")?.get("react"), "18.3.1");
});
