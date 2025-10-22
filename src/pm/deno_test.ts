import { assertEquals } from "@std/assert";
import { parseDenoLock } from "./deno.ts";
import denoLock from "../../testdata/polyrepo/deno.lock" with { type: "text" };

Deno.test("parse deno.lock for polyrepo", () => {
  const versions = parseDenoLock(denoLock);

  assertEquals(versions.get("jsonc-parser"), "3.3.1");
  assertEquals(versions.get("enogu"), "0.6.2");
  assertEquals(versions.get("@hono/react-compat"), "0.0.3");
  // Deno unsupport peer dependencies
  // assertEquals(versions.get("react"), "19.1.1");
});
