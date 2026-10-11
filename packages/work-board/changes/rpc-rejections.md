### Breaking

- Replace `ReadFailed` and `ResponseFailed.code` RPC rejections with Platform taxonomy classes. Response and handoff contracts declare `NotFound`, `PreconditionFailed`, `Forbidden`, `Conflict`, `BadRequest`, `ServiceUnavailable` and `InternalServerError`; publication uncertainty and wait deadlines use `PublicationUncertain` and `Unanswered` from `rpc/rejections.ts`, alongside the `ResponseRejection` schema/type and `responseRejections`.
- The document contract declares `NotFound`, `Conflict`, `ServiceUnavailable` and `InternalServerError` through the `documentRejections` object and `DocumentRejection` schema exported by `rpc/rejections.ts`.

### Fixed

- Use Platform’s `rpcBoundary` for handler failures: callers receive a redacted declared rejection while the original cause stays in the server trace without being sent to the client.
