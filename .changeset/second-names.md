---
"@shivaedev/quality": minor
"@shivaedev/jobs": minor
"@shivaedev/create-app": minor
"@shivaedev/react": minor
"@shivaedev/work-board": minor
"@shivaedev/work-fleet": minor
---

### Fixed

- Report exported type aliases of imports, value aliases with `typeof` annotations or local const chains, object facades and unchanged forwarding functions, with repairs naming their defining modules. Keep wrappers that transform inputs, add steps, supply defaults or declare overloads.

### Changed

- Generated starters import schedule definitions and the default queue client factory from their defining modules.

### Breaking

- Quality: the gate now rejects imported second names even when they use type aliases, value annotations, object facades or forwarding functions. Import from the defining module and remove the second name; existing facade debt can be recorded at adoption. Import `USAGE` from `cli/messages.ts` instead of `cli/args.ts`.
- Jobs: import `defaultClientFactory` from `@shivaedev/jobs/server/defaultClientFactory.ts` instead of `server/client.ts`. Import `defineSchedule` from `@shivaedev/jobs/server/defineSchedule.ts` instead of `server/definition.ts`. The removed `server/internal/nativeClient.ts` and `server/internal/scheduleDefinition.ts` exports migrate to those same modules as `defaultClientFactory` and `defineSchedule`. The default factory now exposes its native pg-boss return type; type custom factory mocks against `PgBossClient` or `PgBossClientFactory` from `server/client.ts`.
- React: import `resumeSignal`, `ResumeOptions`, `ResumeSource` and `ResumeWindow` from `@shivaedev/contract/resume.ts`; `@shivaedev/react/resumeSignal.ts` is removed.
- Work Board: import `Identity` from `path/Identity.ts`, view state helpers from `browser/views/state.ts`, `isMarkdown` from `path/isMarkdown.ts`, and `processes` from `server/processOwnership.ts`. The forwarding `server/views/state.ts` and `server/integration/processes.ts` modules are removed. Replace the removed `attention` facade with imports of `managedRequestReceipt` from `server/attention/managedRequestReceipt.ts`, `attentionProjection` from `server/attention/projection.ts`, and `RequestReceipt` from `attention/RequestReceipt.ts`. Replace the removed `publication` facade with direct imports from `server/responses/publicationDirectory.ts`. Import `Changes` from `server/files/changes.ts`, `MarkdownFile` from `server/files/list.ts`, `Snapshot` from `server/search/snapshot.ts`, metadata document/model/diagnostic/parsed types from `integration/metadata.ts`, `InboxProjection` from `browser/views/schema.ts` instead of `AttentionProjection`, `SourceFailure` from `diagnostics/source.ts`, and `WorkspaceOptions` from `server/workspace.ts` instead of the integration facades. Metadata types are also removed from `server/metadata/model.ts` and `server/metadata/parse.ts`; import them from `integration/metadata.ts`.
- Work Fleet: import `WAIT_EXIT`, `WaitState`, `WaitOutcome` and `settled` from `host/waitOutcome.ts` instead of `host/wait.ts`; import `fleetRecords` from `fleetRecords.ts` instead of `operations.ts`.
