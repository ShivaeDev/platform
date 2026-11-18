---
"@shivaedev/create-app": patch
"@shivaedev/server": patch
---

### Changed

- `@shivaedev/server`: In development without an OTLP endpoint, `appHost`, `otlpTracing` and `localTracing()` record traces to `node_modules/.cache/@shivaedev/server/traces.db` in the working directory instead of `.platform/traces.db`, so an application that never added `.platform/` to its ignore file can no longer commit the store. A working directory without a `node_modules` folder records to a folder of the system's temporary directory and logs the file's path at startup. `PLATFORM_TRACE_STORE` and `localTracing({ path })` still choose another file. Delete an existing `.platform/` folder, with `git rm -r --cached .platform` first if it was committed; its ignore entry is no longer needed.
- `@shivaedev/create-app`: The generated `.gitignore` no longer lists `.platform/`.
