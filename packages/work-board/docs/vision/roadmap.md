# Work Board roadmap

The [north star](./README.md) defines the direction. Unchecked work remains incomplete; partial checkpoints are recorded below. Completion requires the stated observable behavior
and relevant checks; a mockup or a checked design document is not feature proof.
Waves describe dependency order, not a calendar commitment.

The [step-by-step delivery plan](./delivery/README.md) turns these waves into
26 bounded implementation steps. Start with steps 01–03: workspace shell,
document locations, then search. Each step names its prerequisites and acceptance
evidence; the plan also records the source-format, mutation, handoff, and integration
discussion gates. Record completed step IDs and their proof here as delivery
proceeds.

## Delivery checklist

Check a step only after its acceptance is demonstrated in the package.

- [x] [01 A real workspace shell](./delivery/wave1.md#01-a-real-workspace-shell)
- [x] [02 Document locations and reading state](./delivery/wave1.md#02-document-locations-and-reading-state)
- [x] [03 Find work from anywhere](./delivery/wave1.md#03-find-work-from-anywhere)
- [x] [04 Optional identity and a rebuildable index](./delivery/wave1.md#04-optional-identity-and-a-rebuildable-index)
- [x] [05 One body of work, several views](./delivery/wave1.md#05-one-body-of-work-several-views)
- [x] [06 Follow the reasoning and the evidence](./delivery/wave1.md#06-follow-the-reasoning-and-the-evidence)
- [ ] [07 An attention-first overview](./delivery/wave1.md#07-an-attention-first-overview)
- [x] [08 What changed since I last looked](./delivery/wave1.md#08-what-changed-since-i-last-looked)
- [x] [09 Live updates that preserve orientation](./delivery/wave1.md#09-live-updates-that-preserve-orientation)
- [x] [10 Local visual evidence](./delivery/wave1.md#10-local-visual-evidence)
- [x] [11 A small vocabulary for visual documents](./delivery/wave1.md#11-a-small-vocabulary-for-visual-documents)
- [x] [12 Start with useful project documents](./delivery/wave1.md#12-start-with-useful-project-documents)
- [ ] [13 Prove the complete reading workflow](./delivery/wave1.md#13-prove-the-complete-reading-workflow)
- [x] [14 Prove one safe source mutation](./delivery/wave2.md#14-prove-one-safe-source-mutation)
- [x] [15 Respond to the exact thing you reviewed](./delivery/wave2.md#15-respond-to-the-exact-thing-you-reviewed)
- [x] [16 Record a decision and its consequence](./delivery/wave2.md#16-record-a-decision-and-its-consequence)
- [ ] [17 Narrow editing and honest undo](./delivery/wave2.md#17-narrow-editing-and-honest-undo)
  — deferred by the approved ordinary-file ownership boundary; the controls are
  unimplemented and do not block D3/18.
- [x] [18 One local agent handoff](./delivery/wave2.md#18-one-local-agent-handoff)
- [ ] [19 Review a returned result against its criteria](./delivery/wave2.md#19-review-a-returned-result-against-its-criteria)
- [ ] [20 Complete the first coordination loop](./delivery/wave2.md#20-complete-the-first-coordination-loop)
- [ ] [21 Successive contributions with clear ownership](./delivery/wave3.md#21-successive-contributions-with-clear-ownership)
- [ ] [22 Several local projects, one attention view](./delivery/wave3.md#22-several-local-projects-one-attention-view)
- [ ] [23 Richer plans and linked reviews](./delivery/wave3.md#23-richer-plans-and-linked-reviews)
- [ ] [24 One optional read-only GitHub adapter](./delivery/wave3.md#24-one-optional-read-only-github-adapter)
- [ ] [25 Read existing local test and build artifacts](./delivery/wave3.md#25-read-existing-local-test-and-build-artifacts)
- [ ] [26 Quiet rules and a real collaboration review](./delivery/wave3.md#26-quiet-rules-and-a-real-collaboration-review)

## Step 01 evidence

The package now serves a collapsible file sidebar, file location, readable
documents, responsive board columns, and remembered theme/density/sidebar
preferences. The source format and public CLI/embedding API are unchanged.

- Work Board: 78 passing tests, including the shared 50-document/100-item
  fixture, preference restoration and isolation, unavailable storage, explicit
  diagram themes, and live-update preservation. Happy DOM uses a Mermaid stub.
- Chromium 151: actual local server and Mermaid, 1440 × 1000 desktop,
  390 × 844 mobile, and 720px reflow; keyboard skip/focus and sidebar toggle,
  reload/navigation persistence, Shiki theme override, blocked storage,
  unchanged diagram/open-details preservation, and readable no-JavaScript content.
  No page errors were observed in the desktop/mobile walkthrough.
- Repository gate: lint, build, typecheck, PostgreSQL-backed tests, and packed
  consumers passed. The suite has 961 passing tests and three existing expected
  failures; no tests were skipped.
- [Repeatable browser acceptance](./delivery/browser-acceptance.md) provides
  the fixture launcher and review sequence. This is fixture evidence, not
  real-project adoption or a usability/performance budget.

## Step 02 evidence

The package now gives Markdown headings unique passage links and an outline,
uses the active document's main heading as its browser title, and resolves links
from the source file even when a nested home file is served at `/`. Back/forward
navigation preserves scroll, text selection, and expanded sections. Favorites
and ten recent documents are stored per workspace and browser origin; bounded
reading records survive reloads within a tab. Missing documents and passages are
explained. Heading text/order changes can change generated anchors; durable IDs
are supported for richer per-item files in step 04. Project content is not modified.

- Work Board: 89 passing tests, including heading collisions, Unicode, encoded
  filenames, nested-home links, history restoration, workspace isolation,
  unavailable storage, missing favorites, and stale live responses after navigation
  (successful, HTTP-failure, and network-failure responses). Happy DOM does not
  prove scroll layout or actual Mermaid rendering.
- Chromium 151: the shared 50-document/100-item fixture at 1440 × 1000 and
  390 × 844; scroll/selection/expanded sections through back/forward and reload;
  duplicate outline links and focus; favorite/recents reload; encoded paths;
  missing documents and copied missing-passage links; failed-navigation retry;
  stale-response isolation; actual Mermaid theme restoration; modified-click
  new tabs; blocked storage; and readable no-JavaScript content/outline.
  No page errors were observed in the desktop/mobile walkthrough.
- Repository gate: `pnpm ready` passed lint, build, typecheck, real
  PostgreSQL-backed tests, and packed consumers. The suite has 972 passing tests
  and three existing expected failures; no tests were skipped.
- [Repeatable browser acceptance](./delivery/browser-acceptance.md) records the
  review path. This is fixture evidence, not real-project adoption or performance
  measurement.

## Step 03 evidence

The package now searches local document titles/paths, Markdown headings, and
passage text using a rebuildable in-memory index. A keyboard-opened dialog shows
result types, snippets, bounded counts, empty/failure states, and links to the
matching heading. It also commands the existing workspace/sidebar/density/theme
controls. File changes invalidate the index; open results refresh on edits and
reconnect. Source-in-editor links await an agreed local editor mechanism.

- Work Board: 100 passing tests, including exact duplicate-heading targets,
  encoded paths, Unicode/GFM/code text, deterministic ranking/result bounds,
  real filesystem/HTTP edit/add/delete invalidation, root/hidden-file boundaries,
  incomplete-result notices, keyboard commands, focus restoration, stale-response
  rejection even when cancellation is ignored, retry, and safe snippet rendering.
- Chromium 151: 50-document/100-item fixture at 1440 × 1000 and 390 × 844;
  typed results, duplicate passage navigation, arrows/Enter/Escape, modal focus,
  edits/deletions, delayed-response isolation, retries, view commands, dark theme,
  modified-click new tabs, narrow layout without horizontal overflow, and readable
  no-JavaScript content with Search disabled. No page errors observed. The actual
  project vision/delivery folder was also searched and a matching passage opened.
- Observational baseline on the shared managed container (AMD EPYC 9V74 CPU,
  Node 24.19.0): first HTML response 57.1ms, cold index/search 76.9ms, and edit to
  updated search 199.9ms, with the 50-document/100-item fixture. Five warm requests
  in the browser walkthrough ranged from 3.5ms to 26.6ms. These are individual
  observations, not agreed budgets or proof of real-user orientation time.
- Repository gate: `pnpm ready` passed lint, build, typecheck, real
  PostgreSQL-backed tests, orchestration regressions, and packed consumers. Package
  suites have 983 passing tests and three existing expected failures; seven
  orchestration tests passed, with no tests skipped.
- [Browser acceptance](./delivery/browser-acceptance.md) gives the repeatable
  review path. [Source examples](./delivery/source-examples.md) describe the optional
  read-side convention.

## Step 04 evidence

D1 approved optional per-file YAML frontmatter with `yaml` 2.9.0, explicit stable
IDs, unchanged legacy heading boards, explicit relationships/board membership,
and criterion-level recorded evidence distinct from verified acceptance. The
package now reads that [source convention](./delivery/source-examples.md), extends
the existing index, and exposes stable item/criterion links and diagnostics.

- Work Board: 128 passing tests covering plain Markdown compatibility, BOM/CRLF
  and exact source lines, independent valid fields, unknown/nested-invalid fields,
  malformed YAML/duplicate keys/tags/alias bounds, case-sensitive ASCII identity,
  explicit references, duplicate IDs/criteria, incomplete-workspace validation,
  real HTTP/watch rename/delete/conflict recovery, identity read-race rejection,
  reserved-prefix/encoded Markdown paths, restart rebuilding, metadata
  escaping, and criterion search/focus. DOM regressions preserve open details and
  selection through live item renames and navigation; same-document search keeps
  passage focus after closing the dialog.
- Chromium 151: 50-document/100-card fixture plus richer item examples at
  1440 × 1000 and 390 × 844; original cards unchanged, ID/owner/criterion search
  with exact line labels, recorded-provenance disclosure, relationship navigation,
  criterion focus/expansion, live file/heading renames, Back restoration,
  duplicate/deletion explanations and recovery, unknown-field raw preservation,
  dark mode, no-JavaScript reading, and no narrow horizontal overflow. No page
  errors observed. This is fixture evidence, not user adoption or verified
  acceptance of its example evidence records.
- Repository gate: `pnpm ready` passed lint, orchestration, build, typecheck,
  real PostgreSQL-backed tests, and packed consumers. Package suites have 1,011
  passing tests and three existing expected failures; nine orchestration tests
  passed, with no tests skipped. The quality baseline did not grow.
- [Browser acceptance](./delivery/browser-acceptance.md#optional-identity-acceptance--step-04)
  gives the repeatable path. Richer board/table/detail views remain step 05;
  legacy card IDs and source-in-editor navigation remain outside this checkpoint.

## Step 05 board/detail checkpoint evidence

The first checkpoint delivered board/detail views; the completion evidence below
covers table views and saved local views.
The board/detail checkpoint reads shared items from explicit board declarations,
uses recorded status columns, and restores filtering/sorting/selection from URLs.

- Work Board: 137 passing tests. New real HTTP/watch and DOM regressions cover
  shared board counts, unchanged legacy headings, missing-field filters,
  deterministic sorting, missing/repeated/ambiguous memberships, incomplete-index
  refusal, filtered-out selections, live status edits and deletion explanations,
  Back/Forward detail restoration, and retained focused unsent search.
- Chromium 151: large 50-document/100-card fixture plus richer work at
  1440 × 1000 and 390 × 844. Verified explicit shared boards/counts, detail source
  links and real Mermaid, Back/reload URL restoration, live filters/focus,
  deleted selection explanation, dark theme, reduced motion, no horizontal
  overflow, and native no-JavaScript GET filters/detail links. No page errors.
  This is fixture evidence, not real-user adoption or orientation-time proof.

- Repository gate: `pnpm ready` passed lint, orchestration, build, typecheck,
  real PostgreSQL-backed tests, and packed consumers. Package suites have 1,020
  passing tests and three existing expected failures; nine orchestration tests
  passed, with no tests skipped. The quality baseline did not grow.

## Step 05 completion evidence

Board and table now share explicit item projections, filter/sort state, counts,
and selected source detail. URLs restore the layout and context; named browser
views retain applied board/filter/sort/layout preferences without item selection
or content writes. Legacy heading boards and personal compact density remain valid.

- Work Board: 144 passing tests. New HTTP regressions compare board/table IDs,
  counts and selected detail, missing-field ordering, escaped source cells, empty
  results, and unsupported-layout fallback. DOM regressions cover applied-state
  saving, excluded unsent input/selection, reopening, same-name updates, removal/
  clearing, workspace isolation, external/executable URL rejection, textual names,
  capacity without silent eviction, blocked storage, and malformed-JSON recovery.
- Chromium 151: 50-document/100-card fixture plus shared richer items at
  1440 × 1000 and 390 × 844. Verified board/table counts and selection, real
  Mermaid/source detail, Back/reload, named-view save/update/reopen/clear, measured
  compact row padding, live filters/focused unsent input/deleted selection,
  dark/reduced-motion layout without page overflow, blocked-storage fallback,
  and no-JavaScript table/GET filter/detail navigation. No page errors observed.
  This is fixture evidence, not adoption or an orientation-time measurement.
- Repository gate: `pnpm ready` passed lint, orchestration, build, typecheck,
  real PostgreSQL-backed tests, and packed consumers. Package suites have 1,027
  passing tests and three existing expected failures; nine orchestration tests
  passed, with no skips or quality baseline growth.
- [Browser acceptance](./delivery/browser-acceptance.md#table-and-saved-view-acceptance--step-05-completion)
  gives the repeatable completion path. Evidence/backlink context follows in 06;
  overview/attention remains 07, and no source mutations are implemented.

## Step 06 completion evidence

Explicit relationships connect a sample result to its plan and decision rationale.
Criteria collect recorded claims across readable workspace files, linking to each
source record with origin and supplied provenance. Incoming source links remain
readable on plain Markdown documents. Claims never establish current verification
or human acceptance; missing sources and old revisions stay visible.

- Work Board: 155 passing tests. Added HTTP/watch/restart and DOM regressions
  cover two-step reasoning, criterion associations and exact record focus,
  Markdown/reference links, encoded paths and nested root homes, source deletion,
  ambiguous IDs, and incomplete-index disclosure.
- Chromium 151: verified result → plan → decision options/rationale, criterion →
  exact recorded claim, retained old revisions and missing sources, plain/encoded
  backlinks, Back and live edits/deletion, real Mermaid, desktop/mobile,
  dark/reduced motion, and no-JavaScript reasoning navigation. No page errors or
  page overflow observed. This proves fixture behavior, not user adoption.
- Repository gate: `pnpm ready` passed lint, orchestration, build, typecheck,
  real PostgreSQL-backed tests, and all packed consumers. Package suites have
  1,038 passing tests and three existing expected failures; nine orchestration
  tests passed, with no skips or quality baseline growth.
- [Browser acceptance](./delivery/browser-acceptance.md) includes the repeatable
  reasoning/evidence scenario. Source schema, dependencies, public exports and
  content mutation remain unchanged. Record anchors follow array position;
  explicit item and criterion IDs remain the durable source identities.

## Step 07 source decision and implementation evidence

The user approved an optional per-item attention list on 2026-10-05: independent
request IDs, explicit decision/review/blocker kinds, open/closed source state,
nonempty literal response labels, reason and item/criterion targets. Arbitrary
status, owner and action fields must not imply requests. [Attention records](./delivery/attention-examples.md)
states the implemented contract and links the Antumbra design references.

The read-only overview, exact source links, search/backlink context, diagnostics,
quiet state and live updates are implemented.

- Work Board: 166 passing tests. Schema regressions retain invalid lists and
  independent fields; HTTP regressions cover multiple explicit judgments,
  arbitrary-label exclusion, duplicate/missing IDs, unresolved criteria,
  malformed source, incomplete indexes, source renames, closure and restart.
  Ordering/escaping and DOM exact-record focus, Back and live disclosure are covered.
- Chromium 151: a 100-card legacy fixture plus richer requests verified grouping,
  closed/arbitrary-label exclusions, request focus/reload/Back, criterion claims,
  real Mermaid, decision options/rationale, and live close/rename/deleted targets.
  Desktop 1440 × 1000 and mobile 390 × 844, dark/reduced motion and native
  no-JavaScript navigation passed without page overflow or page errors.
- Repository gate: `pnpm ready` passed lint, nine orchestration tests, build,
  typecheck, real PostgreSQL-backed suites and all packed consumers. Package
  suites have 1,062 passing tests and four existing expected failures. One existing
  `effect-test` fixture intentionally exercises `skipIf(true)`; no Work Board or
  database tests skipped. Quality baseline did not grow (2,508 retained findings).
- [Repeatable browser acceptance](./delivery/browser-acceptance.md#explicit-attention-acceptance--step-07)
  separates the source/browser checks from the reader exercise below.

Representative-user evidence for
the proposed 30-second orientation target remains pending; step 07 stays open
until that acceptance exercise is recorded. Step 08's explicitly approved
implementation is complete; steps 10–26 remain open. The rest of W1.2/W1.3
remains proposed.

## Step 08 baseline decision and acceptance evidence

The user approved one explicit browser-local Mark seen baseline per workspace,
30-day expiry, a 2 MiB serialized limit and clearing. The [change-history contract](./delivery/change-history-examples.md)
states retention, observation semantics and incomplete/unknown-history behavior.
Opening Changes or receiving a live update never acknowledges source changes.

- Work Board: 182 passing tests, including 16 new history regressions. Schema
  checks cover exact UTF-8 limits, version/corruption/future/expiry, unsafe paths
  and duplicate source paths. Comparison checks cover recorded fields, decision
  Markdown, ordinary renames, unique-ID moves, ambiguous IDs and escaped old text.
- Native HTTP checks compare observed source edits after watcher delivery, reject
  cross-origin/unknown/oversized queries, and refuse incomplete or oversized
  workspaces without false removals or partial retention. DOM checks cover
  explicit marking, unchanged baseline through live updates, keyed disclosure
  preservation when earlier changes appear, source navigation/Back, replacement,
  clear, stored baseline restoration, workspace isolation, expiry/corruption and
  disclosed blocked-storage behavior.
- Chromium 151: the 100-card legacy home plus richer sources produced exactly
  two additions, one removal and four changed sources after a known status,
  attention, criterion-evidence, decision, added-file, plain rename and unique-ID
  move sequence. Source/Back/reload and live updates kept the baseline; old source
  remained plain text. Clear/reload stayed off, expiry cleared on an ordinary
  workspace visit, and blocked storage retained a disclosed page-only baseline.
  Desktop 1440 × 1000, mobile 390 × 844/dark/reduced motion and native no-JavaScript
  fallback passed without page overflow or page errors.
- `pnpm ready` passed lint, nine orchestration tests, builds, typechecks, real
  PostgreSQL suites and all packed consumers. Package suites reported 1,078
  passes and four existing expected failures; one existing `effect-test`
  `skipIf(true)` fixture remains intentional. No Work Board/database tests skipped;
  the quality baseline remains 2,508 findings without growth.
- [Repeatable browser acceptance](./delivery/browser-acceptance.md#explicit-change-baseline-acceptance--step-08)
  describes the known sequence and boundary checks. This is observed Markdown
  comparison, not an atomic filesystem snapshot, event journal, authorship,
  Git verification, human orientation timing or accepted evidence. Expired stored
  data is removed on the next visit/open-page check; no background deletion is
  claimed while the browser is closed. Source files remain untouched.


## Reference-directory follow-up and 0.4.0 release

The same checkpoint includes the approved linked-reference fix and release bump.
Directory symlinks include Markdown from the main checkout without copying it or
adding a mount API. Logical workspace paths remain the reading/search/link
identity. Native recursive watches cover the included directories; watches of
link parents catch replacements that Node's recursive watcher can miss.

- Work Board: 189 passing tests. Seven reference regressions cover external and
  internal aliases, nested-home/relative links, search, cycle/ancestor exclusion,
  broken links, hidden/dependency entries, escaping file links, external edits,
  add/rename/delete, newly linked/retargeted directories and watcher recovery.
  Existing identity rename/deletion tests retain delivery of changed-file events;
  ordinary file changes do not restart the watch.
- Chromium 151: a real symlink to the main checkout's documentation opens the
  framework README, follows its relative roadmap link and returns with Back.
  A temporary external nested home works at `/`; external edits retain open
  source details through live refresh and Back. Search, new/retargeted links and
  subsequent live edits pass. Desktop 1440 × 1000 and mobile 390 × 844 with dark
  theme/reduced motion have no page overflow or browser errors; native reading
  also works with JavaScript disabled.
- [x] Full `pnpm ready` passed lint, nine orchestration tests, builds, typechecks,
  real PostgreSQL suites and every packed consumer, including the installed
  Work Board CLI's matching 0.4.0 version. Package suites reported 1,085 passes
  and four existing expected failures; the single existing intentional
  `effect-test` skip remains. No Work Board/database test skipped and the quality
  baseline did not grow.
- Package manifest and CLI version are both 0.4.0, triggering the existing
  package-publish workflow after merge. No dependency, source-schema change,
  source write, cloud operation or verified-acceptance inference is introduced.
- [Repeatable browser acceptance](./delivery/browser-acceptance.md#linked-reference-directory-acceptance--040-follow-up)
  covers this fix. A linked target missing when the watch was built needs a
  restart once restored. Multiple aliases retain existing duplicate-ID rules.
  Step 07's representative-reader timing remains pending. Step 09 stays open:
  the approved direction establishes reusable Platform support before Work Board
  adopts it. The user subsequently approved esbuild 0.28.1 for local browser
  assets and the proposed native RPC/AtomRegistry Changed/Resync composition.


## Explicit observation follow-up and 0.4.1 release

An explicit Mark seen action completes through background comparison/live refresh
and then compares the retained observation with current source. Newer explicit
clearing/storage changes cancel the pending action and remain authoritative.

- [x] A controlled DOM overlap reproduces the cancellation timeout without the
  fix. Hold the observation, deliver a real source change/SSE page refresh, then
  complete marking: the new baseline replaces the restored old one and includes
  the source actually observed. A separate storage-clear regression asserts that
  the pending request is aborted and cannot restore history.
- [x] Chromium 151 holds an actual captured HTTP observation while a source edit
  and native page refresh arrive. The saved observation retains the earlier
  source and reports the subsequent change; the next explicit Mark seen clears
  that change. A second tab's Clear cancels another held observation without
  resurrecting history. Desktop and mobile 390 × 844/dark/reduced motion pass
  without page overflow or browser errors.
- [x] Full `pnpm ready` passed lint, nine orchestration tests, builds, typechecks,
  real PostgreSQL suites and all packed consumers, including CLI version 0.4.1.
  Work Board has 190 passing tests; package suites reported 1,106 passes and four
  existing expected failures. The single existing intentional `effect-test` skip
  remains; no Work Board/database test skipped and the quality baseline did not
  grow.
- Package and CLI versions are 0.4.1. Retention, source schema, Markdown
  compatibility and local-only operation are unchanged. This closes an explicit
  observation race; step 09's Platform-first work and step 07's reader timing
  remain separate.
- [Repeatable browser acceptance](./delivery/browser-acceptance.md#explicit-observation-overlap-acceptance--041-follow-up)
  records the ordering and comparison limits.


## Step 09 native adoption and orientation evidence

Work Board now uses native Effect RPC, AtomRegistry and the shared effect-contract
live/resume support. Locally bundled browser assets replace the automatic
fetch/EventSource coordinators. DOM navigation and reading preferences keep their
existing ownership; Mark seen uses an imperative native read so background
invalidation cannot cancel the explicit observation.

- Regression tests cover prior/current Markdown and metadata dependencies,
  board membership, criterion evidence, attention targets, nested home aliases,
  renamed/duplicate IDs and observations changed outside an announced path.
  Unknown paths, incomplete indexes, watcher uncertainty and gaps in server-local
  PubSub delivery require a full reconciliation. That sequence is not a wire
  replay protocol or durable journal.
- Native HTTP tests exercise pages, item URLs, search, navigation and history;
  same-origin/loopback rejection and active-subscription shutdown pass. DOM
  tests cover retained failures/stale responses, unrelated mounted documents,
  pause/resume, the 256+ pending-hint label, highlight/orientation preservation,
  pagehide/persisted-pageshow ownership and explicit clear/expiry while paused.
- Actual Chromium 151.0.7922.173 checks the representative workspace at
  1440 × 1000 and 390 × 844 with dark preference and reduced motion. Unrelated
  edits keep the active page query/paragraph; paused root-home edits catch up;
  offline reads retain source and recover; real Mermaid drawings and open details
  survive updates; focused unsubmitted filters and selected item URLs remain.
  Browser Back, explicit history retention/clearing, native no-JavaScript links
  and narrow layout pass without page errors or horizontal overflow.
- Chromium Back used a fresh document rather than bfcache: CDP reports the
  main/subrequest no-store policy and browsing-instance eligibility. Persisted
  pageshow recovery is established by the DOM regression, not a claim of actual
  bfcache restoration. Physical background-tab transitions, Capacitor, capacity
  across many tabs and representative-reader timing remain unestablished.
- The local minified native asset is about 524 kB before compression. The packed
  CLI checks its native asset and ordinary page assets; no performance budget
  or source mutation is inferred from these results.

- Fresh CI shards originally lacked the ignored native browser bundle, causing
  DOM initialization timeouts. Removing the local bundle reproduced all three
  native-update regressions failing; the shared `test:prepare`/production bundle
  command now prepares standalone tests and workspace shards before execution.
  An HTTP regression checks that a source checkout serves the native module.
  With the bundle removed again, the workspace shard/coverage path passes all
  204 Work Board tests after preparation. The regenerated asset is byte-identical
  to the bundle verified in Chromium.
- Full repository handoff passes `pnpm ready`: 1,158 package tests, four existing
  expected failures, one intentional skip, seven orchestration tests, real
  PostgreSQL, lint/typechecks/builds and every packed consumer. Work Board's
  204 regressions pass; the touched quality baseline loses ten findings and
  grows nowhere. The 0.5.0 package/CLI versions match the release changelog.
  Browser actions leave every fixture source unchanged except explicit test edits.

## Step 10 local visual evidence

Work Board 0.6.0 serves explicitly referenced PNG, JPEG, GIF and WebP images
through guarded local GET routes. Paths resolve from the source file, including
nested home aliases and recorded evidence links. Each read checks the resolved
workspace boundary, regular-file type and 16 MiB bound; escaping file/directory
links, traversal, hidden/dependency paths and active attachment formats are refused.
The existing external-reference Markdown behavior remains unchanged; its images
must reside inside the workspace. Image edits use conservative native resync,
respecting Pause/Resume; the Mark seen baseline stays Markdown-only.

- HTTP regressions check exact PNG bytes/media/no-store/nosniff headers, nested
  source/recorded-evidence links, loopback rejection, malformed/unsupported paths,
  file/directory escapes, size bounds and actual image watcher delivery.
- DOM regressions check keyboard gallery/link inspection, bounded zoom, focus
  restoration (including diagram inspection after cached Back navigation),
  malformed image-name fallback, local load errors, image update
  reconciliation and stale-preview disclosure with saving disabled. Mermaid
  inspection checks local SVG download ownership/release and unavailable
  fullscreen fallback. Existing reading/drawing/history regressions still pass.
- Actual Chromium 151.0.7922.173 checks a representative workspace at 1440 × 1000
  and 390 × 844, dark/reduced-motion. Real PNG rendering/replacement, keyboard
  gallery/link inspection, missing-image errors, paused image catch-up, retained
  details, older-preview disclosure and local PNG/SVG downloads pass. Real
  Mermaid zoom/fullscreen, parse failure/source disclosure and keyboard dismissal
  pass. Actual size plus zoom keeps an 18-edge horizontal diagram's label height
  at least 14 CSS pixels on the narrow screen, scrolling inside the viewport
  without page overflow. No-JavaScript images and Mermaid source remain readable.
  Source files stay unchanged except deliberate fixture edits; no page errors occur.
- Full `pnpm ready` passes with 1,165 passing package tests, four expected
  failures, one intentional skip and seven orchestration tests, real PostgreSQL, all packed
  consumers, lint/types/builds and the packed visual assets. Work Board has 211
  passing regressions. The quality baseline grows nowhere.

The viewport preserves an earlier preview until reopened; it does not assert
source revision verification or acceptance. Browser checks establish desktop
fullscreen and narrow scrolling, not native mobile fullscreen, Capacitor or
representative-reader timing. SVG is exported only from the strict Mermaid
renderer; arbitrary SVG/HTML/PDF attachments are not served.

## Current foundation

The [Platform live consumer checkpoint](../../../../docs/framework/roadmap.md#work-board-consumer-slice--in-progress)
and this Work Board adoption establish native invalidation, scoped reconciliation,
bounded pause and resource ownership. The shared browser-safe resume implementation
lives in effect-contract, while effect-react preserves its prior import through a
compatibility delegate and automatic runtime dependency. The remaining physical
lifecycle and representative-reader evidence stays separate.

The existing package serves a local Markdown folder, renders a designated home
file as sections and cards, and updates open pages in place. It provides GFM,
highlighted code, Mermaid, watcher recovery, and an embeddable Effect router.
Its README and tests remain the authority for current behavior.

## Wave 1 — Stay informed

Deliver a complete, read-oriented workspace that works while agents continue
editing ordinary files. Navigation preferences and saved local views may change;
the UI does not mutate project content in this wave.

| Slice | Proposed scope | Acceptance evidence |
| --- | --- | --- |
| W1.1 Orientation | Overview, attention queue, explanatory priority, empty state, onboarding templates | A user can find an explicitly recorded decision, blocker, and result; empty folders explain how to start |
| W1.2 Navigation | Collapsible sidebar, titles, folders, breadcrumbs, favorites, recents, search, command palette, anchors, source-in-editor links | Find a phrase and open its exact document/card in a 50-document fixture; keyboard navigation works |
| W1.3 Views | Document, board, table, overview, detail pane, multiple boards, saved filters, compact/comfortable density | The same source item appears consistently in each view; selecting it preserves the surrounding context |
| W1.4 Visual content | Safe local images/attachments, callouts, comparisons, metrics, progress, galleries; diagram zoom/fullscreen/downloads | Assets respect root boundaries; rich content has meaningful plain-text fallback; large diagrams remain usable |
| W1.5 Relationships | Read-side optional identity/metadata, backlinks, goals, decisions, dependencies, acceptance criteria, evidence links | A result can be traced to its plan and decision; broken/duplicate references are visible |
| W1.6 Awareness | Changed since last visit, source/freshness labels, stale evidence, restrained update highlighting, pause/resume updates | New content is distinguishable from activity; resuming catches up while preserving position and expanded content |
| W1.7 Finish | Themes, responsive layouts, accessible focus/status, basic browser print readability, targeted updates | Browser checks cover desktop and narrow layout, keyboard, reduced motion, reconnect, and offline core use |

- [x] Agree the smallest optional read-side metadata convention; support legacy
  heading-based boards unchanged and treat missing metadata as unknown.
- [ ] Deliver W1.2 + W1.3 as the first vertical slice: a larger workspace can be
  searched, browsed, and inspected comfortably.
- [ ] Add W1.1 + W1.5 using explicit source fields; do not infer blockers or
  completion from wording, section names, or file age.
- [ ] Complete W1.4, W1.6, and W1.7 with a small fixed component vocabulary.
- [ ] Benchmark selective invalidation and rendering using realistic documents
  and many cards; add virtualization only when evidence justifies it.

**Exit:** a person can return to a locally served project, understand its state,
find the reasoning, and inspect its evidence without scrolling through a log or
asking an agent to reconstruct the context. No external account is required.

## Wave 2 — Inform back and coordinate

D2 approves anchored responses, and step 16 delivers rich question/decision
packets. The approved [ownership boundary](./delivery/source-editing-examples.md)
keeps project edits with agents, human response content with Work Board, and
defers direct project editing/undo. D3 approves ordinary Markdown handoffs and
a copied instruction to an existing session; step 18 records acceptance evidence.

### Design gate before content mutations

- [x] Agree the first response surface: anchored answers, clarification and
  deferral, with a browser-local draft store and per-question waits. Step 16's
  rich packet/decision contract is delivered; direct project editing is deferred.
- [x] Preserve D1 legacy boards and richer per-item files; D2 adds independently
  identified question/context and response Markdown records without migration.
- [x] Agree ownership and practical writer expectations: agents edit ordinary
  files, Work Board owns human response content, surrounding agent changes win,
  and rare outside-editor races are accepted best-effort limitations. Direct
  source replacement/undo is deferred rather than required for coordination.
- [x] Specify the response route trust boundary: explicit writer opt-in, native
  same-origin/loopback NDJSON commands, escaped reviewed source and blocked source
  form actions/frames. Local labels provide attribution, not authentication.
- [ ] Decide who owns priority, assignment, acceptance, and handoff acknowledgment.
  An agent's completed run must not silently accept its own result.
- [ ] Agree a minimal local handoff contract with one existing agent tool;
  avoid inventing a scheduler or binding the core to one vendor.

| Slice | Proposed scope | Acceptance evidence |
| --- | --- | --- |
| W2.1 Respond | Anchored feedback, revision requests, decision comparison and recording | The response retains its source revision and evidence context; a later edit cannot silently change what was approved |
| W2.2 Edit (deferred) | Agents keep ordinary project-file editing; direct create/title/checklist/status/move controls and undo remain unimplemented | Ownership is agreed; the original editing acceptance is not claimed |
| W2.3 Coordinate | Goal/constraints/acceptance handoff, owner and next action, waiting/running/review states, acknowledgment | One real tool receives a handoff and returns a result; failures, duplicate submissions, and missing acknowledgment are visible |
| W2.4 Review | Criterion-level evidence, source diffs, requested revisions, acceptance distinct from run completion | A real item goes from proposal through a revision to accepted result with readable source records |

**Exit:** complete one local feature workflow with a person and an agent. The
person can give direction in context, understand whether it was received, and
review the result. Work Board preserves the human response and makes ordinary
detected save failures clear; outside-editor concurrency remains best effort.

## Wave 3 — Collaborate, with bounded integrations

Build on the validated write and handoff model. Keep the product local.

- [ ] Support iterative co-editing and multiple agent contributions through the
  existing local files and tools, with explicit ownership and conflict resolution.
- [ ] Add a local cross-project overview only after the single-project loop works.
- [ ] Add richer compositions and dependency/timeline views where real metadata
  supports them; distinguish dates, estimates, and unknowns.
- [ ] Support coherent in-app review of linked plans, decisions and evidence.
- [ ] Trial one read-only GitHub evidence adapter: a linked PR, checks, review,
  merge state, checked revision, and last successful refresh.
- [ ] Add local test/build artifact readers where they remove manual copying.
- [ ] Consider small explainable rules only after their triggers and ownership
  are reliable; suppress repeated unchanged notifications.

### Integration admission rule

Every adapter must name the manual step it removes, its authoritative source,
supported object(s), explicit opt-in, refresh behavior, offline behavior, and
maintenance owner. Start with linked objects rather than syncing an organization.
GitHub owns PR state; local files own the plan and authored decisions. No two-way
issue synchronization, generalized connector framework, or hosted component is
part of this wave. An unavailable integration leaves local work fully usable and
marks imported evidence stale.

**Exit:** a person can collaborate across successive agent contributions without
losing context or ownership. The optional adapter earns its place in actual use;
it does not determine the product's architecture.

## Ideas retained, in dependency order

| Original proposal | Delivery home |
| --- | --- |
| Attention-first home | Wave 1; actions arrive in wave 2 |
| Multiple views of the same work | Wave 1; richer timeline/dependencies in wave 3 |
| Stronger visual workspace | Wave 1, then continuous refinement |
| Rich visual documents | Fixed components in wave 1; composition grows in wave 3 |
| Direct manipulation | Wave 2, discussion gate |
| Plans, decisions, implementation, evidence | Read in wave 1; review/write in wave 2 |
| Human–agent handoffs | Wave 2, discussion gate; iterative collaboration in wave 3 |
| Changes and provenance | Wave 1; mutation provenance extends in wave 2 |
| External evidence | Narrow optional wave 3 adapter |
| Starting, finding, reviewing | Wave 1 templates/search; linked in-app review in wave 3 |

## Always out of scope

Cloud hosting, accounts, cloud sync, remote multiplayer, public publishing,
arbitrary executable widgets, a plugin marketplace, a general rich-text editor,
agent execution infrastructure, document export, shareable artifact/packet generation,
and an event-sourcing requirement.

## Step 11 rendering foundation

Work Board 0.6.1 adopts Antumbra's `react-markdown` 10.1.0 and `remark-gfm`
4.0.1 libraries for server-rendered documents and search. Ordinary Mermaid fences
continue through the local Mermaid renderer, now matching Antumbra's suppression
of global error diagrams. Raw-HTML details, local images/links, Shiki highlighting,
heading anchors and scoped footnotes remain supported. React adds no client state.

Chromium 151 checked desktop 1440×1000 and narrow 390×844 dark/reduced-motion:
actual Mermaid diagrams, malformed-source fallback without a global error diagram,
zoom/fullscreen/SVG export, images/gallery/downloads, live pause/resume, retained
reading details, cached Back and no-JavaScript image/source reading. No page errors
were observed. Artifacts are local at `/workspace/artifacts/work-board-antumbra`.
Physical device lifecycle and step 07 representative-reader timing remain unproved.

The full `pnpm ready` handoff passed: 1,166 package tests, four expected failures,
one intentional skip, 212 Work Board tests, seven orchestration checks, real
PostgreSQL and every packed consumer. The quality baseline stayed at 2,547.
The new renderer regression covers GFM, local image/link resolution, duplicate
heading anchors and lazy images without duplicate preload requests. Existing
search/navigation/history/footnote regressions passed. A recovery test now awaits
both document replacement and completion of the independently settling live reads.

## Step 11 visual-document acceptance

Work Board 0.7.0 implements the user's approved `remark-directive` convention:
fixed metric, progress and timeline containers with ordinary Markdown labels,
source links and body content. GFM tables provide comparisons and GitHub-style
alerts provide callouts. The [real project brief](./README.md#delivery-at-a-glance)
uses each format. Its progress tally is authored implementation evidence;
representative-reader acceptance remains explicitly unknown.

Missing or unknown counts never fabricate a percentage. Invalid, blank, oversized
or nested inputs retain their source with a diagnostic and leave subsequent prose
readable. The shared unified parser replaces the remaining Satteri board parser;
legacy heading boards, search, backlinks and local links remain covered.

The final full `pnpm ready` passed: 1,190 package tests, four expected failures,
one intentional skip, 236 Work Board tests, seven orchestration checks, real
PostgreSQL and every packed consumer. The quality baseline stayed at 2,547.
Regressions include malformed/blank attributes, provenance, zero versus unknown,
authored timeline order, bounded input, callouts, legacy boards and source fallback.

Chromium 151 read the actual brief on desktop 1440×1000 and narrow 390×844
in dark/reduced-motion mode, with external network requests blocked. It checked
source links, native progress, unknown metrics, authored chronology, callouts and
comparisons; live pause/resume preserved the displayed tally until resumed.
Malformed inputs retained diagnostics and later prose. No-JavaScript reading,
source navigation and browser print/PDF retained the visual documents' text.
No page errors were observed. Local artifacts are at
`/workspace/artifacts/work-board-directives`. This checks browser print readability; document export is outside scope.
Physical-device lifecycle and step 07's representative-reader timing remain pending. Other Markdown readers show the directive markers
and ordinary body text; nested composition stays deferred to step 23.

## Step 12 scope decision

The user rejected document export because none of the proposed stories establishes
a Work Board use case. Agent results belong in ordinary Markdown reports and
in-app reading/review. External one-pagers, presentations and shareable artifacts
belong outside this project. Static snapshots and offline packets do not justify
their complexity. Export is removed from all waves, rather than deferred.

Step 12 remains open for copyable project/investigation/result templates, useful
empty-folder guidance and basic print readability. Step 23 focuses on linked review
inside Work Board. The export API/dependency discussion is closed; no export
implementation or dependency was added.

## Step 12 onboarding acceptance

Work Board 0.7.1 gives an empty workspace a useful 200 response at `/` without
creating files; missing document URLs still return 404. `/_board/start` remains
available from the sidebar after source files are added, through SSR links and
the shared native page RPC. Three readonly, keyboard-copyable Markdown templates
cover project goals/criteria, investigation options/recommendation, and agent
results with actual checks, limitations and next action. IDs/references are explicit;
placeholder evidence remains commented out and does not become a recorded claim.

The final full `pnpm ready` passed: 1,194 package tests, four expected failures,
one intentional skip, 240 Work Board tests, seven orchestration checks, real
PostgreSQL and every packed consumer. The quality baseline remains 2,547. New
regressions cover empty-root/no-write behavior, readonly exact source, missing-path
and loopback handling, valid template references, unknown evidence, source creation
through an external tool, persistent native template reading, and no-reload
Getting started navigation/Back.

Actual Chromium 151 checked 1440×1000 and 390×844 dark/reduced-motion with the
copyable source: keyboard select-all, empty guidance, externally saved templates,
linked project/investigation/result reading, native Getting started navigation and
Back, no-JavaScript templates/links, unchanged source files, and document print/PDF.
A separate browser check held the Mermaid import pending and verified print shows
the diagram source while hiding live controls. No page errors or horizontal mobile
overflow were observed. Artifacts: `/workspace/artifacts/work-board-onboarding`.
This is implementation/browser evidence, not representative-reader timing or
physical-device adoption. No export, init command, project writer, new frontmatter
contract or dependency was introduced. Step 13 reading-workflow review remains next.

## Step 13 reading-workflow review

The [actual reading investigation](./delivery/reading-review.md) records the
combined technical review and open human judgments. Chromium 151 read the real
project brief and delivery plan through a linked reference folder, at 1440×1000
and 390×844 dark/reduced-motion; keyboard skip navigation and no-JavaScript
reading passed. A separate 50-document/100-item fixture passed search,
favorite/duplicate-heading passages, paused external edits/resume, offline
reconnect/open-details preservation, rename/delete and malformed-source reading.
Artifacts are local at `/workspace/artifacts/work-board-reading-review`.

New real HTTP embedding regression composes Work Board and application health
routes in one Effect server, preserves Work Board's loopback guard and closes the
server on scope disposal. Five sequential fresh-server performance observations
are recorded with the reference machine and warm-process/polling limits in the
investigation. They establish no performance budget or representative-reader
timing claim.

Step 13 remains unchecked until the remaining acceptance is reviewed. Step 07's
representative-reader target, physical-device adoption and actual bfcache evidence
remain pending; the wave is not silently accepted by automated checks. D2's
[before/after examples and alternatives](./delivery/response-write-examples.md)
are prepared for discussion, not an approved writer/schema. No source mutation
or export capability is introduced by this checkpoint.

Full `pnpm ready` passed: 1,195 package passes, four expected failures, one
intentional skip, 241 Work Board tests, seven orchestration checks, real PostgreSQL
and every packed consumer; quality baseline remains 2,547. Work Board 0.7.2
packages this regression/documentation checkpoint without changing runtime APIs.
The actual reading investigation rendered with its two explicit requests in
Overview; automated checks do not fulfill either requested human judgment.


## Steps 14–15 response and wait acceptance

The user approved D2 and authorized the response implementation while the
representative-reader judgments in 07/13 remain pending. Those boxes stay open;
this checkpoint does not retroactively accept wave 1's human or device evidence.
Work Board 0.8.0 provides the [approved response contract](./delivery/response-write-examples.md):
explicit `--responses` / embedding opt-in, browser-local drafts, and separate
immutable question/context and reply Markdown. The original document is preserved.
A response identifies exactly the item, request, source path and reviewed UTF-8
text; it cannot silently approve a changed source. Answers (including no),
clarification and deferral remain feedback, not request closure or acceptance.

The native `question`, `response` and per-question `wait` CLI commands share the
same Effect contract and local RPC command path. First durable registration starts
a 48-hour deadline; reattachment/page visits do not reset it. Waits are repeatable
and nondestructive, with an explicit next-response cursor. An unanswered deadline
has exit 2 and leaves late replies available. Transport/index failures remain
unavailable, including when an outage prevents deadline verification. Malformed
or ambiguous history never establishes that a human left the question unanswered.
The server leases each request for 30 seconds and reconciles once a second; pending
leases return only the question and next reply, not the full conversation history.

Full `pnpm ready` passed: 1,212 package passes, four expected failures, one
intentional skip, 258 Work Board tests, seven orchestration checks, real PostgreSQL
and all packed consumers. Quality baseline stays 2,547. Regressions cover explicit
opt-in/source-form rejection, exact revision and unchanged original bytes,
restart/read-before-wait/repeated writes, renamed/deleted sources and escaping
symlinks, conflicting destinations, actual permission failure, and injected
post-publication/reconciliation synchronization failures over real persisted files.
They also cover clarification/next-reply delivery, edited deadline exit/late reply,
draft expiry/quota/corruption, owned-form refresh, revision difference, native
saved feedback and edits made while an earlier submission completes. Packed
consumers prove import-safe browser/server entries and NodeNext declaration paths.

Actual Chromium 151 checked desktop 1440×1000 and narrow 390×844 dark/reduced-motion:
native navigation without reload, draft reload, external source changes, 20
concurrent CLI waits, an abruptly stopped/restarted production server, killed-waiter
reattachment, matching attributable outputs, repeat reads, unchanged original
source bytes, and no-JavaScript saved feedback. Holding a successful acknowledgment
in the browser's real fetch path proved newer input remains unsaved, gets a fresh
response identity and survives reload. No page errors or narrow overflow occurred.
Artifacts: `/workspace/artifacts/work-board-responses`.

The final agent bundle is 368,867 bytes (360.2 KiB), without the renderer, Mermaid,
watcher, AtomRegistry or a per-waiter daemon. On Linux/Node 24.19.0, AMD EPYC 9V74,
20 registered idle waiters used 585.32 MiB summed PSS (about 29.3 MiB each), versus
1,014.22 MiB summed RSS including repeated shared pages. Each held 19 descriptors;
CPU counters advanced zero ticks over a five-second idle sample with no concurrent
handoff. These are observations on the shared managed machine, not budgets,
zero-resource claims, or a 48-hour/90-minute soak. Harnesses own model wakeup and
shell lifetime; the passive wait is not D3's agent launch/handoff adapter.

The first safe publisher requires Linux directory descriptors, `/proc/self/fd`,
hard links and directory synchronization. It synchronizes the workspace and new
record before confirming no-replace publication; equal-content retries reconcile
and synchronize again. Other supported Node platforms retain reading and explicitly
reject publication. Moved/duplicated records and changing write boundaries remain
explicit failures. Outside-editor changes after preflight cannot be made a universal
transaction; saved records retain reviewed context instead of replacing that editor's
source. Direct source replacement/undo (17) is now deferred by the ownership
decision below; D3 is approved and D4 before 24 remains open. No export or cloud service was introduced.


## Step 16 rich question and decision acceptance

The 0.9.1 integrity follow-up rejects syntactically damaged or unterminated
frontmatter in the published `responses/` namespace as unknown history. The native
read/wait and actual HTTP regression failed before the fix and passes after it;
ordinary malformed Markdown outside that namespace remains readable. Actual
Chromium 151 and the bundled CLI prove a damaged record produces unavailable
history rather than an empty list, the waiter emits no false unanswered result,
the draft survives, and repairing the record delivers late feedback through the
original wait without rearming. Desktop and narrow dark/reduced-motion recovery
had no page errors or overflow; original source bytes stayed unchanged. The
deadline boundary was exercised by moving registered timestamps past 48 hours,
not a real 48-hour soak. Artifacts:
`/workspace/artifacts/work-board-response-integrity`.
Full `pnpm ready` passed: 1,263 package passes (270 Work Board), 12 expected
failures, four intentional skips, ten orchestration checks, real PostgreSQL and
every packed consumer. Quality baseline is 2,544 on this updated main; the fix
adds no baseline exceptions. Log: `/tmp/work-board-integrity-ready.log`.

Work Board 0.9.0 implements the [approved packet contract](./delivery/decision-write-examples.md):
agent-authored Markdown/directive templates with rich context, local Mermaid,
single/multiple selections, text prompts and additional human text. One submission
returns optional typed answers and a readable response through the existing logical
wait. The server checks prompt/option identities and completeness against captured
context; original source files remain unchanged. Explicit superseding identity links
immutable direction without rewriting tasks or claiming acceptance.

Meaningful regressions cover partial/forged/duplicate/overselected packets, text-only
rejection of framing, ambiguous/nested controls, request scoping, CRLF derived text,
relative/reference links and images, native wait/replay/idempotence, stale saves,
source moves, explicit supersession, safe rich HTML handling, draft recovery and
workspace memory isolation (including shared namespace prefixes).

Actual Chromium 151 checked desktop 1440×1000 and narrow 390×844 dark/reduced-motion,
local Mermaid, keyboard selection, blocked partial submission, packet draft reload,
a real bundled CLI wait receiving the entire packet, exact preview/body agreement
from CRLF source and unchanged original bytes. Text-only superseding direction,
changed-template selection clearing with persisted recovery, unchanged-byte source
moves, deletion/restoration recovery and no-JavaScript saved history/source fallback
passed. No page errors or narrow overflow occurred. Artifacts:
`/workspace/artifacts/work-board-decisions`.

Full `pnpm ready` passed: 1,223 package tests (269 Work Board), four expected failures,
one intentional skip, seven orchestration checks, real PostgreSQL and every packed
consumer, including the 0.9.0 CLI banner. Quality baseline remains 2,547. Final log:
`/tmp/work-board-decisions-release-ready.log`. The agent bundle is 369,150 bytes
(360.5 KiB), without the new parser/renderer or a per-waiter daemon; no new memory
budget or long-duration soak is claimed. Linux-only publication, local-only operation,
48-hour wait semantics and browser draft bounds remain unchanged. Representative-
reader timing, physical devices and actual bfcache adoption evidence remain pending;
these fixtures do not accept steps 07/13. Direct project editing/undo is deferred;
D3 is approved; D4 remains an open contract.

## Step 17 ownership decision

The maintainer approved ordinary agent file editing and human-owned response
content on 6 October 2026. Agent changes win outside the response area; Work Board
owns the human response inside it. Agents must not need a special mutation or
acknowledgment protocol. Keep practical drafts, revision checks and ordinary save
failure handling; rare concurrent-editor races and possible text loss are accepted
best-effort limitations rather than a reason to build a universal filesystem
transaction or recovery engine.

The current writer still publishes separate question/response records and leaves
project source unchanged. This decision does not invent an inline-response format,
remove existing validation, or prove new editing behavior. The
[examples and delivery consequence](./delivery/source-editing-examples.md) defer
direct item editing/undo, leave 17 unchecked, and permit step 18 under the approved D3 file/copy convention. Step 07/13 representative-reader and physical-device evidence remains
outstanding. This checkpoint changes documentation only.

The [approved D3 convention](./delivery/handoff-examples.md) uses ordinary
Markdown direction and file-edited receipt, with a copied pointer into an existing
session. Optional harness notification and explicit CLI launch remain outside
this checkpoint. Receipt, execution, result and acceptance remain distinct.

Documentation handoff verification passed on updated main: full `pnpm ready`
with 1,295 package passes (270 Work Board), 12 expected failures, four intentional
skips, 15 orchestration checks, real PostgreSQL and every packed consumer. Quality
baseline is 2,539 with no new exceptions. The 107 local prose-link targets exist.
Log: `/tmp/work-board-ownership-ready.log`. Runtime, schemas and version are
unchanged; no new browser or handoff acceptance is claimed.


### 18 Local handoff checkpoint

D3 approved ordinary Markdown direction plus a copied instruction for an existing
agent session. Work Board prepares a stable handoff with exact reviewed source,
goal, constraints and next action; receipt is explicitly separate from execution
and acceptance. Native RPC/browser navigation and the existing publisher/draft
store are reused. No new dependency, harness launcher or cloud service.

Actual Chromium 151 at 1440x1000 and 390x844 dark/reduced-motion checked local
Mermaid context, navigation without reload, persistent drafts, keyboard clipboard
copy, external source edits, unchanged original source, SSR/no-JavaScript reading
and server/browser restart. The current Codex session read the exact copied file
through ordinary tools and edited its acknowledgment; the page displayed it.
This is an automated human browser plus the implementation agent, not an
independent model task run or representative-reader timing.

Regression coverage checks same-ID retries preserving acknowledgment/extra fields
even after source deletion/restart, changed source/direction, moved/duplicate IDs,
read-only mode, explicit rejection/unavailability, malformed history and symlinked
publication directories. DOM coverage checks draft ownership during live reads,
re-preview on changed context and the manual-copy clipboard fallback.

Full `pnpm ready` passed: 1,306 package passes (281 Work Board), 12 expected
failures, four intentional skips, 15 orchestration checks, real PostgreSQL and
all packed consumers. Quality baseline remains 2,539. Browser recovery checks
forwarded real local HTTP publication before dropping its response: the UI
reported uncertainty and a same-ID retry retained one file. A held real HTTP
completion preserved newer draft text across reload. Local Claude CLI absence
was explicitly recorded by this Codex session, without launching another tool;
this is local availability evidence, not a test of every agent harness.
The existing passive-wait bundle is byte-identical to published 0.9.1; no new
memory or 48-hour soak claim. The 151 vision prose-link destinations exist.
Evidence: `/tmp/work-board-handoffs-confirmed-ready.log` and
`/workspace/artifacts/work-board-handoffs`.
Step 07/13 reader timing, physical-device/actual-bfcache evidence remain pending;
17 direct editing/undo stays deferred and D4 before 24 remains a discussion gate.
