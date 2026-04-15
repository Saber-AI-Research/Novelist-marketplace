# Roadmap

## Phase 0 — Planning

- Finalize repository purpose and scope
- Confirm initial manifest fields and registry contract
- Define contribution and review workflow

## Phase 1 — Repository Bootstrap

- Initialize Node.js + TypeScript project tooling
- Add formatting, linting, and test baseline
- Create initial folder structure and placeholder data files

## Phase 2 — Validation Pipeline

- Implement manifest schema validation
- Implement ZIP structure checks
- Add CI job for PR validation
- Document contributor requirements clearly

## Phase 3 — Registry Generation

- Implement `build-registry` script
- Generate deterministic `registry.json`
- Add publish workflow on merge
- Expose stable raw URLs for consumers

## Phase 4 — Ecosystem Integration

- Seed with example plugins
- Validate consumption from `Novelist-app`
- Validate build-time ingestion from `Novelist-homepage`
- Refine category taxonomy and metadata rules

## Later Enhancements

- richer safety scanning
- download statistics pipeline
- changelog extraction
- author experience improvements
