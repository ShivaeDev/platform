### Changed

- Changes, Diagnostics, Start, Respond, Handoff and Result render typed Board queries in React. Their URLs load the React shell and require JavaScript; live updates and contextual forms retain their shared native client.
- Board RPC adds `start`, `diagnostics`, `respond`, `handoff` and `result` queries. History responses add a typed `comparison` with source changes and identity limitations.

### Breaking

- Remove the Board HTML `page` RPC and the superseded server renderers for these views. Read documents with `document` and returned-result data with `result`.
