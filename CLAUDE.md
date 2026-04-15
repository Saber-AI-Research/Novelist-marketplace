# Novelist Marketplace - Claude Code Instructions

## Project Overview

Novelist Marketplace is the public plugin registry for the Novelist ecosystem.

**Current status**: planning only. This repository is being scaffolded for documentation and implementation planning. Do not assume scripts, CI, or schemas already exist unless they are explicitly added later.

## Mission

- Accept community plugin submissions through GitHub PRs
- Validate manifests and release ZIPs automatically
- Build and publish `registry.json` as the source of truth for the app and website
- Keep the submission pipeline simple, reviewable, and safe

## Planned Tech Stack

- **Repository model**: GitHub repository with PR-based submissions
- **Automation**: GitHub Actions
- **Scripts**: Node.js + TypeScript + pnpm
- **Validation**: schema validation for manifest/registry data, ZIP structure checks
- **Testing**: Vitest for validation/build scripts
- **Data formats**: TOML, JSON, Markdown, ZIP

## Planned Repository Shape

```text
.
├── CLAUDE.md
├── docs/
│   ├── README.md
│   ├── project-overview.md
│   ├── architecture.md
│   ├── registry-spec.md
│   └── roadmap.md
├── plugins/
│   └── <plugin-id>/
│       ├── manifest.toml
│       ├── README.md
│       └── icon.png            # optional, 128x128
├── categories.json
├── registry.json               # generated, DO NOT EDIT
├── scripts/
│   ├── validate.ts
│   ├── build-registry.ts
│   └── shared/
└── .github/
    ├── workflows/
    │   ├── validate-pr.yml
    │   ├── publish.yml
    │   └── update-counts.yml   # daily cron for download counts
    └── PULL_REQUEST_TEMPLATE.md
```

**Note:** This repository stores metadata only — no plugin code or binary assets. Plugin ZIPs are hosted as GitHub Release assets on each plugin author's own repository.

## Planned Core Contracts

- `plugins/<id>/manifest.toml` — plugin metadata submitted by authors
- `plugins/<id>/README.md` — plugin documentation shown to reviewers/users
- `plugins/<id>/icon.png` — plugin icon (optional, 128x128)
- `categories.json` — canonical marketplace categories (10 categories with CJK names)
- `registry.json` — generated index consumed by `Novelist-app` and `Novelist-homepage`

Plugin binaries (`<plugin-id>-<version>.zip`) are hosted on each plugin author's GitHub Releases, not in this repository.

## Working Rules

- `registry.json` should be generated, not edited by hand
- Plugin IDs should be globally unique, stable, and kebab-case
- Plugin releases (on author repos) should be immutable once published
- CI should be the authoritative gate for format validation
- CI fetches and validates plugin ZIPs from authors' GitHub Releases during PR validation
- Review should focus on safety, clarity, and installability — not only schema correctness

## Planned Commands

These are target commands for the future implementation, not commands that exist yet:

```bash
pnpm install
pnpm validate
pnpm build:registry
pnpm test
```

## Integration Points

- **Consumes from authors**: plugin PR submissions
- **Serves to Novelist-app**: `registry.json`, release ZIP download URLs
- **Serves to Novelist-homepage**: `registry.json`, plugin metadata, docs assets
- **Source design doc**: `../Novelist-app/docs/plugin-marketplace-design.md`

## Initial Milestones

1. Finalize repository contracts and contributor workflow
2. Define schema and validation rules for manifests/releases
3. Implement registry build pipeline
4. Add CI for PR validation and publish flow
5. Seed the repository with example plugins
