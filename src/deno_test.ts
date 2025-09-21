import { assertEquals } from "@std/assert";
import { parseDenoLock } from "./deno.ts";
import denoLock from "../testdata/deno.lock" with { type: "text" };

Deno.test("deno lock parser", () => {
  const versions = parseDenoLock(denoLock);

  assertEquals(versions.get("jsonc-parser"), "3.3.1");
  assertEquals(versions.get("yaml"), "2.8.1");
  assertEquals(versions.get("@hono/react-compat"), "0.0.3");
  assertEquals(versions.size, 3);
});
