# Roadmap

## Built

- Flat YAML changeset mappings with explicit package bumps and grouped Markdown release-note sections.
- Whole-workspace planning with transitive published dependents and the explicit pre-1.0 breaking-change rule.
- Version and changelog collection, reproducible release manifests and typed Effect hooks.
- CLI stories over temporary Git workspaces for planning, apply and validation failures.
- Platform's authoring and release commands use root changesets. The [repository release story](../../../script/release/appliedRelease.spec.ts) proves its config hook aligns starter pins and binary version constants.

## Open questions

- Prerelease and release-channel policy remain outside the stable-version planner.
