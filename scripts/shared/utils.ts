import { readdir, readFile } from "node:fs/promises";
import { PLUGINS_DIR } from "./constants.js";
import { CategorySchema, type Category } from "./types.js";

export async function listPluginDirs(): Promise<string[]> {
  const entries = await readdir(PLUGINS_DIR, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

export async function loadCategories(
  filePath: string,
): Promise<Category[]> {
  const content = await readFile(filePath, "utf-8");
  return CategorySchema.array().parse(JSON.parse(content));
}

export function buildDownloadUrl(
  repo: string,
  id: string,
  version: string,
): string {
  return `${repo}/releases/download/v${version}/${id}-${version}.zip`;
}

export function buildChangelogUrl(repo: string, version: string): string {
  return `${repo}/releases/tag/v${version}`;
}
