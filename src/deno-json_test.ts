import { assertEquals } from "@std/assert";
import { regex } from "arkregex";
import { parseDenoJson, updateDenoJsonContent } from "./deno-json.ts";

Deno.test("parse deno.json", () => {
  const content = `{
  "imports": {
    "@ryu/enogu": "jsr:@ryu/enogu@^0.6.2",
    "enogu": "npm:enogu@^0.6.2"
  }
}`;

  const denoJson = parseDenoJson(content);

  assertEquals(denoJson.imports, {
    "@ryu/enogu": "jsr:@ryu/enogu@^0.6.2",
    "enogu": "npm:enogu@^0.6.2",
  });
});

Deno.test("parse deno.jsonc with comments", () => {
  const content = `{
  // Deno configuration with comments
  "imports": {
    "@ryu/enogu": "jsr:@ryu/enogu@^0.6.2",
    "enogu": "npm:enogu@^0.6.2"
  }
}`;

  const denoJson = parseDenoJson(content);

  assertEquals(denoJson.imports, {
    "@ryu/enogu": "jsr:@ryu/enogu@^0.6.2",
    "enogu": "npm:enogu@^0.6.2",
  });
});

Deno.test("updateDenoJsonContent updates imports correctly", () => {
  const originalContent = `{
  "imports": {
    "@ryu/enogu": "jsr:@ryu/enogu@^0.6.2",
    "enogu": "npm:enogu@^0.6.2"
  }
}
`;

  const denoJson = parseDenoJson(originalContent);
  denoJson.imports = {
    "@ryu/enogu": "jsr:@ryu/enogu@0.6.2",
    "enogu": "npm:enogu@0.6.2",
  };

  const updated = updateDenoJsonContent(originalContent, denoJson);

  assertEquals(
    updated,
    `{
  "imports": {
    "@ryu/enogu": "jsr:@ryu/enogu@0.6.2",
    "enogu": "npm:enogu@0.6.2"
  }
}
`,
  );
});

Deno.test("updateDenoJsonContent preserves comments", () => {
  const originalContent = `{
  // Deno configuration with comments
  "imports": {
    // JSR package for terminal colors
    "@ryu/enogu": "jsr:@ryu/enogu@^0.6.2", // inline comment
    // npm package
    "enogu": "npm:enogu@^0.6.2" // another inline comment
  }
  // End of imports
}
`;

  const denoJson = parseDenoJson(originalContent);
  denoJson.imports = {
    "@ryu/enogu": "jsr:@ryu/enogu@0.6.2",
    "enogu": "npm:enogu@0.6.2",
  };

  const updated = updateDenoJsonContent(originalContent, denoJson);

  assertEquals(
    updated,
    `{
  // Deno configuration with comments
  "imports": {
    // JSR package for terminal colors
    "@ryu/enogu": "jsr:@ryu/enogu@0.6.2", // inline comment
    // npm package
    "enogu": "npm:enogu@0.6.2" // another inline comment
  }
  // End of imports
}
`,
  );
});

Deno.test("updateDenoJsonContent adds new imports", () => {
  const originalContent = `{
  "imports": {
    "@ryu/enogu": "jsr:@ryu/enogu@^0.6.2"
  }
}
`;

  const denoJson = parseDenoJson(originalContent);
  denoJson.imports = {
    "@ryu/enogu": "jsr:@ryu/enogu@0.6.2",
    "enogu": "npm:enogu@0.6.2",
  };

  const updated = updateDenoJsonContent(originalContent, denoJson);
  const parsed = parseDenoJson(updated);

  assertEquals(parsed.imports, {
    "@ryu/enogu": "jsr:@ryu/enogu@0.6.2",
    "enogu": "npm:enogu@0.6.2",
  });
});

Deno.test("updateDenoJsonContent preserves formatting with CRLF", () => {
  const originalContent =
    '{\r\n  "imports": {\r\n    "@ryu/enogu": "jsr:@ryu/enogu@^0.6.2"\r\n  }\r\n}\r\n';

  const denoJson = parseDenoJson(originalContent);
  denoJson.imports = {
    "@ryu/enogu": "jsr:@ryu/enogu@0.6.2",
  };

  const updated = updateDenoJsonContent(originalContent, denoJson);
  const parsed = parseDenoJson(updated);

  assertEquals(parsed.imports, {
    "@ryu/enogu": "jsr:@ryu/enogu@0.6.2",
  });
});

