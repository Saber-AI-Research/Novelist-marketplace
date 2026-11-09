import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { parseManifestFile } from "./shared/toml.js";
import { validateAll } from "./validate.js";
import {
  listPluginDirs,
  buildDownloadUrl,
  buildChangelogUrl,
} from "./shared/utils.js";
import {
  PLUGINS_DIR,
  REGISTRY_FILE,
  ROOT_DIR,
} from "./shared/constants.js";
import { RegistrySchema, type PluginRecord, type Registry } from "./shared/types.js";

function getGitDate(filePath: string, mode: "first" | "last"): string {
  // execFileSync (no shell) so a crafted plugin directory name can't inject.
  const args =
    mode === "first"
      ? ["log", "--diff-filter=A", "--follow", "--format=%aI", "-1", "--", filePath]
      : ["log", "--format=%aI", "-1", "--", filePath];
  try {
    const result = execFileSync("git", args, { cwd: ROOT_DIR, encoding: "utf-8" }).trim();
    return result || new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/** Extract the `rel="next"` URL from a GitHub `Link` pagination header. */
function parseNextLink(link: string | null): string | null {
  if (!link) return null;
  for (const part of link.split(",")) {
    const m = part.match(/<([^>]+)>\s*;\s*rel="next"/);
    if (m) return m[1];
  }
  return null;
}

/**
 * Total download count across ALL release pages for a plugin's ZIP assets.
 * Returns `null` on any fetch failure (rate limit, network, non-OK, parse) so
 * the caller can KEEP the previously-known count instead of overwriting it with
 * a bogus 0 — a transient API hiccup must never zero out a popular plugin.
 */
async function fetchDownloadCount(repo: string, id: string): Promise<number | null> {
  const match = repo.match(/github\.com\/(.+)$/);
  if (!match) return 0; // not a GitHub repo: genuinely no release-asset counts

  let url: string | null = `https://api.github.com/repos/${match[1]}/releases?per_page=100`;
  let total = 0;
  const assetName = new RegExp(`^${id}-\\d+\\.\\d+\\.\\d+\\.zip$`);
  try {
    while (url) {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30_000),
        headers: {
          Accept: "application/vnd.github.v3+json",
          ...(process.env.GITHUB_TOKEN
            ? { Authorization: `token ${process.env.GITHUB_TOKEN}` }
            : {}),
        },
      });

      if (!response.ok) return null;

      const releases = (await response.json()) as Array<{
        assets: Array<{ name: string; download_count: number }>;
      }>;

      for (const release of releases) {
        for (const asset of release.assets) {
          if (assetName.test(asset.name)) {
            if (!Number.isSafeInteger(asset.download_count) || asset.download_count < 0) return null;
            total += asset.download_count;
            if (!Number.isSafeInteger(total)) return null;
          }
        }
      }

      url = parseNextLink(response.headers.get("link"));
    }
    return total;
  } catch {
    return null;
  }
}

/** Map of plugin id -> last-known download count from the committed registry. */
async function loadExistingDownloads(): Promise<Map<string, number>> {
  try {
    const existing = RegistrySchema.parse(JSON.parse(await readFile(REGISTRY_FILE, "utf-8")));
    return new Map(existing.plugins.map((p) => [p.id, p.downloads]));
  } catch {
    return new Map();
  }
}

async function buildRegistry(fetchDownloads = false): Promise<Registry> {
  const validationErrors = await validateAll(true);
  if (validationErrors.length > 0) {
    throw new Error(validationErrors.map(({ pluginId, errors }) =>
      `${pluginId}: ${errors.join("; ")}`,
    ).join("\n"));
  }
  const pluginDirs = await listPluginDirs();
  const plugins: PluginRecord[] = [];

  // Read the previous counts once; used as the baseline and as the fallback
  // when a live fetch fails (so a transient API error can't zero counts out).
  const existingDownloads = await loadExistingDownloads();

  for (const dir of pluginDirs) {
    const manifestPath = join(PLUGINS_DIR, dir, "manifest.toml");

    const manifest = await parseManifestFile(manifestPath);
    if (manifest.status === "draft") continue;

    const iconPath = join(PLUGINS_DIR, dir, "icon.png");
    const hasIcon = existsSync(iconPath);

    const createdAt = getGitDate(manifestPath, "first");
    const updatedAt = getGitDate(manifestPath, "last");

    let downloads = existingDownloads.get(manifest.id) ?? 0;
    if (fetchDownloads) {
      const fetched = await fetchDownloadCount(manifest.repo, manifest.id);
      // Keep the existing baseline on failure (fetched === null).
      if (fetched !== null) downloads = fetched;
    }

    const record: PluginRecord = {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      author: manifest.author,
      author_url: manifest.author_url,
      repo: manifest.repo,
      permissions: [...manifest.permissions],
      category: manifest.category,
      tags: manifest.tags ?? [],
      icon: hasIcon ? `plugins/${dir}/icon.png` : null,
      min_novelist_version: manifest.min_novelist_version,
      downloads,
      created_at: createdAt,
      updated_at: updatedAt,
      download_url: buildDownloadUrl(manifest.repo, manifest.id, manifest.version),
      sha256: manifest.sha256 ?? null,
      changelog_url: buildChangelogUrl(manifest.repo, manifest.version),
      screenshots: manifest.screenshots ?? [],
    };

    plugins.push(record);
  }

  plugins.sort((a, b) => a.id.localeCompare(b.id));

  return {
    version: 1,
    updated_at: new Date().toISOString(),
    plugins,
  };
}

async function main() {
  const fetchDownloads = process.argv.includes("--fetch-downloads");

  console.log("Building registry.json...\n");

  const pluginDirs = await listPluginDirs();
  console.log(`Found ${pluginDirs.length} plugin(s)\n`);

  const registry = await buildRegistry(fetchDownloads);

  const output = JSON.stringify(registry, null, 2) + "\n";
  await writeFile(REGISTRY_FILE, output, "utf-8");

  console.log(`Written registry.json with ${registry.plugins.length} plugin(s)`);
}

const isMainModule =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  void main();
}

export { buildRegistry, fetchDownloadCount };
