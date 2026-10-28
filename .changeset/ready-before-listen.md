---
"@shivaedev/server": patch
"@shivaedev/http": patch
"@shivaedev/create-app": patch
---

### Fixed

- The application host constructs services, handlers and routes before listening, so startup connections are refused until requests can be answered.
- Server and HTTP modules import Node platform modules directly to avoid loading Redis during startup.
- Generated apps import Node platform modules directly, and deployment stories allow enough time for their sequential cold processes without a fixed timeout on each startup health probe.
- Generated deployment processes drop workspace-only source conditions from multiline argument lists so installed package exports run correctly.
