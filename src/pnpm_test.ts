import { assertEquals } from "@std/assert";
import { parsePnpmLock } from "./pnpm.ts";
import pnpmLock from "../testdata/polyrepo/pnpm-lock.yaml" with {
  type: "text",
};

Deno.test("parse pnpm-lock.yaml for polyrepo", () => {
  const versions = parsePnpmLock(pnpmLock);

  assertEquals(versions.get("jsonc-parser"), "3.3.1");
  assertEquals(versions.get("enogu"), "0.6.2");
  assertEquals(versions.get("@hono/react-compat"), "0.0.3");
  assertEquals(versions.get("react"), "19.1.1");
});
