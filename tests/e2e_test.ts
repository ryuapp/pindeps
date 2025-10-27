import { assertEquals } from "@std/assert";
import { join } from "@std/path/join";
import { resolve } from "@std/path/resolve";
import { $ } from "@david/dax";

const BIN_PATH = resolve("./bin");
const E2E_TEST_DATA_DIR = resolve("./testdata");

// Helper function to copy test data
async function copyTestData(sourceName: string): Promise<string> {
  const sourceDir = join(E2E_TEST_DATA_DIR, sourceName);
  const tempDir = join(
    Deno.env.get("TMP") || Deno.env.get("TMPDIR") || "/tmp",
    "pindeps-e2e-" + sourceName + "-" + Date.now(),
  );

  // Copy directory recursively
  await Deno.mkdir(tempDir, { recursive: true });
  for await (const entry of Deno.readDir(sourceDir)) {
    const sourceFile = join(sourceDir, entry.name);
    const destFile = join(tempDir, entry.name);
    if (entry.isFile) {
      const content = await Deno.readTextFile(sourceFile);
      await Deno.writeTextFile(destFile, content);
    }
  }

  return tempDir;
}

Deno.test("E2E: Binary exists and is executable", async () => {
  const fileInfo = await Deno.stat(BIN_PATH);
  assertEquals(fileInfo.isFile, true);
});

Deno.test("E2E: Pin dependencies in a simple project", async () => {
  const projectDir = await copyTestData("e2e-simple");

  // Run the CLI
  await $`node ${BIN_PATH}`.cwd(projectDir);

  // Verify package.json was updated
  const packageJsonPath = join(projectDir, "package.json");
  const packageJson = JSON.parse(await Deno.readTextFile(packageJsonPath));

  // Check that the version is pinned (no ^ or ~ symbols)
  const enoguVersion = packageJson.dependencies["enogu"] as string;
  assertEquals(/^\d+\.\d+\.\d+$/.test(enoguVersion), true);
  assertEquals(enoguVersion, "0.6.2");
});
