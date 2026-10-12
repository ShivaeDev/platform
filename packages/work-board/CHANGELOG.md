# Changelog

## 0.12.0 - 2026-10-12

### Added

- Read optional `areas` frontmatter as an array of nonempty code-area labels for Fleet scheduling; retain invalid values with metadata diagnostics.
- `checkBrowserAssets()` in `http/assets.ts` checks the native and React browser assets and logs each missing asset's build hint through Effect at startup. `checkNativeAsset()` retains its native-only check.
- Public `integration/board.ts`, `integration/responses.ts`, `integration/attention.ts`, `integration/diagnostics.ts` and `integration/publication.ts` entry points for headless addons such as Work Fleet, with the existing document reading, response publication, request receipt and diagnostics behavior. `integration/metadata.ts` defines portable metadata types for consumer declarations.
- Add a sidebar and top-bar Inbox with a live count for human-owned open next actions, open questions and Fleet work waiting on a person. Overview links to an Inbox summary; Work cards/tables show Waiting on you without changing recorded status columns. Missing and duplicated IDs remain visible with source links, and ages beyond 48 hours use days. Group Fleet decision sources and their question/response records under a collapsed sidebar section.
- Standalone `kind: question` items accept optional label/description options and a recommended label. Their item pages support option buttons and free-text answers through the opted-in response publisher. An answer removes the question from the Inbox for its exact reviewed source; edits require a new answer and original source bytes stay unchanged. Closed or invalid questions keep readable answer history. Option buttons use equal widths and spacing; the answer form remembers the local author and puts response details behind a toggle.
- Add a Diagnostics view with live native reads of Codex app-server usage windows, one-minute shared GitHub REST/GraphQL limit reads, and optional versioned Fleet health snapshots. Each source reports missing configuration and failures independently; Fleet freshness, concurrency, queues, human blockers and scheduler/capacity observations remain visible.
- Opt-in managed decision requests can be acknowledged by immutable, exact-context `request_receipt` records. Applied receipts require the unique current answer; superseded receipts retire the old request without fabricating a reply. The overview and response surface exclude qualified acknowledged requests while preserving their original source. Authored requests remain source-driven, and receipts grant no execution, acceptance or delivery authority.
- `checkNativeAsset()` in `http/assets.ts` checks bundle availability and logs the missing-bundle warning through Effect.
- `documentBody(document)` reads display prose from the existing registered-question format or the ordinary parsed document body.
- The existing `page/diagrams.ts` and `page/swap.ts` entry points expose the related `diagrams` and `swap` browser script strings together.
- A Vite React client bundle and Tailwind theme are served alongside the native client without changing the current pages.
- The `rpc/handlers.ts` module exports `handlers(options: ServerOptions)`, an Effect that reads the Board services and returns the native RPC handler layer, so component tests can use the same handlers with an in-memory Markdown index.
- `http/assets.ts` exports `ASSET_HANDLERS`, the static and bundled asset route/handler pairs used by the Board server.
- The browser helpers `boardRouter()` and `cn(...inputs)` initialize the placeholder router and combine Tailwind classes for later client components.
- The document query includes optional `reading` context described by the exported `ReadingContext` schema (source lines, frontmatter, backlinks, criterion claims, evidence source links and managed receipts) and optional request `prompts` and `promptUnavailable`. `DocumentView` accepts optional `context` and `introduction` React nodes for the document layout.
- The navigation query includes optional `home` data with the configured board file and its unique identity, so the shell can select its reader without issuing a document query for a home board.
- The native `document` query returns Markdown source, resolved links and references, metadata, source diagnostics, resolved questionnaire answer actions and validated request/response history without rendered HTML or syntax trees. `browser/document/schema.ts` defines the `Document` and `DocumentRequest` schemas; `browser/document/View.ts` exports `DocumentView` and `DocumentViewProps` for React reading with the existing Markdown plugins, client-side Shiki and a Mermaid code override. The existing page continues to use server rendering.
- `document/read.ts` exports `readDocument(options)` and `DocumentOptions` for source reads. `ServerOptions.document` optionally supplies this reader; `render/documentLinks.ts` accepts query-provided targets and exports `resolveDocumentLink`. `codeBlocks` accepts `{ diagrams: false }` to retain Mermaid code for React rendering.
- Defining modules also expose the shared `documentPlugins`, browser `highlightDocument` and `Mermaid` components, and server `documentTargets` and `documentRequests` data helpers.
- `boardRouter(options?)` accepts shell query bindings and bootstrap HTML; its existing no-argument form remains available.
- The native browser entry exposes `remember(element)`, `swap(current, incoming, highlight?)`, `legacyRuntime()` and its `RouterBridge` type to share page reconciliation and the legacy router bridge with the React shell.
- `currentResponses(responses)` selects the latest response per author before applying explicit supersession, using recorded time and response identity to order ties. Managed request acknowledgements use the same selection, so a later answer from one author can close the question while different authors remain competing.

