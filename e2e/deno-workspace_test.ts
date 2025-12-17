import { assertEquals } from "@std/assert";
import { join } from "@std/path/join";
import { resolve } from "@std/path/resolve";
import { $ } from "@david/dax";

const BIN_PATH = resolve("./bin");
const E2E_TEST_DATA_DIR = resolve("./testdata");

// Helper function to copy directory recursively
async function copyDirRecursive(src: string, dest: string): Promise<void> {
  await Deno.mkdir(dest, { recursive: true });

  for await (const entry of Deno.readDir(src)) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory) {
      await copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile) {
      const content = await Deno.readTextFile(srcPath);
      await Deno.writeTextFile(destPath, content);
    }
  }
}

// Helper function to copy test data
async function copyTestData(sourceName: string): Promise<string> {
  const sourceDir = join(E2E_TEST_DATA_DIR, sourceName);
  const tempDir = join(
    Deno.env.get("TMP") || Deno.env.get("TMPDIR") || "/tmp",
    "pindeps-e2e-" + sourceName + "-" + Date.now(),
  );

  await copyDirRecursive(sourceDir, tempDir);
  return tempDir;
}

Deno.test("E2E: Pin deno workspace with package.json and deno.json", async () => {
  const projectDir = await copyTestData("e2e/deno-workspace");

  // Run the CLI
  await $`node ${BIN_PATH}`.cwd(projectDir);

  // Verify packages/react1/package.json was updated
  const packageJsonPath = join(projectDir, "packages/react1/package.json");
  const packageJson = JSON.parse(await Deno.readTextFile(packageJsonPath));
  const reactVersion = packageJson.dependencies["react"] as string;
  assertEquals(/^\d+\.\d+\.\d+$/.test(reactVersion), true);
  assertEquals(reactVersion, "19.0.3");

  // Verify packages/react2/deno.json was updated
  const denoJsonPath = join(projectDir, "packages/react2/deno.json");
  const denoJson = JSON.parse(await Deno.readTextFile(denoJsonPath));
  const reactImport = denoJson.imports["react"] as string;
  assertEquals(reactImport, "npm:react@19.2.3");

  // Cleanup
  await Deno.remove(projectDir, { recursive: true });
});
