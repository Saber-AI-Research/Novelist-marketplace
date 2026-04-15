# Project Overview

## Purpose

Novelist Marketplace is the canonical distribution channel for Novelist plugins. It should be easy for authors to submit plugins, easy for maintainers to review them, and easy for clients to consume a stable machine-readable registry.

## Primary Goals

1. Provide a trustworthy source of plugin metadata and release archives
2. Standardize plugin submission through GitHub PRs
3. Generate a single `registry.json` consumed by both the desktop app and website
4. Keep operational complexity low enough for a small team to maintain

## Primary Actors

- **Plugin author** — submits or updates a plugin
- **Maintainer** — reviews submissions, merges PRs, oversees policy
- **Novelist-app** — fetches registry metadata and installs ZIP releases
- **Novelist-homepage** — builds plugin listing pages from registry data

## Scope

### In Scope

- Plugin folder structure and submission rules
- Manifest validation
- ZIP structure validation
- Category definitions
- Registry generation
- PR validation CI
- Merge/publish workflow

### Out of Scope (for initial versions)

- Ratings and reviews
- Authenticated dashboards for authors
- Runtime plugin analytics beyond simple download counts
- Complex moderation automation beyond basic static checks
- Binary signing infrastructure

## Product Principles

- **Reviewable first**: a maintainer should understand a plugin submission quickly
- **Generated truth**: derived artifacts should be built from submitted source files
- **Static-friendly**: metadata and releases should be hostable through GitHub primitives
- **Stable contracts**: IDs, versioning, and schema evolution should be conservative
- **CJK aware**: categories and public metadata should support multilingual naming

## Success Criteria

- A maintainer can review a standard plugin submission in a few minutes
- The app can install a plugin using only `registry.json` and the release ZIP URL
- The homepage can build plugin index and detail pages from the same registry data
- Schema or packaging mistakes are caught before merge by CI