### Changed

- The React shell browser modules ship only inside the prebuilt bundles and are not importable from the package. Keep the router, UI helpers, icons, React atoms and Platform React/form adapters in development dependencies so installing the Board does not install them. The native bundle entry, session, reconciliation and form helpers are also excluded from package exports; the native client, document view and shared schemas remain available. Packed consumers start the command and serve both browser bundles without installing the bundle-only libraries.
- Declare the live subscription through effect-contract and consume its bound native Stream. Native HTTP tests cover filesystem changes refreshing dependent reads through this subscription.
- Diagnostics now reads health, owner waiting counts and rate-limit observations through the Fleet daemon HTTP RPC API, with explicit stopped-daemon state, retry on refresh and preserved health freshness.
- Add `BoardOptions.fleetPort`, the `--fleet-port` CLI option, the `daemonDiagnostics(port)` client, and the shared `DiagnosticsContract`, `DiagnosticsSnapshot`, `DAEMON_PORT` and `DAEMON_RPC_PATH` definitions for the daemon query.
- Document markup places the title, authored status and next action before source context and prose. Source context contains provenance, backlinks and reading tools; its disclosure defaults open at the desktop media query and closed at the narrow query. DOM tests cover this order, disclosure state and a viewport-height CSS placement bound, not measured browser layout or physical devices.
- Item-page controls above the title have scrollable viewport-height caps. Question forms keep the text-column width and start margin; desktop grids allocate excess context height to the prose row. DOM style assertions cover these constraints.
- The exposed rendering helpers accept optional introduction controls: `documentHtml` takes a fourth introduction HTML argument, `metadataHtml` takes a fourth summary flag, and `documentHeadings` takes a title-first flag. Existing arguments remain valid.
- The exposed `itemIntroduction`, `itemContextScript` and `itemStyles` helpers supply the authored summary, responsive disclosure behavior and document layout styles.
- Reading-state snapshots store context disclosure state separately from the existing detail-state array. Live document patches retain disclosure nodes and their open state; navigation and diagram regressions cover restored reading records and mounted details.
- Re-read only changed Markdown paths after each settled watcher batch. Retain unchanged parsed documents and search entries, update dependent metadata diagnostics, and coalesce bursts larger than 256 events into one revision. Watcher recovery checks source bytes while retaining unchanged parses.
- Record questions, responses, handoffs and managed decision receipts on macOS. The no-replace publisher keeps Linux descriptor anchoring and, on macOS, validates canonical paths and directory device/inode identity before and after publishing. Boundary changes found after a link or reconciliation report `Uncertain`, and a missing or replaced write directory is a `Conflict`.
- Render the file sidebar as nested native folders with shared ancestry, keeping home first, logical reference URLs and folder collapse state through live updates.
- Browser form adapters expose `handoffForm`, `responseForm`, `responseFormSchema`, `ResponseSubmission`, `fieldFeedback` and `formOwner`; `responseFields` and `requestAuthor` discover the response controls. `questionnaireControls` now accepts an owner abort signal and no longer validates. `submitResponse` takes a decoded submission and propagates failed saves to the form result. Remove `inputFrom` and `submissionFields`; the form owns decoding and snapshots.
- Run the static handoff, Inbox response and question forms on `@shivaedev/effect-form`. Schema decoding, field messages and captured submissions share the package model; reviewed-context checks and durable drafts retain their existing policy. Form registries and DOM bindings are released on navigation/pagehide and recreated on pageshow.
- Document and item pages render from the typed document query in the React shell, including reading tools, source context and standalone-question answer controls.
- The Board opens as a React shell with TanStack Router and a sidebar rendered from the native navigation query through `effect-react`. Existing pages render in `LegacyMain`, with live updates, reading history and response drafts retained.
- Board route loaders read document and workspace page queries through `effect-react` in the shell's native registry. Preloading shares cached reads with navigation, and the displayed page stays mounted while the next read settles.

