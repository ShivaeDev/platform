### Added

- Publish `@shivaedev/effect-react/testing.ts` with `render`, `Rendered`, `eventually` and `expectNoReactWarnings` for happy-dom render tests using native atom registries and test RPC layers. `render` exposes its registry, supports rerendering and releases its root, registry and container on unmount. React DOM and Vitest are optional peers needed by the testing entry.
