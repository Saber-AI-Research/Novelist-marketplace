# Architecture

## Repository Layout

```text
Novelist-marketplace/
├── plugins/
│   └── <plugin-id>/
│       ├── manifest.toml      # Plugin metadata
│       ├── README.md           # Plugin documentation
│       └── icon.png            # Plugin icon (128x128, optional)
├── categories.json             # Category definitions with CJK names
├── registry.json               # Generated master index (DO NOT EDIT)
├── CONTRIBUTING.md             # Submission guide for plugin authors
├── scripts/
│   ├── validate.ts             # CI: validate manifest + fetch & validate ZIP from release
│   ├── build-registry.ts       # CI: rebuild registry.json + fetch download counts
│   └── shared/                 # Shared utilities
├── .github/
│   ├── workflows/
│   │   ├── validate-pr.yml     # Auto-validate plugin submissions
│   │   ├── publish.yml         # Rebuild registry.json on merge + trigger homepage
│   │   └── update-counts.yml   # Daily cron: update download counts via GitHub API
│   └── PULL_REQUEST_TEMPLATE.md
└── package.json
```

**Key design principle:** This repository stores **metadata only** — no plugin code or binary assets. Plugin ZIPs are hosted as GitHub Release assets on each plugin author's own repository.

## Data Flow

1. Author develops plugin in their own GitHub repository
2. Author creates a GitHub Release with the plugin ZIP as a release asset
3. Author opens PR to this repo with `plugins/<id>/manifest.toml` + `README.md`
4. CI validates manifest format, fetches ZIP from the author's GitHub Release, validates ZIP structure and contents
5. Maintainer reviews permissions, docs quality, and safety concerns
6. Merge to main triggers registry rebuild
7. Published `registry.json` becomes the machine-readable source for app and homepage
8. `repository_dispatch` event triggers Novelist-homepage rebuild

## Plugin Distribution Model

Plugin binaries are distributed via **GitHub Releases on the plugin author's repository**, not stored in this git repo. This avoids:
- Git history bloat from binary files
- Rate limiting on `raw.githubusercontent.com`
- Meaningless binary diffs in PRs

The `download_url` in `registry.json` points to:
```
https://github.com/<author>/<plugin-repo>/releases/download/v<version>/<plugin-id>-<version>.zip
```

GitHub Release assets provide CDN delivery, native download counts, and caching headers.

## Download Counting

Download counts are populated automatically via a daily cron job (`update-counts.yml`):
1. For each plugin in `registry.json`, query the GitHub API for release asset download counts
2. Sum `download_count` across all release assets for each plugin
3. Update the `downloads` field in `registry.json`
4. Commit and trigger homepage rebuild

This requires only a `GITHUB_TOKEN` with public repo read access. Zero cost, zero infrastructure.

## Validation Layers

### Repository-Level

- Required top-level files exist
- Duplicate plugin IDs are rejected
- Directory naming matches plugin IDs (kebab-case)

### Manifest-Level

- Required metadata fields present
- Semantic version format valid
- Minimum Novelist version valid
- Permissions and category values in allowed sets

### Release-Level (CI fetches ZIP from author's GitHub Release)

- GitHub Release exists at the declared `repo` + `version`
- ZIP contains `manifest.toml`
- ZIP contains the declared `[ui].entry`, or `index.js` for command plugins
- Parsed manifest inside ZIP matches all submitted plugin, UI, and marketplace metadata
- Archive size below 5MB threshold

### Security Checks (Automated)

- No `eval()`, `new Function()`, or dynamic code generation in JS
- No file system escape patterns (`../`, absolute paths)
- Network access requires `net`, `network`, or `ai:http`
- Each JavaScript file is at most 2MB after decompression; inspected HTML and manifest files are at most 5MB each; downloaded ZIP is at most 5MB
- No minified/obfuscated JavaScript (heuristic: average line length < 200 chars)

### Registry Build-Level

- Entries sorted predictably
- Plugin timestamps come from git history; the registry timestamp records the build time
- Metadata validation failures abort generation

## Security Model

- Marketplace review is advisory, not a full security guarantee
- QuickJS command plugins expose document reads with `read` and replacement with `write`; the command sandbox exposes no filesystem or network API
- UI plugins declare bridge permissions such as `ai:http` and `ai:claude-cli`; access also depends on the app's host policy
- Automated static checks flag dangerous patterns
- Permission declarations are visible during review and in generated registry data
- Built artifacts never require executing arbitrary submission code during CI
- PR template includes a human review checklist

## Cross-Repo Integration

### Triggering Homepage Rebuild

On merge to main, `publish.yml` sends a `repository_dispatch` event:

```yaml
- uses: peter-evans/repository-dispatch@v3
  with:
    token: ${{ secrets.HOMEPAGE_TRIGGER_TOKEN }}
    repository: Saber-AI-Research/Novelist-homepage
    event-type: registry-updated
```

### Consumers

- **Novelist-app**: Fetches `registry.json` at runtime for in-app marketplace
- **Novelist-homepage**: Fetches `registry.json` at build time for plugin browser pages

## Operations Model

- Keep automation deterministic and cheap to run on GitHub Actions
- No database or always-on backend required
- Static artifacts cached by clients
- GitHub Releases as CDN for plugin distribution
- Publish and count-update workflows share a concurrency group to serialize registry writes
- Draft seed entries are validated as metadata and omitted from release downloads and generated registry data