### Fixed

- Missing `assets/react.js` and `assets/react.css` return the build command in a plain-text HTTP 500 response, like `assets/native.js`. Building the assets restores serving without restarting the Board.
- Inbox questions and navigation counts include only requests addressed to the maintainer, selected by `--maintainer` (default `maintainer`), and unaddressed standalone questions. Questions for other responders remain available through their item, Responses and Work.
- All native RPC requests require the RPC serialization's content type, including when responses are disabled, through Platform's shared local request guard.
- Inbox ages and order follow current file modification times, including content-preserving touches and index restarts, while unchanged document identities stay reused. Place the sidebar Inbox above recent files and Getting started, and space Clear selection above the answer label.
- Preserve Changes-view control state through live page refreshes so a ready Mark seen action stays available and an overlapping observation keeps its busy state.
- Mark stale Fleet snapshots and dim their counts while displaying the publisher’s observation time. Label Codex windows by duration, show local and relative resets, explain unsupported snapshot versions and API-key account limits, and make Diagnostics available in the header.
- Keep same-origin assets and unrecognized routes in browser navigation instead of intercepting them as reader pages. Preserve native returned-result navigation.
- A missing browser bundle logs its build command once when the Board starts and returns the same message in the bundle's HTTP 500 response. Building the bundle restores serving without restarting the Board.
- The native browser bundle carries a stable Work Board identifier for installed-package verification.
- Registered question packets show the captured document's prose without rendering its front matter as a heading in the React shell, server fallback or native document view. Stored context and reviewed revisions retain the original bytes.
- Open question packets offer an “Answer these questions” action beside the questions when responses are enabled. Static options read as prose, and Inbox question entries open the response form directly.
- Same-document anchor navigation keeps the hosted main node and expanded details in place, including through Back and Forward history.
- Show required author and unanswered prompt messages beside response controls and in the status line, clear corrected warnings, and keep the locally remembered author visible.
- Keep response text, focus and cursor through source updates so typing can continue; retain browser drafts across reloads.
- Show one answer action per question packet on the item page.
- Document render tests await asynchronous Markdown updates without gaps outside React `act`.
- Use Platform’s `rpcBoundary` for handler failures: callers receive a redacted declared rejection while the original cause stays in the server trace without being sent to the client.
- The bound contract subscription declares `InternalServerError` and uses the shared request tracing and redacted handler boundary.
- Retry a file listing when its revision changes during the read, so the search snapshot does not cache an older listing under the newer revision and omit newly registered questions.
- Board validation, agent commands and waits, rendering and host initialization report Schema errors with recovery instructions; page RPC failures retain their declared rejection and message.
- Keep Home, Inbox, Overview, Work, Changes and Diagnostics in fixed sidebar rows. Project files scroll independently and reveal the selected document; recent documents and favorites open in a bounded reading-history dialog. Below 768px, Files opens an overlay drawer with keyboard focus containment, Escape/backdrop dismissal and focus return. The new `page/sidebarScript.ts` module exports `sidebarScript()` to emit the drawer and selected-file scrolling client script.

### Breaking

