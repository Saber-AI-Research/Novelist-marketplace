import { z } from "zod";

export const VALID_PERMISSIONS = [
  "read",
  "write",
  "ui",
  "fs",
  "net",
  "network",
  "ai:http",
  "ai:claude-cli",
] as const;

export const VALID_CATEGORIES = [
  "analysis",
  "formatting",
  "export",
  "productivity",
  "ui",
  "language",
  "writing",
  "publishing",
  "theme",
  "other",
] as const;

const PLUGIN_ID_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const SEMVER_REGEX = /^\d+\.\d+\.\d+$/;

const GITHUB_REPO_REGEX = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/;
const SHA256_REGEX = /^[0-9a-f]{64}$/;

// Registry URLs end up in href/src attributes on the homepage and in the app;
// only https keeps `javascript:` and `data:` URLs out.
const HttpsUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "URL must use https");

const PluginPathSchema = z.string().min(1).refine(
  (path) =>
    !/[\\:\0?#]/.test(path) &&
    path.split("/").every((part) => part !== "" && part !== "." && part !== ".."),
  "Plugin paths must be relative and remain inside the plugin directory",
);

const UiSchema = z.object({
  type: z.enum(["panel", "file-handler"]),
  entry: PluginPathSchema,
  width: z.number().int().positive().optional(),
  label: z.string().min(1).optional(),
  file_extensions: z.array(z.string().regex(/^\.[a-z0-9][\w-]*$/i)).optional(),
  creatable: z.boolean().optional(),
  requires_app_reload: z.boolean().optional(),
}).optional();

const PluginMetaSchema = z.object({
  id: z
    .string()
    .regex(PLUGIN_ID_REGEX, "Plugin ID must be kebab-case (e.g., word-frequency)"),
  name: z.string().min(1, "Name is required"),
  version: z.string().regex(SEMVER_REGEX, "Version must be semver (e.g., 1.0.0)"),
  description: z.string().min(1, "Description is required"),
  author: z.string().min(1, "Author is required"),
  permissions: z.array(z.enum(VALID_PERMISSIONS)).default([]),
  icon: PluginPathSchema.optional(),
});

const MarketplaceMetaSchema = z.object({
  status: z.enum(["published", "draft"]).default("published"),
  repo: z.string().regex(GITHUB_REPO_REGEX, "Repo must be a GitHub URL"),
  category: z.enum(VALID_CATEGORIES),
  min_novelist_version: z
    .string()
    .regex(SEMVER_REGEX, "min_novelist_version must be semver"),
  author_url: HttpsUrlSchema.optional(),
  tags: z.array(z.string()).optional(),
  screenshots: z.array(HttpsUrlSchema).optional(),
  // SHA-256 of the reviewed release ZIP (required for published plugins, see
  // validate.ts). CI checks the downloaded asset against it, so replacing the
  // asset after review is caught. The ZIP's own manifest cannot contain it.
  sha256: z.string().regex(SHA256_REGEX, "sha256 must be 64 lowercase hex characters").optional(),
  });

export const ManifestTomlSchema = z.object({
  plugin: PluginMetaSchema,
  ui: UiSchema,
  marketplace: MarketplaceMetaSchema,
});

export const ManifestSchema = ManifestTomlSchema.transform((raw) => ({
  id: raw.plugin.id,
  name: raw.plugin.name,
  version: raw.plugin.version,
  description: raw.plugin.description,
  author: raw.plugin.author,
  permissions: raw.plugin.permissions,
  icon: raw.plugin.icon,
  ui: raw.ui,
  status: raw.marketplace.status,
  repo: raw.marketplace.repo,
  category: raw.marketplace.category,
  min_novelist_version: raw.marketplace.min_novelist_version,
  author_url: raw.marketplace.author_url,
  tags: raw.marketplace.tags,
  screenshots: raw.marketplace.screenshots,
  sha256: raw.marketplace.sha256,
}));

export type Manifest = z.infer<typeof ManifestSchema>;

export const CategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  name_zh: z.string(),
  icon: z.string(),
});

export type Category = z.infer<typeof CategorySchema>;

export const PluginRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string(),
  author: z.string(),
  author_url: z.string().optional(),
  repo: z.string(),
  permissions: z.array(z.string()),
  category: z.string(),
  tags: z.array(z.string()),
  icon: z.string().nullable(),
  min_novelist_version: z.string(),
  downloads: z.number().int().nonnegative(),
  created_at: z.string(),
  updated_at: z.string(),
  download_url: z.string(),
  sha256: z.string().nullable(),
  changelog_url: z.string(),
  screenshots: z.array(z.string()),
});

export type PluginRecord = z.infer<typeof PluginRecordSchema>;

export const RegistrySchema = z.object({
  version: z.literal(1),
  updated_at: z.string(),
  plugins: z.array(PluginRecordSchema),
});

export type Registry = z.infer<typeof RegistrySchema>;
