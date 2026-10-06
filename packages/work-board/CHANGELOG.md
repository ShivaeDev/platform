# Changelog

## Unreleased

### Changed

- Remove document export and shareable artifact/packet generation from the vision
  and delivery scope. Keep onboarding/report templates and linked in-app review.
- Record the approved Platform-first live client direction and its actual shared HTTP/browser fixture evidence; Work Board adopts that foundation in 0.5.0 below.

## 0.9.1 - 2026-10-06

### Fixed

- Treat syntactically damaged frontmatter in the published responses/ record
  namespace as unknown history, including unterminated headers. Do not mistake
  unreadable feedback for an empty response list or an unanswered deadline.
  Ordinary Markdown outside that namespace retains its reading compatibility.

## 0.9.0 - 2026-10-06

### Added

- Agent-authored question directives with rich Markdown/Mermaid context, single-
  and multiple-choice controls, open-text prompts and additional human text.
  Submit one validated packet through the existing native response/wait path;
  record optional typed answers alongside a readable Markdown account.
- Explicit superseding responses with linked immutable history. Qualify earlier
  reviewed contexts and preserve draft text/recovery while clearing selections
  after a source edit or move. Keep legacy question/response files valid.

### Changed

- Render response context and history through the existing Markdown pipeline with
  raw HTML disabled, retaining local strict Mermaid and no-JavaScript source
  fallback. Resolve template links against the source before recording answers.
- Scope in-memory drafts and their clearing to the workspace as well as persisted
  storage. Keep existing retention, write opt-in, Linux publisher and wait limits.

## 0.8.0 - 2026-10-06

### Added

- Explicit `--responses` / embedding opt-in for anchored local feedback with
  separate immutable question/context and response Markdown records. Preserve
  reviewed revisions and original source bytes; reject stale/conflicting writes
  and distinguish pending, saved, rejected and uncertain outcomes.
- Browser-local response drafts with a separate 2 MiB workspace bound, 30-day
  retention since edit, explicit clearing and unavailable/expiry disclosure.
- Native RPC `question`, `response` and per-question `wait` CLI commands, with
  durable 48-hour registration deadlines, clarification/deferral, late replies,
  nondestructive reattachment and an explicit next-response cursor. The waiter
  bundle excludes server/rendering/watchers and transfers only the next reply.

### Changed

- Keep the default server read-only. The first safe publisher requires Linux
  directory descriptors, hard-link publication and directory synchronization;
  other platforms retain reading support. Reference symlinks do not grant writes.
- Block source form actions/frames at the content-security boundary and require
  native NDJSON for the opted-in command route. Existing readable Markdown,
  static raw HTML, local visuals and no-JavaScript reading remain supported.

## 0.7.2 - 2026-10-06

### Changed

- Record the combined reading-workflow review and first named-machine performance
  observations, keeping representative-reader acceptance and performance budgets
  explicitly open. Prepare response/write examples for the D2 discussion; no
  writer or response schema is implemented.
- Add real HTTP regression coverage for embedding beside application routes,
  preserving Work Board's loopback boundary and scoped server shutdown.

## 0.7.1 - 2026-10-06

### Added

- Useful empty-workspace guidance and persistent getting-started access to copyable
  project, investigation and agent-result Markdown templates. Read the same page
  through server-rendered links and native page navigation with Back preservation. Keep source
  creation in existing editors/agent tools and evidence unrecorded until observed.

### Changed

- Keep document printing focused on readable content and diagram-source fallback.
  No document export or portable packet generation is part of this project.

## 0.7.0 - 2026-10-06

### Added

- Read-only metric, progress and authored timeline Markdown directives parsed by
  `remark-directive` and validated with Effect Schema. Keep Markdown labels/source
  links, explicit unknown values and native labeled progress with text alternatives.
  Retain invalid/unsupported source with diagnostics and bound each component to
  64 KiB and each timeline to 100 entries. Nested composition remains deferred.
- GitHub NOTE/TIP/IMPORTANT/WARNING/CAUTION callouts, with comparisons remaining
  ordinary GFM tables. The project brief uses the agreed source conventions.

### Changed

- Use the same remark parser/directive grammar for legacy board segmentation,
  rendering and search; remove Satteri. Headings inside directive containers do
  not become board columns. Keep native live/history ownership and local-only
  reading without source writes or acceptance inference.

## 0.6.1 - 2026-10-06

### Changed

- Adopt Antumbra's `react-markdown` and `remark-gfm` rendering stack on the
  server, retaining no-JavaScript reading, local links/images, generated heading
  anchors, scoped footnotes, raw-HTML details and Shiki highlighting. Search uses
  the same Markdown/GFM processing and heading rules as the reader. Rendering
  and search plugins now use unified transformers rather than Satteri visitors;
  Satteri remains only for legacy heading-board source segmentation.
