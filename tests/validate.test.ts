import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PLUGINS_DIR, CATEGORIES_FILE } from "../scripts/shared/constants.js";
import { parseManifestFile } from "../scripts/shared/toml.js";
import { listPluginDirs, loadCategories } from "../scripts/shared/utils.js";

describe("example plugins validation", () => {
  it("plugins directory exists", () => {
    expect(existsSync(PLUGINS_DIR)).toBe(true);
  });

  it("categories.json exists and is valid", async () => {
    expect(existsSync(CATEGORIES_FILE)).toBe(true);
    const categories = await loadCategories(CATEGORIES_FILE);
    expect(categories.length).toBe(10);
    for (const cat of categories) {
      expect(cat.id).toBeTruthy();
      expect(cat.name).toBeTruthy();
      expect(cat.name_zh).toBeTruthy();
      expect(cat.icon).toBeTruthy();
    }
  });

  it("lists example plugin directories", async () => {
    const dirs = await listPluginDirs();
    expect(dirs).toContain("word-frequency");
    expect(dirs).toContain("pomodoro-timer");
  });

  it("word-frequency manifest is valid", async () => {
    const manifest = await parseManifestFile(
      join(PLUGINS_DIR, "word-frequency", "manifest.toml"),
    );
    expect(manifest.id).toBe("word-frequency");
    expect(manifest.category).toBe("analysis");
  });

  it("pomodoro-timer manifest is valid", async () => {
    const manifest = await parseManifestFile(
      join(PLUGINS_DIR, "pomodoro-timer", "manifest.toml"),
    );
    expect(manifest.id).toBe("pomodoro-timer");
    expect(manifest.category).toBe("productivity");
  });

  it("plugin IDs match directory names", async () => {
    const dirs = await listPluginDirs();
    for (const dir of dirs) {
      const manifestPath = join(PLUGINS_DIR, dir, "manifest.toml");
      if (existsSync(manifestPath)) {
        const manifest = await parseManifestFile(manifestPath);
        expect(manifest.id).toBe(dir);
      }
    }
  });

  it("plugin categories are valid", async () => {
    const categories = await loadCategories(CATEGORIES_FILE);
    const validIds = categories.map((c) => c.id);
    const dirs = await listPluginDirs();

    for (const dir of dirs) {
      const manifestPath = join(PLUGINS_DIR, dir, "manifest.toml");
      if (existsSync(manifestPath)) {
        const manifest = await parseManifestFile(manifestPath);
        expect(validIds).toContain(manifest.category);
      }
    }
  });

  it("each plugin has a README.md", async () => {
    const dirs = await listPluginDirs();
    for (const dir of dirs) {
      const readmePath = join(PLUGINS_DIR, dir, "README.md");
      expect(existsSync(readmePath)).toBe(true);
    }
  });
});
