import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { Readable } from "node:stream";
import JSZip from "jszip";
import { ZodError } from "zod";
import { parseManifestFile, parseManifestString } from "./shared/toml.js";
import { listPluginDirs, loadCategories } from "./shared/utils.js";
import {
  PLUGINS_DIR,
  CATEGORIES_FILE,
  MAX_ZIP_SIZE,
  MAX_JS_SIZE,
  MAX_AVG_LINE_LENGTH,
  DANGEROUS_PATTERNS,
  REQUIRED_ZIP_FILES,
  ZIP_FETCH_TIMEOUT_MS,
  MAX_ZIP_REDIRECTS,
  ALLOWED_ZIP_HOSTS,
} from "./shared/constants.js";
import type { Manifest } from "./shared/types.js";

interface ValidationError {
  pluginId: string;
  errors: string[];
}

function originalZipEntryName(entry: JSZip.JSZipObject): string {
  return entry.unsafeOriginalName ?? entry.name;
}

function isUnsafeZipPath(name: string): boolean {
  const normalized = name.replace(/\\/g, "/");
  return (
    name.includes("\\") ||
    name.includes("\0") ||
    normalized.startsWith("/") ||
    normalized.startsWith("//") ||
    /^[A-Za-z]:\//.test(normalized) ||
    normalized.split("/").includes("..")
  );
}

function hasNetworkPermission(manifest: Manifest): boolean {
  return (
    manifest.permissions.includes("network") ||
    manifest.permissions.includes("net") ||
    manifest.permissions.includes("ai:http")
  );
}

function isJavaScriptPath(path: string): boolean {
  return /\.(?:c|m)?js$/i.test(path);
}

function isHtmlPath(path: string): boolean {
  return /\.html?$/i.test(path);
}

async function readZipText(entry: JSZip.JSZipObject, maxBytes: number): Promise<string> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  // JSZip uses a legacy readable-stream implementation without async iteration.
  const stream = new Readable().wrap(entry.nodeStream());
  for await (const chunk of stream) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.byteLength;
    if (size > maxBytes) {
      throw new Error(`exceeds ${maxBytes / 1024 / 1024}MB uncompressed limit`);
    }
    chunks.push(bytes);
  }
  return Buffer.concat(chunks, size).toString("utf-8");
}

async function validateJavaScriptEntry(
  entry: JSZip.JSZipObject,
  manifest: Manifest,
): Promise<string[]> {
  const errors: string[] = [];
  const entryName = entry.name;
  let jsContent: string;
  try {
    jsContent = await readZipText(entry, MAX_JS_SIZE);
  } catch (error) {
    return [`${entryName}: ${error}`];
  }

  const lines = jsContent.split("\n");
  if (lines.length > 0) {
    const avgLineLength =
      jsContent.length / lines.length;
    if (avgLineLength > MAX_AVG_LINE_LENGTH) {
      errors.push(
        `${entryName} appears minified/obfuscated (avg line length: ${avgLineLength.toFixed(0)} chars)`,
      );
    }
  }

  for (const pattern of DANGEROUS_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(jsContent)) {
      errors.push(
        `${entryName} contains dangerous pattern: ${pattern.source}`,
      );
    }
  }

  if (!hasNetworkPermission(manifest) && /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b/.test(jsContent)) {
    errors.push(
      `${entryName} contains network access but no network permission ("net", "network", or "ai:http") is declared`,
    );
  }

  return errors;
}

