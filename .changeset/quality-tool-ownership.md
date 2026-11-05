---
"@shivaedev/quality": patch
---

### Fixed

- Report incomplete Knip analysis, including throwing tool configs, as one `code/unused` finding with the tool output while the other rules finish.
- Leave skills-tool managed copies, their Claude links and ownership manifests out of lint, formatting and fixes while continuing to check local skills.
