import * as v from "@valibot/valibot";
import { parse as parseJsonc } from "@std/jsonc";
import { parse as parseYaml } from "@std/yaml";

export const jsoncSchema = v.transform(parseJsonc);
export const yamlSchema = v.transform(parseYaml);