- Fleet Diagnostics reads version 2 health snapshots and shows separate waiting counts for maintainer, orchestrator and automation.
- The native navigation query takes `{ current: string }` with the selected document path and returns Schema data for the file tree, folder counts, Fleet records and Inbox count. The server sidebar and browser updates render that shared data with the existing layout.
- Replace `ReadFailed` and `ResponseFailed.code` RPC rejections with Platform taxonomy classes. Response and handoff contracts declare `NotFound`, `PreconditionFailed`, `Forbidden`, `Conflict`, `BadRequest`, `ServiceUnavailable` and `InternalServerError`; publication uncertainty and wait deadlines use `PublicationUncertain` and `Unanswered` from `rpc/rejections.ts`, alongside the `ResponseRejection` schema/type and `responseRejections`.
- The document contract declares `NotFound`, `Conflict`, `ServiceUnavailable` and `InternalServerError` through the `documentRejections` object and `DocumentRejection` schema exported by `rpc/rejections.ts`.
- Remove `/_board/search`, `/_board/history` and `/events`. Use the existing search, history and subscription operations at `POST /_board/rpc`.
- Resolve response and handoff methods through the native `Responses` and `HandoffsService` services and provide their Layers with `ResponseConfig`, instead of calling service factories. Document readers use `Responses` from Context instead of `DocumentOptions.responses`. `HandoffsService` lives in `handoffs/Service.ts`.
- Import `Highlighter` from `render/Highlighter.ts` and call its `codeBlocks()` Effect for the rendering plugin. `THEMES` lives in `render/code.ts`.

## 0.11.0 - 2026-10-06

### Added

- Returned-result review combines explicitly linked work/criteria, reported status, evidence and limitations with version-pinned human feedback. Request revision or accept an exact report using existing attention/question directives and immutable responses; no new source schema or writer.
- Native navigation/live review, safe Markdown/Mermaid context and no-JavaScript reading. Changed or moved reports qualify earlier feedback; missing evidence and ambiguous history remain explicit. Recorded Git revisions are not compared with the checkout and authored choices do not establish verified criteria.

## 0.10.0 - 2026-10-06

### Added

- Local Markdown handoffs with reviewed source snapshots, explicit receipt states and a copyable prompt for an existing agent session. Agents acknowledge using ordinary file edits; preparing a handoff does not launch or wake an agent.
- Native RPC preparation/history, draft persistence, safe rich context rendering, no-JavaScript reading and native navigation. Reuse the opt-in Linux file publisher; retries retain receipt rather than creating duplicate direction.

## 0.9.1 - 2026-10-06

### Fixed

- Treat syntactically damaged frontmatter in the published responses/ record namespace as unknown history, including unterminated headers. Do not mistake unreadable feedback for an empty response list or an unanswered deadline. Ordinary Markdown outside that namespace retains its reading compatibility.

## 0.9.0 - 2026-10-06

### Added

- Agent-authored question directives with rich Markdown/Mermaid context, single- and multiple-choice controls, open-text prompts and additional human text. Submit one validated packet through the existing native response/wait path; record optional typed answers alongside a readable Markdown account.
- Explicit superseding responses with linked immutable history. Qualify earlier reviewed contexts and preserve draft text/recovery while clearing selections after a source edit or move. Keep legacy question/response files valid.

### Changed

- Record questions, responses, handoffs and managed decision receipts on macOS. The no-replace publisher keeps Linux descriptor anchoring and, on macOS, validates canonical paths and directory device/inode identity before and after publishing. Boundary changes found after a link or reconciliation report `Uncertain`, and a missing or replaced write directory is a `Conflict`.

- Render response context and history through the existing Markdown pipeline with raw HTML disabled, retaining local strict Mermaid and no-JavaScript source fallback. Resolve template links against the source before recording answers.
- Scope in-memory drafts and their clearing to the workspace as well as persisted storage. Keep existing retention, write opt-in, Linux publisher and wait limits.

## 0.8.0 - 2026-10-06

### Added

