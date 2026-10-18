---
"@shivaedev/effect-react": minor
---

### Added

- `useLoaderQuery(atom, routeLoaderData)` and `LoadedQueryState` expose loaded query data directly and retain the last value during refetches, without an Initial result or per-screen loading branch.
- `useEditor({ ...config, loaded: routeLoaderData })` and `LoadedEditor` provide a defined form and direct query data for loader-backed editors.

### Fixed

- Keep loader queries mounted until a component subscribes or their route owner aborts, so delayed route mounts share the loader's execution. Give SessionBoundary registries the same idle window as atom-react's default registry; unread results are released when their route owner ends.