async function validateHtmlEntry(
  entry: JSZip.JSZipObject,
  manifest: Manifest,
): Promise<string[]> {
  const errors: string[] = [];
  const entryName = entry.name;
  let htmlContent: string;
  try {
    htmlContent = await readZipText(entry, MAX_ZIP_SIZE);
  } catch (error) {
    return [`${entryName}: ${error}`];
  }

  for (const pattern of DANGEROUS_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(htmlContent)) {
      errors.push(
        `${entryName} contains dangerous pattern: ${pattern.source}`,
      );
    }
  }

  if (
    !hasNetworkPermission(manifest) &&
    (/\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b/i.test(htmlContent) ||
      /\b(?:src|href)\s*=\s*["']https?:\/\//i.test(htmlContent))
  ) {
    errors.push(
      `${entryName} contains network access but no network permission ("net", "network", or "ai:http") is declared`,
    );
  }

  return errors;
}

async function validateManifest(pluginDir: string, categoryIds?: readonly string[]): Promise<{
  manifest: Manifest | null;
  errors: string[];
}> {
  const manifestPath = join(PLUGINS_DIR, pluginDir, "manifest.toml");
  const readmePath = join(PLUGINS_DIR, pluginDir, "README.md");

  const errors: string[] = [];

  if (!existsSync(manifestPath)) {
    errors.push("Missing manifest.toml");
    return { manifest: null, errors };
  }

  if (!existsSync(readmePath)) {
    errors.push("Missing README.md");
  }

  let manifest: Manifest;
  try {
    manifest = await parseManifestFile(manifestPath);
  } catch (e) {
    if (e instanceof ZodError) {
      for (const issue of e.issues) {
        errors.push(`manifest.toml: ${issue.path.join(".")}: ${issue.message}`);
      }
    } else {
      errors.push(`manifest.toml: Failed to parse TOML: ${e}`);
    }
    return { manifest: null, errors };
  }

  if (manifest.id !== pluginDir) {
    errors.push(
      `manifest.toml: id "${manifest.id}" does not match directory name "${pluginDir}"`,
    );
  }

  const validCategoryIds = categoryIds ?? (await loadCategories(CATEGORIES_FILE)).map((category) => category.id);
  if (!validCategoryIds.includes(manifest.category)) {
    errors.push(
      `manifest.toml: category "${manifest.category}" is not in categories.json`,
    );
  }

  const iconPath = join(PLUGINS_DIR, pluginDir, "icon.png");
  if (existsSync(iconPath)) {
    const iconStat = await stat(iconPath);
    if (iconStat.size > 256 * 1024) {
      errors.push("icon.png exceeds 256KB");
    }
  }

  return { manifest, errors };
}

async function validateZipArchive(
  buffer: ArrayBuffer,
  manifest: Manifest,
): Promise<string[]> {
  const errors: string[] = [];
  if (buffer.byteLength > MAX_ZIP_SIZE) {
    return [`ZIP size exceeds ${MAX_ZIP_SIZE / 1024 / 1024}MB limit`];
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    errors.push("Failed to parse ZIP archive");
    return errors;
  }

  const entries = Object.values(zip.files);
  for (const entry of entries) {
    const originalName = originalZipEntryName(entry);
    if (isUnsafeZipPath(originalName) || isUnsafeZipPath(entry.name)) {
      errors.push(`ZIP contains unsafe path: ${originalName}`);
    }
  }

  for (const requiredFile of REQUIRED_ZIP_FILES) {
    if (!zip.file(requiredFile)) {
      errors.push(`ZIP missing required file: ${requiredFile}`);
    }
  }

  const entryFile = manifest.ui?.entry ?? "index.js";
  if (!zip.file(entryFile)) {
    errors.push(`ZIP missing declared entry file: ${entryFile}`);
  }

  const zipManifestFile = zip.file("manifest.toml");
  if (zipManifestFile) {
    try {
      const zipManifestContent = await readZipText(zipManifestFile, MAX_ZIP_SIZE);
      const zipManifest = parseManifestString(zipManifestContent);

      if (!isDeepStrictEqual(zipManifest, manifest)) {
        errors.push("ZIP manifest.toml does not match submitted manifest (including permissions and UI configuration)");
      }
    } catch (e) {
      errors.push(`ZIP manifest.toml is invalid: ${e}`);
    }
  }

  const scriptEntries = entries.filter((entry) => !entry.dir && isJavaScriptPath(entry.name));
  for (const scriptEntry of scriptEntries) {
    const jsErrors = await validateJavaScriptEntry(scriptEntry, manifest);
    errors.push(...jsErrors);
  }

  const htmlEntries = entries.filter((entry) => !entry.dir && isHtmlPath(entry.name));
  for (const htmlEntry of htmlEntries) {
    const htmlErrors = await validateHtmlEntry(htmlEntry, manifest);
    errors.push(...htmlErrors);
  }

  return errors;
}

function isAllowedZipHost(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.port === "" &&
      parsed.username === "" &&
      parsed.password === "" &&
      ALLOWED_ZIP_HOSTS.some((re) => re.test(parsed.hostname))
    );
  } catch {
    return false;
  }
}

/**
 * Fetch an untrusted plugin ZIP with three guards:
 *  - manual redirects, each hop validated against an allowlist (SSRF),
 *  - a hard timeout, and
 *  - a streaming byte cap (Content-Length first, then a running tally) so the
 *    body never gets fully buffered before the size is known (OOM).
 * Returns the bytes, or null after pushing a human-readable error.
 */
