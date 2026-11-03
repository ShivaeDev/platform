---
"@shivaedev/test-story": minor
---

### Breaking

- Move the React rendering and warning helpers to `@shivaedev/test-story/client/adapters/react.ts`. Replace imports from `@shivaedev/test-story/client/react.ts` with this path.
- Move the DOM environment, member screens and cookie setup into server adapters. Replace `@shivaedev/test-story/server/domEnvironment.config.ts`, `@shivaedev/test-story/server/memberScreens.ts` and `@shivaedev/test-story/server/seedCookies.ts` with the corresponding `@shivaedev/test-story/server/adapters/` paths, including Vitest environment configuration. Story actions and expectations stay the same.
