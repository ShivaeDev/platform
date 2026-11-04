# Changelog

## 0.4.0 - 2026-11-04

### Fixed

- Acknowledge Pi's accepted prompt dispositions, complete handled initial prompts without waiting for a run, and preserve active runs when input is handled or queued.
- Treat prompt rejection before a disposition as refusal and resolution without a disposition as uncertain acceptance.
- Report aborted settlements as interrupted while preserving final assistant failures.

### Breaking

- Require Pi's coding-agent SDK 1.4.0. Consumers must upgrade their `@earendil-works/pi-coding-agent` peer dependency before using this adapter release. Terminal execution events now arrive at `agent_settled`; consumers reading raw `agent_end` events must wait for settlement to determine the run outcome.

## 0.3.1 - 2026-11-04

### Changed

- Require Effect 4.0.7 and its matching companion packages. Install the 4.0.7 Effect stack together.

## 0.3.0 - 2026-11-04

### Added

- Run embedded Pi sessions through the shared agent port, with preflight acceptance, file-backed resume, credential-aware models, distinct follow-up and steering delivery, scoped abort and disposal, and provider event conversion. Keep retrying runs open and preserve unmapped events as raw payloads. The Pi coding-agent SDK is an optional peer; image input and transcript reads remain unsupported.

## 0.2.0 - 2026-11-04

### Breaking

- TypeScript source exports now use `@shivaedev/source` instead of `source`. Replace `source` with `@shivaedev/source` in Node `--conditions`, TypeScript `customConditions`, and Vite/Vitest `resolve.conditions`. Bare `source` selects built JavaScript; no compatibility alias is provided.

## 0.1.0 - 2026-11-03

### Added

- Publish a package skeleton with no API yet.
