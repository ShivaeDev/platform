---
"@shivaedev/platform": minor
---

### Added

- Declare public client configuration once with `publicConfig(schema)` from `rpc/publicConfig.ts`. Load it at host startup with `publicConfigLayer` from `server/rpc-server/publicConfigLayer.ts` and read the generated contract through native atoms and effect-react's `useQuery`. Only declared fields reach the client; missing or invalid required values fail startup with a typed `ConfigError`.
