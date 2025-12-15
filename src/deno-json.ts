import * as v from "@valibot/valibot";
import { parse as parseJsonc } from "@std/jsonc";
import { parse } from "@david/jsonc-morph";

export interface DenoJson {
  imports?: Record<string, string>;
  [key: string]: unknown;
}

const DenoJsonSchema = v.looseObject({
  imports: v.optional(v.record(v.string(), v.string())),
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
  if (!denoJson.imports) {
    return originalContent;
  }

  // Use jsonc-morph to preserve comments and formatting
  const root = parse(originalContent);
  const rootObj = root.asObjectOrForce();

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

  return root.toString();
}
