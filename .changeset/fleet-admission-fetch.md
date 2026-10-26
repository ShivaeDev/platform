---
"@shivaedev/work-fleet": patch
---

### Fixed

- Serialize daemon fetches of main and retry concurrent ref updates up to three attempts so admission continues when another Git fetch advances main. Other fetch failures still surface.