- Explicit `--responses` / embedding opt-in for anchored local feedback with separate immutable question/context and response Markdown records. Preserve reviewed revisions and original source bytes; reject stale/conflicting writes and distinguish pending, saved, rejected and uncertain outcomes.
- Browser-local response drafts with a separate 2 MiB workspace bound, 30-day retention since edit, explicit clearing and unavailable/expiry disclosure.
- Native RPC `question`, `response` and per-question `wait` CLI commands, with durable 48-hour registration deadlines, clarification/deferral, late replies, nondestructive reattachment and an explicit next-response cursor. The waiter bundle excludes server/rendering/watchers and transfers only the next reply.

### Changed

- Record questions, responses, handoffs and managed decision receipts on macOS. The no-replace publisher keeps Linux descriptor anchoring and, on macOS, validates canonical paths and directory device/inode identity before and after publishing. Boundary changes found after a link or reconciliation report `Uncertain`, and a missing or replaced write directory is a `Conflict`.

- Keep the default server read-only. The first safe publisher requires Linux directory descriptors, hard-link publication and directory synchronization; other platforms retain reading support. Reference symlinks do not grant writes.
- Block source form actions/frames at the content-security boundary and require native NDJSON for the opted-in command route. Existing readable Markdown, static raw HTML, local visuals and no-JavaScript reading remain supported.

## 0.7.2 - 2026-10-06

### Changed

- Record questions, responses, handoffs and managed decision receipts on macOS. The no-replace publisher keeps Linux descriptor anchoring and, on macOS, validates canonical paths and directory device/inode identity before and after publishing. Boundary changes found after a link or reconciliation report `Uncertain`, and a missing or replaced write directory is a `Conflict`.

- Record the combined reading-workflow review and first named-machine performance observations, keeping representative-reader acceptance and performance budgets explicitly open. Prepare response/write examples for the D2 discussion; no writer or response schema is implemented.
- Add real HTTP regression coverage for embedding beside application routes, preserving Work Board's loopback boundary and scoped server shutdown.

## 0.7.1 - 2026-10-06

### Added

- Useful empty-workspace guidance and persistent getting-started access to copyable project, investigation and agent-result Markdown templates. Read the same page through server-rendered links and native page navigation with Back preservation. Keep source creation in existing editors/agent tools and evidence unrecorded until observed.

### Changed

- Record questions, responses, handoffs and managed decision receipts on macOS. The no-replace publisher keeps Linux descriptor anchoring and, on macOS, validates canonical paths and directory device/inode identity before and after publishing. Boundary changes found after a link or reconciliation report `Uncertain`, and a missing or replaced write directory is a `Conflict`.

- Keep document printing focused on readable content and diagram-source fallback. No document export or portable packet generation is part of this project.

## 0.7.0 - 2026-10-06

### Added

- Read-only metric, progress and authored timeline Markdown directives parsed by `remark-directive` and validated with Effect Schema. Keep Markdown labels/source links, explicit unknown values and native labeled progress with text alternatives. Retain invalid/unsupported source with diagnostics and bound each component to 64 KiB and each timeline to 100 entries. Nested composition remains deferred.
- GitHub NOTE/TIP/IMPORTANT/WARNING/CAUTION callouts, with comparisons remaining ordinary GFM tables. The project brief uses the agreed source conventions.

### Changed

- Record questions, responses, handoffs and managed decision receipts on macOS. The no-replace publisher keeps Linux descriptor anchoring and, on macOS, validates canonical paths and directory device/inode identity before and after publishing. Boundary changes found after a link or reconciliation report `Uncertain`, and a missing or replaced write directory is a `Conflict`.

- Use the same remark parser/directive grammar for legacy board segmentation, rendering and search; remove Satteri. Headings inside directive containers do not become board columns. Keep native live/history ownership and local-only reading without source writes or acceptance inference.

## 0.6.1 - 2026-10-06

### Changed

- Record questions, responses, handoffs and managed decision receipts on macOS. The no-replace publisher keeps Linux descriptor anchoring and, on macOS, validates canonical paths and directory device/inode identity before and after publishing. Boundary changes found after a link or reconciliation report `Uncertain`, and a missing or replaced write directory is a `Conflict`.

