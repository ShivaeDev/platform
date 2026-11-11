# Changelog

## 0.1.0 - 2026-11-11

### Added

- The package is published. `appViteConfig` from `@shivaedev/build/adapters/appViteConfig.ts` and `appTestConfig` from `@shivaedev/build/adapters/appTestConfig.ts` give an application its Vite and Vitest configuration with the generator built in: `vite build` and the dev server generate first, and Vitest generates in its global setup before any test file loads.
- `appViteConfig` runs the bundle check by default, so a build whose browser bundle reaches server code fails; its fourth argument names server-only packages with `serverOnly`. An application whose browser still imports old-form contracts or operation files passes `{ bundleCheck: false }`. The option is temporary: it exists for applications still on the old operation form and goes away with that form.
- The `shivaedev-build` command runs from source inside a workspace before any build.
