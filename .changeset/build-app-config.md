---
"@shivaedev/build": minor
"@shivaedev/quality": minor
"@shivaedev/create-app": patch
---

### Added

- `@shivaedev/build`: The package is published. `appViteConfig` from `@shivaedev/build/adapters/appViteConfig.ts` and `appTestConfig` from `@shivaedev/build/adapters/appTestConfig.ts` give an application its Vite and Vitest configuration with the generator built in: `vite build` and the dev server generate first, and Vitest generates in its global setup before any test file loads.
- `@shivaedev/build`: `appViteConfig` runs the bundle check by default, so a build whose browser bundle reaches server code fails; its fourth argument names server-only packages with `serverOnly`. An application whose browser still imports old-form contracts or operation files passes `{ bundleCheck: false }`. The option is temporary: it exists for applications still on the old operation form and goes away with that form.
- `@shivaedev/build`: The `shivaedev-build` command runs from source inside a workspace before any build.

### Breaking

- `@shivaedev/quality`: `appViteConfig` and `appTestConfig` are removed. Add `@shivaedev/build` as a development dependency and import them from `@shivaedev/build/adapters/appViteConfig.ts` and `@shivaedev/build/adapters/appTestConfig.ts`; their arguments are unchanged. An application still on the old operation form passes `{ bundleCheck: false }` as the fourth argument of `appViteConfig` until its browser imports only generated clients.

### Changed

- `@shivaedev/create-app`: Generated apps take their Vite and Vitest configuration from `@shivaedev/build`, gain `generate` and `prepare` scripts so `pnpm install` writes `src/generated`, generate before `pnpm typecheck` and `pnpm dev`, and keep `src/generated` out of Git except its README. The packed template never contains generated files.