- Adopt the `react-markdown` and `remark-gfm` rendering stack on the server, retaining no-JavaScript reading, local links/images, generated heading anchors, scoped footnotes, raw-HTML details and Shiki highlighting. Search uses the same Markdown/GFM processing and heading rules as the reader. Rendering and search plugins now use unified transformers rather than Satteri visitors; Satteri remains only for legacy heading-board source segmentation.
- Configure Mermaid error rendering so parse failures show a local diagnostic/source without inserting Mermaid's global error diagram. Existing local assets, strict rendering and visual inspection remain available.
- Keep the custom step 11 metric/progress/timeline source-format proposal open; the renderer adoption does not settle that authoring contract.

## 0.6.0 - 2026-10-06

### Added

- Serve source-relative PNG, JPEG, GIF and WebP images inside the workspace with loopback guards, resolved-path containment, correct media headers, no caching and a 16 MiB limit. Refuse traversal, escaping file/directory links and active attachment formats. Watch image edits through native reconciliation.
- Add a keyboard image gallery and Mermaid inspection with bounded zoom, a scrollable/fullscreen viewport, local downloads and focus restoration. Explain missing images and failed diagrams; retain Mermaid source without JavaScript.
- Disclose an open preview after source updates and require reopening before saving it. Downloads copy files locally and never write workspace sources.

### Fixed

- Normalize visual controls and refreshed image URLs during reading-state swaps so unchanged images and drawings keep their source context. Existing history baselines remain Markdown-only; image bytes are not added to Mark seen snapshots.

## 0.5.0 - 2026-10-06

### Added

- Add Pause/Resume updates with a bounded pending-hint count and transient, motion-free outlines on changed reading blocks. Resume, reconnect and watcher uncertainty reconcile the workspace without reporting retained reads as fresh.

### Changed

- Record questions, responses, handoffs and managed decision receipts on macOS. The no-replace publisher keeps Linux descriptor anchoring and, on macOS, validates canonical paths and directory device/inode identity before and after publishing. Boundary changes found after a link or reconciliation report `Uncertain`, and a missing or replaced write directory is a `Conflict`.

- Use native Effect RPC, AtomRegistry and effect-contract live/resume support for browser reads and update ownership, bundled locally with esbuild. Preserve server-rendered HTML and ordinary GET links; the compatibility `/events`, search and history endpoints remain available.
- Invalidate affected source documents, stable identities and derived views through both former and current backlinks, board membership, criterion evidence and attention targets. Leave unrelated documents mounted; reconcile fully when paths, delivery or the rebuilt index are uncertain. Sequence numbers detect server-local PubSub loss; they are not a durable replay protocol.

### Fixed

- Prepare the local native browser bundle before standalone and sharded workspace tests, sharing the production build command so fresh CI checkouts can run the browser regressions without a prior package build.
- Refresh missing favorites after navigation-only changes, recreate native client ownership after a persisted pageshow, and retain explicit Mark seen cancellation, clearing and expiry disclosure while automatic updates are paused. Keep one local baseline per workspace, 30-day/2 MiB limits and source files read only.

## 0.4.1 - 2026-10-05

### Fixed

- Let an explicit Mark seen observation finish through background/live refresh and then reconcile current source. Keep newer clearing or another tab's storage changes authoritative so a cancelled observation cannot restore discarded history. Preserve the existing browser-local retention limits.

## 0.4.0 - 2026-10-05

### Added

- Add explicit Changes since seen comparisons with one browser-local baseline per workspace, 30-day expiry, a 2 MiB serialized limit and clearing. Compare source additions/removals, unique-ID moves and recorded field/content changes with escaped old/current source. Keep incomplete, corrupt, expired and oversized history explicit; live updates never silently acknowledge changes. No source writes, server history, cloud sync, inferred authorship or verified acceptance.

