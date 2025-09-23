import { assertEquals } from "@std/assert";
import { parseNpmLock } from "./npm.ts";
import packageLockJson from "../testdata/polyrepo/package-lock.json" with {
  type: "text",
};

Deno.test("parse package-lock.json for polyrepo", () => {
  const versions = parseNpmLock(packageLockJson);

  assertEquals(versions.get("jsonc-parser"), "3.3.1");
  assertEquals(versions.get("enogu"), "0.6.2");
  assertEquals(versions.get("@hono/react-compat"), "0.0.3");
  assertEquals(versions.get("react"), "19.1.1");
});