- Match Antumbra's Mermaid error-rendering setting so parse failures show a local
  diagnostic/source without inserting Mermaid's global error diagram. Existing
  local assets, strict rendering and visual inspection remain available.
- Keep the custom step 11 metric/progress/timeline source-format proposal open;
  the renderer adoption does not settle that authoring contract.

## 0.6.0 - 2026-10-06

### Added

- Serve source-relative PNG, JPEG, GIF and WebP images inside the workspace with
  loopback guards, resolved-path containment, correct media headers, no caching
  and a 16 MiB limit. Refuse traversal, escaping file/directory links and active
  attachment formats. Watch image edits through native reconciliation.
- Add a keyboard image gallery and Mermaid inspection with bounded zoom, a
  scrollable/fullscreen viewport, local downloads and focus restoration. Explain
  missing images and failed diagrams; retain Mermaid source without JavaScript.
- Disclose an open preview after source updates and require reopening before
  saving it. Downloads copy files locally and never write workspace sources.

### Fixed

- Normalize visual controls and refreshed image URLs during reading-state swaps
  so unchanged images and drawings keep their source context. Existing history
  baselines remain Markdown-only; image bytes are not added to Mark seen snapshots.

## 0.5.0 - 2026-10-06

### Added

- Add Pause/Resume updates with a bounded pending-hint count and transient,
  motion-free outlines on changed reading blocks. Resume, reconnect and watcher
  uncertainty reconcile the workspace without reporting retained reads as fresh.

### Changed

- Use native Effect RPC, AtomRegistry and effect-contract live/resume support
  for browser reads and update ownership, bundled locally with esbuild. Preserve
  server-rendered HTML and ordinary GET links; the compatibility `/events`,
  search and history endpoints remain available.
- Invalidate affected source documents, stable identities and derived views
  through both former and current backlinks, board membership, criterion evidence
  and attention targets. Leave unrelated documents mounted; reconcile fully when
  paths, delivery or the rebuilt index are uncertain. Sequence numbers detect
  server-local PubSub loss; they are not a durable replay protocol.

### Fixed

- Prepare the local native browser bundle before standalone and sharded workspace
  tests, sharing the production build command so fresh CI checkouts can run the
  browser regressions without a prior package build.
- Refresh missing favorites after navigation-only changes, recreate native client
  ownership after a persisted pageshow, and retain explicit Mark seen cancellation,
  clearing and expiry disclosure while automatic updates are paused. Keep one
  local baseline per workspace, 30-day/2 MiB limits and source files read only.

## 0.4.1 - 2026-10-05

### Fixed

- Let an explicit Mark seen observation finish through background/live refresh
  and then reconcile current source. Keep newer clearing or another tab's
  storage changes authoritative so a cancelled observation cannot restore
  discarded history. Preserve the existing browser-local retention limits.

## 0.4.0 - 2026-10-05

### Added

- Add explicit Changes since seen comparisons with one browser-local baseline
  per workspace, 30-day expiry, a 2 MiB serialized limit and clearing. Compare
  source additions/removals, unique-ID moves and recorded field/content changes
  with escaped old/current source. Keep incomplete, corrupt, expired and oversized
  history explicit; live updates never silently acknowledge changes. No source
  writes, server history, cloud sync, inferred authorship or verified acceptance.

- Read explicit per-item attention request lists and expose a local overview for
  decisions, reviews and blockers with reason, response labels, target links and
  source provenance. Preserve exact request navigation, search/backlink context,
  native links and live updates. Keep invalid/ambiguous requests unclassified and
  incomplete indexes uncounted; closed requests do not imply acceptance. Existing
  Markdown and arbitrary status/owner fields remain unchanged.

### Fixed

- Include symlinked reference directories outside the workspace in document
  reading, logical relative links, home selection and search. Watch linked
  directory edits and rediscover added/retargeted links. Skip broken links,
  ancestor/cycle traversal, hidden entries and dependencies; standalone file
  symlinks still cannot escape their containing workspace/reference directory.
  Reference files are read only.

## 0.3.0 - 2026-10-04

### Changed

- Breaking: no root entry and no module that re-exports another. `exports` maps one `"./*.ts"` pattern to every module (`src` under the `source` condition, `dist` otherwise), so you import the module that defines a name, and a bundler sees only the modules you use. Where each name now lives:
  - `@shivaedev/work-board`: `@shivaedev/work-board/board.ts` (`BoardOptions`, `boardLayer`)

### Added

- Add source backlinks for explicit relationships, board membership, criterion
  evidence, local evidence sources, and Markdown hyperlinks, including plain
  files. Reuse the existing parse/index and disclose incomplete references.
  Associate criterion claims across files and link directly to their records;
  show missing claims, origin lines, retained old revisions, and missing local
  Markdown sources without implying verified acceptance. Decision options and
  rationale stay ordinary Markdown; source files remain unchanged.

