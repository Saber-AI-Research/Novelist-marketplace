# Registry Specification

## Plugin Directory Contract

Each plugin lives under:

```text
plugins/<plugin-id>/
├── manifest.toml       # Plugin metadata (required)
├── README.md            # Plugin documentation (required)
└── icon.png             # Plugin icon, 128x128 (optional)
```

**Note:** No `releases/` directory. Plugin ZIPs are hosted as GitHub Release assets on the plugin author's own repository.

## `manifest.toml` Fields

### Required

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique plugin identifier, kebab-case |
| `name` | string | Human-readable display name |
| `version` | string | Semantic version (e.g., `1.0.0`) |
| `description` | string | One-line description |
| `author` | string | Author name or handle |
| `repo` | string | GitHub repository URL (e.g., `https://github.com/alice/novelist-word-frequency`) |
| `permissions` | string[] | Required permission tiers: `read`, `write`, `execute`, `ui`, `network`, `clipboard` |
| `category` | string | One of the categories defined in `categories.json` |
| `min_novelist_version` | string | Minimum compatible Novelist version |

### Optional

| Field | Type | Description |
|-------|------|-------------|
| `author_url` | string | Author's homepage or GitHub profile |
| `tags` | string[] | Free-form tags for discoverability |
| `screenshots` | string[] | URLs to screenshot images (in plugin's own repo) |

## `categories.json`

Purpose: canonical category list used by registry generation, app filters, and website filters.

Each category entry includes:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Category identifier |
| `name` | string | English display name |
| `name_zh` | string | Chinese display name |
| `icon` | string | Icon identifier (from Lucide icons) |

### Categories (10 total)

```json
[
  { "id": "analysis",     "name": "Analysis",      "name_zh": "分析",     "icon": "chart" },
  { "id": "formatting",   "name": "Formatting",    "name_zh": "格式",     "icon": "type" },
  { "id": "export",       "name": "Export",         "name_zh": "导出",     "icon": "download" },
  { "id": "productivity", "name": "Productivity",   "name_zh": "效率",     "icon": "zap" },
  { "id": "ui",           "name": "Interface",      "name_zh": "界面",     "icon": "layout" },
  { "id": "language",     "name": "Language",        "name_zh": "语言",     "icon": "globe" },
  { "id": "writing",      "name": "Writing Aids",   "name_zh": "写作辅助", "icon": "pen-tool" },
  { "id": "publishing",   "name": "Publishing",     "name_zh": "出版",     "icon": "book-open" },
  { "id": "theme",        "name": "Themes",         "name_zh": "主题",     "icon": "palette" },
  { "id": "other",        "name": "Other",          "name_zh": "其他",     "icon": "puzzle" }
]
```

## `registry.json`

High-level shape:

```json
{
  "version": 1,
  "updated_at": "ISO-8601 timestamp",
  "plugins": []
}
```

### Plugin Record Fields

Each plugin record includes:

| Field | Source | Description |
|-------|--------|-------------|
| `id` | manifest | Unique identifier |
| `name` | manifest | Display name |
| `version` | manifest | Current version |
| `description` | manifest | One-line description |
| `author` | manifest | Author name |
| `author_url` | manifest | Author homepage (optional) |
| `repo` | manifest | GitHub repository URL |
| `permissions` | manifest | Required permission tiers |
| `category` | manifest | Plugin category |
| `tags` | manifest | Free-form tags (optional) |
| `icon` | directory | Path to icon in marketplace repo |
| `min_novelist_version` | manifest | Minimum app version |
| `downloads` | GitHub API | Total download count (updated daily by cron) |
| `created_at` | git history | First submission date |
| `updated_at` | git history | Last update date |
| `download_url` | derived | GitHub Release asset URL on author's repo |
| `changelog_url` | derived | Link to GitHub Release page for current version |
| `screenshots` | manifest | Array of screenshot image URLs (optional) |

### Example Record

```json
{
  "id": "word-frequency",
  "name": "Word Frequency",
  "version": "1.1.0",
  "description": "Analyze word frequency in your document",
  "author": "alice",
  "author_url": "https://github.com/alice",
  "repo": "https://github.com/alice/novelist-word-frequency",
  "permissions": ["read"],
  "category": "analysis",
  "tags": ["words", "statistics"],
  "icon": "plugins/word-frequency/icon.png",
  "downloads": 1234,
  "min_novelist_version": "0.1.0",
  "created_at": "2024-12-01T00:00:00Z",
  "updated_at": "2025-01-10T00:00:00Z",
  "download_url": "https://github.com/alice/novelist-word-frequency/releases/download/v1.1.0/word-frequency-1.1.0.zip",
  "changelog_url": "https://github.com/alice/novelist-word-frequency/releases/tag/v1.1.0",
  "screenshots": []
}
```

## Versioning Rules

- Plugin versions must use semver
- New GitHub Release per released version
- Existing releases should be treated as immutable
- Registry format version bumped only for breaking contract changes

## Generation Rules

- `registry.json` is derived from `plugins/` metadata, `categories.json`, and GitHub API data
- Missing or invalid plugin entries fail the build (not silently skipped)
- Output ordering is deterministic to minimize noisy diffs
- `download_url` is constructed from `repo` + `version`: `{repo}/releases/download/v{version}/{id}-{version}.zip`
- `changelog_url` is constructed as: `{repo}/releases/tag/v{version}`
- `downloads` is populated from GitHub Releases API download counts
