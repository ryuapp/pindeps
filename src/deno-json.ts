import * as v from "@valibot/valibot";
import { parse as parseJsonc } from "@std/jsonc";
import { parse } from "@david/jsonc-morph";

export interface DenoJson {
  imports?: Record<string, string>;
  catalog?: Record<string, string>;
  catalogs?: Record<string, Record<string, string>>;
  [key: string]: unknown;
}

const DenoJsonSchema = v.looseObject({
  imports: v.optional(v.record(v.string(), v.string())),
  catalog: v.optional(v.record(v.string(), v.string())),
  catalogs: v.optional(v.record(v.string(), v.record(v.string(), v.string()))),
});

export function parseDenoJson(content: string): DenoJson {
  // Parse JSONC (supports both JSON and JSONC)
  const parsed = parseJsonc(content);
  const result = v.safeParse(DenoJsonSchema, parsed);
  if (!result.success) {
    throw new Error(`Invalid deno.json format: ${v.flatten(result.issues)}`);
  }
  return result.output;
}

export function updateDenoJsonContent(
  originalContent: string,
  denoJson: DenoJson,
): string {
  if (!denoJson.imports && !denoJson.catalog && !denoJson.catalogs) {
    return originalContent;
  }

  // Use jsonc-morph to preserve comments and formatting
  const root = parse(originalContent);
  const rootObj = root.asObjectOrForce();

  if (denoJson.imports) {
    // Get or create the imports object
    const importsObj = rootObj.getIfObjectOrForce("imports");

    // Update each import value
    for (const [key, value] of Object.entries(denoJson.imports)) {
      const prop = importsObj.get(key);
      if (prop) {
        // Update existing property
        prop.setValue(value);
      } else {
        // Add new property
        importsObj.append(key, value);
      }
    }
  }

  if (denoJson.catalog) {
    const catalogObj = rootObj.getIfObjectOrForce("catalog");
    for (const [key, value] of Object.entries(denoJson.catalog)) {
      const prop = catalogObj.get(key);
      if (prop) {
        prop.setValue(value);
      } else {
        catalogObj.append(key, value);
      }
    }
  }

  if (denoJson.catalogs) {
    const catalogsObj = rootObj.getIfObjectOrForce("catalogs");
    for (const [catalogName, catalog] of Object.entries(denoJson.catalogs)) {
      const catalogObj = catalogsObj.getIfObjectOrForce(catalogName);
      for (const [key, value] of Object.entries(catalog)) {
        const prop = catalogObj.get(key);
        if (prop) {
          prop.setValue(value);
        } else {
          catalogObj.append(key, value);
        }
      }
    }
  }

  return root.toString();
}