Deno.test("updateDenoJsonContent preserves indentation", () => {
  const originalContent = `{
    "imports": {
        "@ryu/enogu": "jsr:@ryu/enogu@^0.6.2",
        "enogu": "npm:enogu@^0.6.2"
    }
}
`;

  const denoJson = parseDenoJson(originalContent);
  denoJson.imports = {
    "@ryu/enogu": "jsr:@ryu/enogu@0.6.2",
    "enogu": "npm:enogu@0.6.2",
  };

  const updated = updateDenoJsonContent(originalContent, denoJson);

  // Verify values are updated
  const parsed = parseDenoJson(updated);
  assertEquals(parsed.imports, {
    "@ryu/enogu": "jsr:@ryu/enogu@0.6.2",
    "enogu": "npm:enogu@0.6.2",
  });

  // Verify indentation is preserved (4 spaces)
  assertEquals(updated.includes('    "imports"'), true);
});

Deno.test("updateDenoJsonContent preserves all comment types", () => {
  const originalContent = `{
  // Top level comment
  "imports": {
    // Comment before first import

    "@ryu/enogu": "jsr:@ryu/enogu@^0.6.0", // Inline comment 1

    // Comment between imports
    "enogu": "npm:enogu@^0.6.0" // Inline comment 2
    // Comment after last import
  }
  // Bottom level comment
}
`;

  const denoJson = parseDenoJson(originalContent);
  denoJson.imports = {
    "@ryu/enogu": "jsr:@ryu/enogu@0.6.2",
    "enogu": "npm:enogu@0.6.2",
  };

  const updated = updateDenoJsonContent(originalContent, denoJson);

  // Values are updated
  assertEquals(updated.includes("jsr:@ryu/enogu@0.6.2"), true);
  assertEquals(updated.includes("npm:enogu@0.6.2"), true);

  // All comments are preserved
  assertEquals(updated.includes("// Top level comment"), true);
  assertEquals(updated.includes("// Comment before first import"), true);
  assertEquals(updated.includes("// Inline comment 1"), true);
  assertEquals(updated.includes("// Comment between imports"), true);
  assertEquals(updated.includes("// Inline comment 2"), true);
  assertEquals(updated.includes("// Comment after last import"), true);
  assertEquals(updated.includes("// Bottom level comment"), true);

  // Verify no comments are lost
  const commentPattern = regex("//", "g");
  const originalCommentCount =
    (originalContent.match(commentPattern) || []).length;
  const updatedCommentCount = (updated.match(commentPattern) || []).length;
  assertEquals(updatedCommentCount, originalCommentCount);
});

Deno.test("updateDenoJsonContent preserves empty lines and comment-only lines", () => {
  const originalContent = `{
  "imports": {

    // This is a comment-only line
    "@ryu/enogu": "jsr:@ryu/enogu@^0.6.0",

    "enogu": "npm:enogu@^0.6.0"

  }
}
`;

  const denoJson = parseDenoJson(originalContent);
  denoJson.imports = {
    "@ryu/enogu": "jsr:@ryu/enogu@0.6.2",
    "enogu": "npm:enogu@0.6.2",
  };

  const updated = updateDenoJsonContent(originalContent, denoJson);

  // Comment is preserved
  assertEquals(updated.includes("// This is a comment-only line"), true);

  // Values are updated
  const parsed = parseDenoJson(updated);
  assertEquals(parsed.imports?.["@ryu/enogu"], "jsr:@ryu/enogu@0.6.2");
  assertEquals(parsed.imports?.["enogu"], "npm:enogu@0.6.2");
});

Deno.test("updateDenoJsonContent preserves comments when adding new imports", () => {
  const originalContent = `{
  "imports": {
    // JSR package
    "@ryu/enogu": "jsr:@ryu/enogu@^0.6.0" // Main package
  }
}
`;

  const denoJson = parseDenoJson(originalContent);
  denoJson.imports = {
    "@ryu/enogu": "jsr:@ryu/enogu@0.6.2",
    "enogu": "npm:enogu@0.6.2",
  };

  const updated = updateDenoJsonContent(originalContent, denoJson);

  // Original comments are preserved
  assertEquals(updated.includes("// JSR package"), true);
  assertEquals(updated.includes("// Main package"), true);

  // New import is added
  const parsed = parseDenoJson(updated);
  assertEquals(parsed.imports?.["enogu"], "npm:enogu@0.6.2");

  // Values are updated
  assertEquals(parsed.imports?.["@ryu/enogu"], "jsr:@ryu/enogu@0.6.2");
});