- Read explicit per-item attention request lists and expose a local overview for decisions, reviews and blockers with reason, response labels, target links and source provenance. Preserve exact request navigation, search/backlink context, native links and live updates. Keep invalid/ambiguous requests unclassified and incomplete indexes uncounted; closed requests do not imply acceptance. Existing Markdown and arbitrary status/owner fields remain unchanged.

### Fixed

- Include symlinked reference directories outside the workspace in document reading, logical relative links, home selection and search. Watch linked directory edits and rediscover added/retargeted links. Skip broken links, ancestor/cycle traversal, hidden entries and dependencies; standalone file symlinks still cannot escape their containing workspace/reference directory. Reference files are read only.

## 0.3.0 - 2026-10-04

### Changed

- Record questions, responses, handoffs and managed decision receipts on macOS. The no-replace publisher keeps Linux descriptor anchoring and, on macOS, validates canonical paths and directory device/inode identity before and after publishing. Boundary changes found after a link or reconciliation report `Uncertain`, and a missing or replaced write directory is a `Conflict`.

- Breaking: no root entry and no module that re-exports another. `exports` maps one `"./*.ts"` pattern to every module (`src` under the `source` condition, `dist` otherwise), so you import the module that defines a name, and a bundler sees only the modules you use. Where each name now lives:
  - `@shivaedev/work-board`: `@shivaedev/work-board/board.ts` (`BoardOptions`, `boardLayer`)

### Added

- Add source backlinks for explicit relationships, board membership, criterion evidence, local evidence sources, and Markdown hyperlinks, including plain files. Reuse the existing parse/index and disclose incomplete references. Associate criterion claims across files and link directly to their records; show missing claims, origin lines, retained old revisions, and missing local Markdown sources without implying verified acceptance. Decision options and rationale stay ordinary Markdown; source files remain unchanged.

- Add a table layout sharing board projections, filters, sorting, and selected source detail. Switch layouts without losing URL context and read/filter tables without JavaScript. Save, update, reopen, remove, or clear up to 10 local named views per workspace; reject unsafe destinations and disclose unavailable storage. Keep saved filters separate from URL item selection and never silently evict a saved view at capacity. Source Markdown stays unchanged.

- Add Work board selection and explicit shared-item projections, exact status/ owner filters, text matching, and sorting. URL state restores board/filter/ selected detail context; source Markdown stays readable in a side pane. Disclose missing/ambiguous memberships and selections, retain filters and focused unsent search through live updates, and keep native links/GET filters usable without JavaScript. Existing heading boards remain unchanged.

- Read optional YAML frontmatter for stable item identity, explicit work fields, relationships, board membership, criteria, and recorded evidence provenance. Keep ordinary Markdown/heading boards valid, retain unknown source metadata, and disclose malformed fields, duplicate IDs, and unresolved references. Rebuild identities from the existing local index; identity links survive file and heading renames, and criterion search opens its source context. Recorded outcomes remain distinct from independently verified acceptance.
- Show source lines in search results and preserve reading state when an item moves. Keep passage focus when a search result targets the active document.

- Add local workspace search with document, heading, and passage results, snippets, keyboard navigation, and a command dialog for existing view controls. Rebuild the in-memory index after file changes, disclose unreadable files, and prevent older search responses from replacing newer queries.

- Add heading passage links and an outline, in-place document navigation with back/forward reading-state restoration, workspace-scoped favorites and recents, active document titles, and readable missing-document/passage states.
- Resolve Markdown links relative to the source file, including nested home files served at `/`. Ignore stale page responses after navigation and render cached diagrams using the current theme.
- Add the first workspace shell: a collapsible file sidebar, file location, responsive board columns, readable documents, and keyboard skip navigation. Remember theme, density, and sidebar choices per folder and server origin; code highlighting and diagrams follow the selected theme. Controls remain usable when browser storage is unavailable.

- Add a step-by-step delivery plan for the vision, with 26 bounded implementation steps, dependencies, acceptance evidence, and explicit design gates before richer source formats, mutations, agent handoffs, and external integrations.

- Document the local Work Board north star, three-wave roadmap, experience design, and interactive vision mockups with desktop and mobile captures. The package README links to the proposed direction separately from its current behavior.

