import TOML from "@iarna/toml";
import { readFile } from "node:fs/promises";
import type { Manifest } from "./types.js";
import { ManifestSchema } from "./types.js";

export async function parseManifestFile(filePath: string): Promise<Manifest> {
  const content = await readFile(filePath, "utf-8");
  return parseManifestString(content);
}

export function parseManifestString(content: string): Manifest {
  const raw = TOML.parse(content);
  return ManifestSchema.parse(raw);
}
