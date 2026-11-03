import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const ROOT_DIR = resolve(__dirname, "../..");
export const PLUGINS_DIR = resolve(ROOT_DIR, "plugins");
export const CATEGORIES_FILE = resolve(ROOT_DIR, "categories.json");
export const REGISTRY_FILE = resolve(ROOT_DIR, "registry.json");

export const MAX_ZIP_SIZE = 5 * 1024 * 1024;
export const MAX_JS_SIZE = 2 * 1024 * 1024;
export const MAX_AVG_LINE_LENGTH = 200;

/** Hard timeout for fetching an (untrusted) plugin ZIP from a release. */
export const ZIP_FETCH_TIMEOUT_MS = 30_000;
/** Max redirect hops we'll follow while fetching a plugin ZIP. */
export const MAX_ZIP_REDIRECTS = 5;
/**
 * Hosts a plugin ZIP download is allowed to live on. GitHub release assets
 * legitimately 302-redirect from github.com to githubusercontent.com / its OSS
 * CDN, so we must follow redirects — but only onto this allowlist, to stop an
 * author from pointing the redirect at an arbitrary (internal) host (SSRF).
 */
export const ALLOWED_ZIP_HOSTS: readonly RegExp[] = [
  /^github\.com$/,
  /(^|\.)githubusercontent\.com$/,
];

export const DANGEROUS_PATTERNS = [
  /\beval\s*\(/,
  /\bnew\s+Function\s*\(/,
  /\.\.\//,
] as const;

export const REQUIRED_ZIP_FILES = ["manifest.toml"] as const;
