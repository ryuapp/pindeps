import { assertEquals } from "@std/assert";
import { getDenoCatalogVersions, pinDenoJsonCatalogs } from "./deno-catalog.ts";

Deno.test("getDenoCatalogVersions maps catalog and named catalog references", () => {
  const versionsByPackage = new Map<string, Map<string, string>>([
    [
      "packages/app/package.json",
      new Map([
        ["enogu", "0.6.2"],
        ["react", "18.3.1"],
      ]),
    ],
    [
      "packages/next/package.json",
      new Map([
        ["react", "19.2.6"],
      ]),
    ],
  ]);

  const result = getDenoCatalogVersions(
    [
      {
        path: "packages/app/package.json",
        json: {
          dependencies: {
            enogu: "catalog:",
            react: "catalog:react18",
          },
        },
      },
      {
        path: "packages/next/package.json",
        json: {
          dependencies: {
            react: "catalog:react19",
          },
        },
      },
    ],
    (path) => versionsByPackage.get(path) ?? new Map(),
  );

  assertEquals(result.catalog.get("enogu"), "0.6.2");
  assertEquals(result.catalogs.get("react18")?.get("react"), "18.3.1");
  assertEquals(result.catalogs.get("react19")?.get("react"), "19.2.6");
});

Deno.test("getDenoCatalogVersions treats catalog:default as the default catalog", () => {
  const result = getDenoCatalogVersions(
    [
      {
        path: "package.json",
        json: {
          dependencies: {
            react: "catalog:default",
          },
        },
      },
    ],
    () => new Map([["react", "19.2.6"]]),
  );

  assertEquals(result.catalog.get("react"), "19.2.6");
  assertEquals(result.catalogs.get("default"), undefined);
});

Deno.test("getDenoCatalogVersions respects dependency type filters", () => {
  const result = getDenoCatalogVersions(
    [
      {
        path: "package.json",
        json: {
          dependencies: {
            react: "catalog:react19",
          },
          devDependencies: {
            clsx: "catalog:dev",
          },
        },
      },
    ],
    () =>
      new Map([
        ["react", "19.2.6"],
        ["clsx", "1.2.1"],
      ]),
    ["devDependencies"],
  );

  assertEquals(result.catalogs.get("dev")?.get("clsx"), "1.2.1");
  assertEquals(result.catalogs.get("react19"), undefined);
});

Deno.test("pinDenoJsonCatalogs pins only referenced catalog entries", () => {
  const denoJson = {
    catalog: {
      enogu: "^0.6.0",
      unused: "^1.0.0",
    },
    catalogs: {
      react18: {
        react: "^18.2.0",
      },
      react19: {
        react: "^19.0.0",
      },
    },
  };

  const result = pinDenoJsonCatalogs(denoJson, {
    catalog: new Map([["enogu", "0.6.2"]]),
    catalogs: new Map([
      ["react18", new Map([["react", "18.3.1"]])],
    ]),
  });

  assertEquals(result.hasChanges, true);
  assertEquals(result.unpinnedCount, 2);
  assertEquals(result.totalCount, 4);
  assertEquals(result.changes, [
    { name: "enogu", oldVersion: "^0.6.0", newVersion: "0.6.2" },
    { name: "react", oldVersion: "^18.2.0", newVersion: "18.3.1" },
  ]);
  assertEquals(denoJson.catalog.enogu, "0.6.2");
  assertEquals(denoJson.catalog.unused, "^1.0.0");
  assertEquals(denoJson.catalogs.react18.react, "18.3.1");
  assertEquals(denoJson.catalogs.react19.react, "^19.0.0");
});
