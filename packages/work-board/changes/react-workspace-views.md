### Added

- Native `workContract` projection queries: `board` and `work` take `{ url }`; `overview` and `inbox` take no payload. Their typed results carry source data, validated membership and explicit unavailable states, without page HTML.
- Portable `BoardProjection`, `WorkProjection`, `OverviewProjection` and `InboxProjection` schemas and types in `browser/views/schema.ts`, with shared `State`, `stateOf`, `viewUrl` and `fieldFilter` exports in `browser/views/state.ts`. The existing server URL-state exports remain compatible.
- `DocumentView` accepts optional `board` section counts to render source Markdown as a heading board with the shared reading plugins.

### Changed

- The configured home board, Work board/table with filters and selected detail, Overview and Inbox render in React from projection queries. Existing URLs, saved local views, inline answers and live updates use the shared query registry. Home reads retain targeted invalidation and change highlighting; visual previews refresh and diagram drawings return with Back navigation.

### Fixed

- Opening the current projection URL uses its typed query, including when retrying a failed view. Overview and Inbox keep their payload-free calls.
