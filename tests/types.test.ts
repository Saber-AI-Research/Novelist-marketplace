import { describe, it, expect } from "vitest";
import { ManifestSchema } from "../scripts/shared/types.js";

describe("ManifestSchema", () => {
  const validManifest = {
    plugin: {
      id: "word-frequency",
      name: "Word Frequency",
      version: "1.0.0",
      description: "Analyze word frequency",
      author: "alice",
      permissions: ["read"],
    },
    ui: {
      type: "panel",
      entry: "index.html",
      label: "Word Frequency",
    },
    marketplace: {
      repo: "https://github.com/alice/novelist-word-frequency",
      category: "analysis",
      min_novelist_version: "0.1.0",
    },
  };

  it("accepts a valid manifest", () => {
    const result = ManifestSchema.safeParse(validManifest);
    expect(result.success).toBe(true);
  });

  it.each(["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "http://example.com"])(
    "rejects non-https author_url and screenshot URL %s",
    (url) => {
      for (const field of [{ author_url: url }, { screenshots: [url] }]) {
        const result = ManifestSchema.safeParse({ ...validManifest, marketplace: { ...validManifest.marketplace, ...field } });
        expect(result.success).toBe(false);
      }
    },
  );

  it("accepts only a lowercase hex sha256", () => {
    const withHash = (sha256: string) => ManifestSchema.safeParse({ ...validManifest, marketplace: { ...validManifest.marketplace, sha256 } });
    expect(withHash("a".repeat(64)).success).toBe(true);
    expect(withHash("A".repeat(64)).success).toBe(false);
    expect(withHash("a".repeat(63)).success).toBe(false);
  });

  it("accepts a manifest with optional fields", () => {
    const result = ManifestSchema.safeParse({
      ...validManifest,
      marketplace: {
        ...validManifest.marketplace,
        author_url: "https://github.com/alice",
        tags: ["words", "statistics"],
        screenshots: ["https://example.com/screenshot.png"],
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-kebab-case id", () => {
    const result = ManifestSchema.safeParse({
      ...validManifest,
      plugin: {
        ...validManifest.plugin,
        id: "WordFrequency",
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid semver", () => {
    const result = ManifestSchema.safeParse({
      ...validManifest,
      plugin: {
        ...validManifest.plugin,
        version: "1.0",
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-GitHub repo URL", () => {
    const result = ManifestSchema.safeParse({
      ...validManifest,
      marketplace: {
        ...validManifest.marketplace,
        repo: "https://gitlab.com/alice/plugin",
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid permission", () => {
    const result = ManifestSchema.safeParse({
      ...validManifest,
      plugin: {
        ...validManifest.plugin,
        permissions: ["read", "admin"],
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid category", () => {
    const result = ManifestSchema.safeParse({
      ...validManifest,
      marketplace: {
        ...validManifest.marketplace,
        category: "nonexistent",
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = ManifestSchema.safeParse({
      id: "test",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  it("accepts empty permissions array", () => {
    const result = ManifestSchema.safeParse({
      ...validManifest,
      plugin: {
        ...validManifest.plugin,
        permissions: [],
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts all valid permissions", () => {
    const result = ManifestSchema.safeParse({
      ...validManifest,
      plugin: {
        ...validManifest.plugin,
        permissions: ["read", "write", "ui", "fs", "net", "network", "ai:http", "ai:claude-cli"],
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts all valid categories", () => {
    const categories = [
      "analysis", "formatting", "export", "productivity", "ui",
      "language", "writing", "publishing", "theme", "other",
    ];
    for (const category of categories) {
      const result = ManifestSchema.safeParse({
        ...validManifest,
        marketplace: {
          ...validManifest.marketplace,
          category,
        },
      });
      expect(result.success).toBe(true);
    }
  });

  it("normalizes app-compatible TOML shape for registry generation", () => {
    const result = ManifestSchema.parse(validManifest);
    expect(result.id).toBe("word-frequency");
    expect(result.repo).toBe("https://github.com/alice/novelist-word-frequency");
    expect(result.ui?.type).toBe("panel");
    expect(result.status).toBe("published");
  });

  it("accepts draft seed plugins", () => {
    const result = ManifestSchema.safeParse({
      ...validManifest,
      marketplace: {
        ...validManifest.marketplace,
        status: "draft",
      },
    });
    expect(result.success).toBe(true);
  });

  it.each(["../escape.html", "/index.html", "C:/index.html", "ui/../../index.html", "ui\\index.html", "https://example.com/index.html", "ui:panel.html"])(
    "rejects a UI entry outside the supported plugin path format: %s",
    (entry) => {
      expect(ManifestSchema.safeParse({
        ...validManifest,
        ui: { ...validManifest.ui, entry },
      }).success).toBe(false);
    },
  );

  it("preserves app file-handler behavior flags", () => {
    const result = ManifestSchema.parse({
      ...validManifest,
      ui: {
        ...validManifest.ui,
        type: "file-handler",
        file_extensions: [".reader"],
        creatable: false,
        requires_app_reload: true,
      },
    });
    expect(result.ui?.creatable).toBe(false);
    expect(result.ui?.requires_app_reload).toBe(true);
  });
});
