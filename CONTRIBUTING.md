# Contributing to Novelist Marketplace

## Submitting a Plugin

### Prerequisites

1. Your plugin is developed in its own GitHub repository
2. You have created a GitHub Release with the plugin ZIP as a release asset
3. The ZIP follows the required structure (see below)

### Plugin ZIP Structure

Your ZIP file must be named `<plugin-id>-<version>.zip` and contain:

```
<plugin-id>-<version>.zip
├── manifest.toml       (required)
├── index.js            (command plugins; UI plugins use their declared entry)
└── assets/             (optional)
```

UI plugins must include the file named by `[ui].entry`, which may be a nested
relative path such as `ui/panel.html`. Paths must stay inside the plugin directory.
The parsed manifest in the ZIP must match all submitted plugin, UI, and
marketplace metadata, including permissions.

### Submission Steps

1. Fork this repository
2. Create a directory under `plugins/` with your plugin ID (kebab-case):
   ```
   plugins/<your-plugin-id>/
   ├── manifest.toml
   ├── README.md
   └── icon.png          (optional, 128x128)
   ```
3. Open a Pull Request against `main`
4. CI will automatically validate your submission
5. A maintainer will review and merge

### manifest.toml Format

```toml
[plugin]
id = "your-plugin-id"
name = "Your Plugin Name"
version = "1.0.0"
description = "A brief description of your plugin"
author = "your-github-username"
permissions = ["read"]

# Required for UI plugins. Use type = "file-handler" plus file_extensions
# when the plugin opens a custom file type.
[ui]
type = "panel"
entry = "index.html"
label = "Your Plugin Name"

[marketplace]
repo = "https://github.com/you/your-plugin-repo"
category = "analysis"
min_novelist_version = "0.1.0"
sha256 = "<output of: shasum -a 256 your-plugin-1.0.0.zip>"  # the exact ZIP you released

# Optional (URLs must use https)
author_url = "https://github.com/you"
tags = ["keyword1", "keyword2"]
screenshots = ["https://raw.githubusercontent.com/you/repo/main/screenshot.png"]
```

`[marketplace].status = "draft"` is reserved for repository-owned seed entries
that are not published to `registry.json`. Third-party submissions should omit
it and must provide a release ZIP.

### Available Categories

| ID | Name | 中文名 |
|----|------|--------|
| analysis | Analysis | 分析 |
| formatting | Formatting | 格式 |
| export | Export | 导出 |
| productivity | Productivity | 效率 |
| ui | Interface | 界面 |
| language | Language | 语言 |
| writing | Writing Aids | 写作辅助 |
| publishing | Publishing | 出版 |
| theme | Themes | 主题 |
| other | Other | 其他 |

### Available Permissions

| Permission | Description |
|-----------|-------------|
| `read` | Read document content |
| `write` | Modify document content |
| `ui` | Display UI panels |
| `fs` | Declare filesystem access; the current command sandbox exposes no filesystem API |
| `net` / `network` | Declare network use; the current command sandbox exposes no network API |
| `ai:http` | Declare use of the AI HTTP streaming bridge, subject to host policy |
| `ai:claude-cli` | Declare use of the local Claude CLI bridge, subject to host policy |

### Validation Rules

Your submission will be checked for:

- Valid TOML syntax and required fields
- Plugin ID matches directory name (kebab-case)
- Semver version format
- GitHub Release exists with the correct ZIP asset
- ZIP contains `manifest.toml` and an entry file
- ZIP manifest matches submitted manifest
- Downloaded ZIP at most 5MB; each JavaScript file at most 2MB after decompression; inspected HTML and manifest files at most 5MB each
- No dangerous code patterns (`eval()`, `new Function()`, path traversal)
- Network access declared if used

### Updating a Plugin

To update an existing plugin:

1. Create a new GitHub Release on your repo with the updated ZIP
2. Update `manifest.toml` in your PR with the new version
3. Update `README.md` if needed
4. Open a PR

### Questions?

Open an issue if you need help with your submission.