- Add a table layout sharing board projections, filters, sorting, and selected
  source detail. Switch layouts without losing URL context and read/filter tables
  without JavaScript. Save, update, reopen, remove, or clear up to 10 local named
  views per workspace; reject unsafe destinations and disclose unavailable
  storage. Keep saved filters separate from URL item selection and never silently
  evict a saved view at capacity. Source Markdown stays unchanged.

- Add Work board selection and explicit shared-item projections, exact status/
  owner filters, text matching, and sorting. URL state restores board/filter/
  selected detail context; source Markdown stays readable in a side pane.
  Disclose missing/ambiguous memberships and selections, retain filters and
  focused unsent search through live updates, and keep native links/GET filters
  usable without JavaScript. Existing heading boards remain unchanged.

- Read optional YAML frontmatter for stable item identity, explicit work fields,
  relationships, board membership, criteria, and recorded evidence provenance.
  Keep ordinary Markdown/heading boards valid, retain unknown source metadata,
  and disclose malformed fields, duplicate IDs, and unresolved references.
  Rebuild identities from the existing local index; identity links survive file
  and heading renames, and criterion search opens its source context. Recorded
  outcomes remain distinct from independently verified acceptance.
- Show source lines in search results and preserve reading state when an item
  moves. Keep passage focus when a search result targets the active document.

- Add local workspace search with document, heading, and passage results, snippets,
  keyboard navigation, and a command dialog for existing view controls. Rebuild
  the in-memory index after file changes, disclose unreadable files, and prevent
  older search responses from replacing newer queries.

- Add heading passage links and an outline, in-place document navigation with
  back/forward reading-state restoration, workspace-scoped favorites and recents,
  active document titles, and readable missing-document/passage states.
- Resolve Markdown links relative to the source file, including nested home
  files served at `/`. Ignore stale page responses after navigation and render
  cached diagrams using the current theme.
- Add the first workspace shell: a collapsible file sidebar, file location,
  responsive board columns, readable documents, and keyboard skip navigation.
  Remember theme, density, and sidebar choices per folder and server origin;
  code highlighting and diagrams follow the selected theme. Controls remain
  usable when browser storage is unavailable.

- Add a step-by-step delivery plan for the vision, with 26 bounded implementation
  steps, dependencies, acceptance evidence, and explicit design gates before
  richer source formats, mutations, agent handoffs, and external integrations.

- Document the local Work Board north star, three-wave roadmap, experience design,
  and interactive vision mockups with desktop and mobile captures. The package
  README links to the proposed direction separately from its current behavior.

## 0.2.1 - 2026-10-04

### Changed

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

- Add `@effect/platform-node-shared` as a peer dependency pinned to the same
  exact version as the `effect` and `@effect/platform-node` peers, so an
  install holds one copy of Effect. An application that embeds `boardLayer` and
  already depends on the Effect stack adds `@effect/platform-node-shared` at
  that version; pnpm, npm and Bun install it otherwise.

### Fixed

- Pin `@effect/platform-node-shared` to the `effect` version, so the
  `work-board` command starts after a fresh install. Before,
  `@effect/platform-node` resolved a newer `@effect/platform-node-shared`
  prerelease than its `effect`, and the command crashed on start importing
  modules that `effect` lacks.

## 0.1.0 - 2026-09-26

### Added

- Add the `work-board` command: `work-board <dir> [--port 4747] [--home <file>]`
  serves every markdown file under a folder on 127.0.0.1 from one long-lived
  process, with a top bar listing them and how long ago each changed. Files
  and folders below it starting with a dot and `node_modules` are never
  entered, the folder itself may be a dot folder, paths and symlinks leading
  outside the folder are never served, requests whose `Host` header is not a
  loopback host are refused, and a missing `--home` file stops the command
  with an error.
- Pages render GitHub Flavored Markdown on the server with raw HTML allowed,
  including `<details>` blocks with markdown inside, and highlight fenced code
  with Shiki in light and dark. Mermaid diagrams are drawn in the browser from
  the installed package, only on pages that have one, into reserved space and
  without ever showing their source while drawing; they follow the colour
  scheme, and a diagram that does not parse shows its source and the error.
- The `--home` file is shown at `/` as a board: `##` sections, `###` items, a
  footer after a `---` that follows the last heading, and a count per section
  derived from its items. Reference links and footnotes work inside cards.
- Pages update in place: the server watches the folder recursively and pushes
  the changed markdown paths over server-sent events at `/events`, and the page
  replaces only the changed blocks without reloading, keeping which `<details>`
  are open, every drawn diagram that did not change, and an edited diagram's old
  drawing until its new one is ready. A refresh that gets no page back keeps the
  page and says so. A failed watch is restarted, waiting longer after each
  failure, while pages show "reconnecting" and then catch up. Ctrl-C stops the
  command at once, even with pages open.
- Add `boardLayer`, the router Layer the command serves, for embedding the board
  in another Effect HTTP server or as a fetch handler.
