import { assertEquals } from "@std/assert";
import { parseNpmLock } from "./npm.ts";
import packageLockJson from "../../testdata/polyrepo/package-lock.json" with {
  type: "text",
};
import jsrNpmPackageLockJson from "../../testdata/jsr-npm/package-lock.json" with {
  type: "text",
};
import npmWorkspaceLock from "../../testdata/npm-workspace/package-lock.json" with {
  type: "text",
};

Deno.test("parse package-lock.json for polyrepo", () => {
  const { versions } = parseNpmLock(packageLockJson);

  assertEquals(versions.get("jsonc-parser"), "3.3.1");
  assertEquals(versions.get("enogu"), "0.6.2");
  assertEquals(versions.get("@hono/react-compat"), "0.0.3");
  assertEquals(versions.get("react"), "19.1.1");
});

Deno.test("parse package-lock.json for JSR packages via npm protocol", () => {
  const { versions } = parseNpmLock(jsrNpmPackageLockJson);

  // The actual package name in node_modules is @jsr/ryu__enogu
  // but it's aliased as @ryu/enogu in package.json
  assertEquals(versions.get("@jsr/ryu__enogu"), "0.6.2");
});

Deno.test("parse package-lock.json with workspace importers", () => {
  const { versions, importers } = parseNpmLock(npmWorkspaceLock);

  // Global version
  assertEquals(versions.get("react"), "19.1.4");

  // Workspace-specific versions
  // react1 uses global 19.1.4 (satisfies >=19.1.0 && <19.2.0), so no workspace entry
  assertEquals(importers?.get("packages/react1"), undefined);

  // react2 has its own version 19.0.3 (satisfies >=19.0.0 && <19.1.0)
  assertEquals(importers?.get("packages/react2")?.get("react"), "19.0.3");

  // react3 has its own version 19.2.3 (satisfies ^19.2.1)
  assertEquals(importers?.get("packages/react3")?.get("react"), "19.2.3");
});