async function fetchZipBounded(zipUrl: string, errors: string[]): Promise<ArrayBuffer | null> {
  let current = zipUrl;
  for (let hop = 0; hop <= MAX_ZIP_REDIRECTS; hop++) {
    if (!isAllowedZipHost(current)) {
      errors.push(`Refusing to fetch plugin ZIP from non-GitHub host: ${current}`);
      return null;
    }
    let response: Response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(ZIP_FETCH_TIMEOUT_MS),
      });
    } catch (e) {
      errors.push(`Failed to fetch ZIP from ${current}: ${e}`);
      return null;
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        errors.push(`Redirect with no Location header while fetching ${current}`);
        return null;
      }
      try {
        await response.body?.cancel();
        current = new URL(location, current).toString();
      } catch (error) {
        errors.push(`Failed to follow ZIP redirect from ${current}: ${error}`);
        return null;
      }
      continue;
    }

    if (!response.ok) {
      errors.push(
        `ZIP not found at ${zipUrl} (HTTP ${response.status}). Ensure a GitHub Release exists with this asset.`,
      );
      return null;
    }

    try {
      // Check the advertised length, then enforce the limit while streaming.
      const declared = Number(response.headers.get("content-length"));
      if (Number.isFinite(declared) && declared > MAX_ZIP_SIZE) {
        await response.body?.cancel();
        errors.push(
          `ZIP size ${(declared / 1024 / 1024).toFixed(1)}MB exceeds ${MAX_ZIP_SIZE / 1024 / 1024}MB limit`,
        );
        return null;
      }

      if (!response.body) {
        const buf = await response.arrayBuffer();
        if (buf.byteLength > MAX_ZIP_SIZE) {
          errors.push(`ZIP size exceeds ${MAX_ZIP_SIZE / 1024 / 1024}MB limit`);
          return null;
        }
        return buf;
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        total += value.byteLength;
        if (total > MAX_ZIP_SIZE) {
          await reader.cancel();
          errors.push(`ZIP size exceeds ${MAX_ZIP_SIZE / 1024 / 1024}MB limit`);
          return null;
        }
        chunks.push(value);
      }
      const out = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return out.buffer;
    } catch (error) {
      errors.push(`Failed to read ZIP from ${current}: ${error}`);
      return null;
    }
  }

  errors.push(`Too many redirects (>${MAX_ZIP_REDIRECTS}) while fetching ${zipUrl}`);
  return null;
}

async function fetchAndValidateZip(
  manifest: Manifest,
): Promise<string[]> {
  const errors: string[] = [];
  const { repo, version, id } = manifest;

  const zipUrl = `${repo}/releases/download/v${version}/${id}-${version}.zip`;

  const buffer = await fetchZipBounded(zipUrl, errors);
  if (!buffer) return errors;

  return validateZipArchive(buffer, manifest);
}

async function validateAll(skipZip = false): Promise<ValidationError[]> {
  const pluginDirs = await listPluginDirs();
  const categoryIds = (await loadCategories(CATEGORIES_FILE)).map((category) => category.id);
  const results: ValidationError[] = [];

  const seenIds = new Set<string>();

  for (const dir of pluginDirs) {
    const { manifest, errors } = await validateManifest(dir, categoryIds);

    if (manifest) {
      if (seenIds.has(manifest.id)) {
        errors.push(`Duplicate plugin ID: ${manifest.id}`);
      }
      seenIds.add(manifest.id);

      if (!skipZip && manifest.status !== "draft") {
        const zipErrors = await fetchAndValidateZip(manifest);
        errors.push(...zipErrors);
      }
    }

    if (errors.length > 0) {
      results.push({ pluginId: dir, errors });
    }
  }

  return results;
}

async function main() {
  const skipZip = process.argv.includes("--skip-zip");

  console.log("Validating plugins...\n");

  const pluginDirs = await listPluginDirs();
  if (pluginDirs.length === 0) {
    console.log("No plugins found in plugins/ directory.");
  }

  console.log(`Found ${pluginDirs.length} plugin(s): ${pluginDirs.join(", ")}\n`);

  const errors = await validateAll(skipZip);

  if (errors.length === 0) {
    console.log("All plugins passed validation.");
    process.exit(0);
  }

  console.error("Validation failed:\n");
  for (const { pluginId, errors: pluginErrors } of errors) {
    console.error(`  ${pluginId}:`);
    for (const err of pluginErrors) {
      console.error(`    - ${err}`);
    }
    console.error();
  }

  process.exit(1);
}

const isMainModule =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  void main();
}

export {
  validateManifest,
  validateZipArchive,
  fetchAndValidateZip,
  validateAll,
  fetchZipBounded,
  isAllowedZipHost,
  isUnsafeZipPath,
  validateJavaScriptEntry,
  validateHtmlEntry,
};
