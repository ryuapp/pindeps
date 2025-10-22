import { assertEquals } from "@std/assert";
import { parseBunLock } from "./bun.ts";
import bunLock from "../../testdata/polyrepo/bun.lock" with { type: "text" };

Deno.test("parse bun.lock for polyrepo", () => {
  const versions = parseBunLock(bunLock);

  assertEquals(versions.get("jsonc-parser"), "3.3.1");
  assertEquals(versions.get("enogu"), "0.6.2");
  assertEquals(versions.get("@hono/react-compat"), "0.0.3");
  assertEquals(versions.get("react"), "19.1.1");
});