## 0.2.1 - 2026-10-04

### Changed

- Record questions, responses, handoffs and managed decision receipts on macOS. The no-replace publisher keeps Linux descriptor anchoring and, on macOS, validates canonical paths and directory device/inode identity before and after publishing. Boundary changes found after a link or reconciliation report `Uncertain`, and a missing or replaced write directory is a `Conflict`.

- Imports that leave their folder go through `#` aliases declared in the `imports` field of `package.json`: `#*.ts` resolves to `src` under the `source` condition and to `dist` otherwise, and `#test/*` names a test file. The published modules and declarations name the package's own files through these aliases. `boardLayer` declares its error and service types, unchanged, so its declaration imports every module through an alias that a NodeNext consumer resolves.

- Consolidate duplicate test cases around observable package behavior.

- Validate packed consumers and executable bins through the shared workspace gate.

- Build with the `@shivaedev/quality` tsconfig presets, which target ESNext and allow only erasable TypeScript syntax.

- Type-check with TypeScript 7 only. TypeScript 6 still builds the package.

- Lint and format with the `@shivaedev/quality` Biome preset through `quality lint` at the repository root, which replaces the package's `check` script.

- Run tests through the `@shivaedev/quality` Vitest projects, which take a test's environment from its file name. Type tests are named `*.typecheck.test.ts`.

- Keep `package.json` in sort-package-json key order, checked by `quality lint`.

## 0.2.0 - 2026-09-28

### Changed

- Record questions, responses, handoffs and managed decision receipts on macOS. The no-replace publisher keeps Linux descriptor anchoring and, on macOS, validates canonical paths and directory device/inode identity before and after publishing. Boundary changes found after a link or reconciliation report `Uncertain`, and a missing or replaced write directory is a `Conflict`.

- Add `@effect/platform-node-shared` as a peer dependency pinned to the same exact version as the `effect` and `@effect/platform-node` peers, so an install holds one copy of Effect. An application that embeds `boardLayer` and already depends on the Effect stack adds `@effect/platform-node-shared` at that version; pnpm, npm and Bun install it otherwise.

### Fixed

- Pin `@effect/platform-node-shared` to the `effect` version, so the `work-board` command starts after a fresh install. Before, `@effect/platform-node` resolved a newer `@effect/platform-node-shared` prerelease than its `effect`, and the command crashed on start importing modules that `effect` lacks.

## 0.1.0 - 2026-09-26

### Added

- Add the `work-board` command: `work-board <dir> [--port 4747] [--home <file>]` serves every markdown file under a folder on 127.0.0.1 from one long-lived process, with a top bar listing them and how long ago each changed. Files and folders below it starting with a dot and `node_modules` are never entered, the folder itself may be a dot folder, paths and symlinks leading outside the folder are never served, requests whose `Host` header is not a loopback host are refused, and a missing `--home` file stops the command with an error.
- Pages render GitHub Flavored Markdown on the server with raw HTML allowed, including `<details>` blocks with markdown inside, and highlight fenced code with Shiki in light and dark. Mermaid diagrams are drawn in the browser from the installed package, only on pages that have one, into reserved space and without ever showing their source while drawing; they follow the colour scheme, and a diagram that does not parse shows its source and the error.
- The `--home` file is shown at `/` as a board: `##` sections, `###` items, a footer after a `---` that follows the last heading, and a count per section derived from its items. Reference links and footnotes work inside cards.
- Pages update in place: the server watches the folder recursively and pushes the changed markdown paths over server-sent events at `/events`, and the page replaces only the changed blocks without reloading, keeping which `<details>` are open, every drawn diagram that did not change, and an edited diagram's old drawing until its new one is ready. A refresh that gets no page back keeps the page and says so. A failed watch is restarted, waiting longer after each failure, while pages show "reconnecting" and then catch up. Ctrl-C stops the command at once, even with pages open.
- Add `boardLayer`, the router Layer the command serves, for embedding the board in another Effect HTTP server or as a fetch handler.
