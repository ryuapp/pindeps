import { assertEquals } from "@std/assert";
import { parseYarnLock } from "./yarn.ts";
import yarnLock from "../../testdata/polyrepo/yarn.lock" with { type: "text" };
import jsrYarnLock from "../../testdata/jsr/yarn.lock" with { type: "text" };
import yarnWorkspaceLock from "../../testdata/yarn-workspace/yarn.lock" with {
  type: "text",
};

Deno.test("parse yarn.lock for polyrepo", () => {
  const { versions } = parseYarnLock(yarnLock);

  assertEquals(versions.get("jsonc-parser"), "3.3.1");
  assertEquals(versions.get("enogu"), "0.6.2");
  assertEquals(versions.get("@hono/react-compat"), "0.0.3");
  // Yarn unsupport peer dependencies
  // assertEquals(versions.get("react"), "19.1.1");
});

Deno.test("parse yarn.lock for JSR packages", () => {
  const { versions } = parseYarnLock(jsrYarnLock);

  assertEquals(versions.get("@ryu/enogu"), "0.6.2");
});

Deno.test("parse yarn.lock with workspace importers", () => {
  const { versions, importers } = parseYarnLock(yarnWorkspaceLock);

  // Note: Unlike bun/pnpm, yarn doesn't have a single "global" version per package
  // Instead, each dependency range resolves independently
  // versions Map contains the last processed version for each package name
  assertEquals(versions.get("react"), "19.1.4"); // Last processed version

  // Workspace-specific versions
  // Each workspace has its own dependency range that resolves to different versions
  assertEquals(importers.get("packages/react1")?.get("react"), "19.1.4");
  assertEquals(importers.get("packages/react2")?.get("react"), "19.0.3");
  assertEquals(importers.get("packages/react3")?.get("react"), "19.2.3");
});
