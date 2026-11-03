import { describe, it, expect } from "vitest";
import { parseManifestString } from "../scripts/shared/toml.js";

describe("parseManifestString", () => {
  it("parses valid TOML manifest", () => {
    const toml = `
[plugin]
id = "word-frequency"
name = "Word Frequency"
version = "1.0.0"
description = "Analyze word frequency"
author = "alice"
permissions = ["read"]

[ui]
type = "panel"
entry = "index.html"

[marketplace]
repo = "https://github.com/alice/novelist-word-frequency"
category = "analysis"
min_novelist_version = "0.1.0"
`;
    const manifest = parseManifestString(toml);
    expect(manifest.id).toBe("word-frequency");
    expect(manifest.name).toBe("Word Frequency");
    expect(manifest.version).toBe("1.0.0");
    expect(manifest.permissions).toEqual(["read"]);
    expect(manifest.category).toBe("analysis");
  });

  it("parses manifest with optional fields", () => {
    const toml = `
[plugin]
id = "test-plugin"
name = "Test Plugin"
version = "2.0.0"
description = "A test plugin"
author = "bob"
permissions = ["read", "write"]

[marketplace]
repo = "https://github.com/bob/test-plugin"
category = "formatting"
min_novelist_version = "0.2.0"
author_url = "https://github.com/bob"
tags = ["test", "demo"]
`;
    const manifest = parseManifestString(toml);
    expect(manifest.author_url).toBe("https://github.com/bob");
    expect(manifest.tags).toEqual(["test", "demo"]);
  });

  it("throws on invalid TOML", () => {
    expect(() => parseManifestString("not valid toml {{{")).toThrow();
  });

  it("throws on missing required fields", () => {
    const toml = `
[plugin]
id = "test"
name = "Test"
`;
    expect(() => parseManifestString(toml)).toThrow();
  });
});
