### Added

- A Vite React client bundle and Tailwind theme are served alongside the native client without changing the current pages.
- The `rpc/handlers.ts` module exports `handlers(options: ServerOptions)`, an Effect that reads the Board services and returns the native RPC handler layer, so component tests can use the same handlers with an in-memory Markdown index.
- `http/assets.ts` exports `ASSET_HANDLERS`, the static and bundled asset route/handler pairs used by the Board server.
- The browser helpers `boardRouter()` and `cn(...inputs)` initialize the placeholder router and combine Tailwind classes for later client components.
