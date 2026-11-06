---
"@shivaedev/contract": minor
"@shivaedev/react": minor
---

### Added

- `@shivaedev/contract`: Keep successful bound query results for five minutes after their last reader leaves, bounded to 100 idle queries per registry. Reopened queries show stale data immediately while revalidating. Configure `timeToLive` and `capacity` through the registry's `queryRetention` atom or React's `SessionBoundary.queryRetention` prop.
- `@shivaedev/react`: Expose `useQuery().stale` while retained data waits for a fresh result. Session disposal clears all retained results.

### Breaking

- `@shivaedev/contract`: Replace bound queries' per-query `timeToLive` option with the registry's `queryRetention` policy. Move that setting to `SessionBoundary.queryRetention` or set the native `queryRetention` atom in the owning registry. Query execution now ends with the last reader; retained data revalidates on reopening.
- `@shivaedev/react`: Completed route loaders release their execution mount and use the same bounded result retention as component reads. Loaders revisiting a kept result return it immediately; component mounts revalidate while showing that stale value.
