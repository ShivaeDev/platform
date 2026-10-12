### Added

- `@shivaedev/effect-react/router.ts` exports `loadQuery(registry, atom, loaderContext)` for TanStack Router loaders. It reads contract query atoms in the application's shared registry, throws typed failures as their original tagged errors, and releases an aborted loader's subscription. TanStack Router is an optional peer.
