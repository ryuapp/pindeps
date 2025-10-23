import { DEPENDENCY_TYPES } from "../package-json.ts";
import { updatePackageJsonContent } from "./utils.ts";
import { assertEquals } from "@std/assert";

Deno.test("updatePackageJsonContent updates dependencies correctly", () => {
  const originalContent = `{
    "dependencies": {
      "enogu": "^1.0.0"
    }
  }`;

  const pinnedDeps = {
    dependencies: {
      enogu: "1.0.1",
    },
  };

  const updatedContent = updatePackageJsonContent(
    originalContent,
    pinnedDeps,
    DEPENDENCY_TYPES,
  );

  const expectedContent = `{
    "dependencies": {
      "enogu": "1.0.1"
    }
  }`;

  assertEquals(updatedContent, expectedContent);
});

Deno.test("updatePackageJsonContent updates devDependencies correctly", () => {
  const originalContent = `{
    "devDependencies": {
      "enogu": "~0.6.0"
    }
  }`;

  const pinnedDeps = {
    devDependencies: {
      enogu: "0.6.1",
    },
  };
  const updatedContent = updatePackageJsonContent(
    originalContent,
    pinnedDeps,
    ["devDependencies"],
  );

  const expectedContent = `{
    "devDependencies": {
      "enogu": "0.6.1"
    }
  }`;
  assertEquals(updatedContent, expectedContent);
});
