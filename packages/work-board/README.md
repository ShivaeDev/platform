# `@shivaedev/work-board`

A tiny local server that shows a folder of markdown files as a live page. Edit a
file and every open page updates in place, with no reload, no rebuild and
nothing to publish.

```sh
pnpm add --global @shivaedev/work-board
work-board ./project-notes --port 4747 --home plan.md
```

For an empty folder, omit `--home` until its home file exists. It opens
getting-started guidance at `/`. **Getting started** in the
sidebar remains available at `/_board/start`, with copyable project, investigation
and agent-result Markdown templates. Focus a template text area, select all and
copy; save through your editor or agent tool. Replace example IDs and matching
references, and record evidence only after an actual observation. Read-only mode does not create project files. Templates and links also work without JavaScript.
Browser print focuses on the document; document export is outside product scope.

It listens on `127.0.0.1` only and answers only requests addressed to a loopback
host. Every `.md` file under the folder appears in the collapsible sidebar with
how long ago it changed. Below the folder, files and folders starting with a dot
and `node_modules` are never entered. Only Markdown appears in the sidebar;
supported local images are served when explicitly referenced below. The folder
itself may be a dot folder such as `.notes`.

Directory symlinks explicitly include reference folders, including ones outside
the workspace. Their Markdown keeps the link's workspace-relative URLs. Broken
links, ancestor links and directory cycles are skipped. File symlinks stay inside
the workspace or the reference directory containing them. Unlisted paths and URL
traversal are never served. One long-lived process picks up new files and edits
without a restart.

For example, include the main checkout's documentation without copying it:

```sh
ln -s /path/to/platform/docs ./project-notes/reference
work-board ./project-notes --home plan.md
```

Read `/reference/framework/README.md` and follow its relative Markdown links.
Only link directories you intend to expose locally. Multiple aliases remain
separate source paths; if they repeat an explicit item ID, existing ambiguity
rules apply rather than choosing an identity winner.

Pages render GitHub Flavored Markdown on the server: tables, task lists,
footnotes, raw HTML (including `<details>` with markdown inside) and fenced code,
highlighted with Shiki's GitHub light and dark themes. Raw HTML is not
sanitized, so serve only folders you trust. Pages send a content security
policy that allows only the board's own scripts, and `Cache-Control: no-store`.
The page uses system fonts. Theme can follow the system or stay light or dark.
Theme, compact/comfortable density, and sidebar visibility are remembered in
browser storage for this folder and server origin. When storage is unavailable,
controls still work for the current page and show a notice.

The file location appears above the content. Documents use a readable line
length; boards use a wider grid that stacks on narrow screens. The sidebar has
its own scroll area and starts collapsed on narrow screens unless a saved
preference says otherwise. A keyboard skip link moves directly to the content.

| Option | Default | Meaning |
| --- | --- | --- |
| `<dir>` | required | The folder to serve. |
| `--port` | `4747` | The port on `127.0.0.1`. `0` picks a free one. |
| `--responses` | `false` | Explicitly enable local question/response/handoff writes. The first writer requires Linux, a real workspace directory, `/proc/self/fd`, hard links and directory synchronization. Reading remains available on other supported Node platforms. |
| `--home` | none | The file shown at `/` as a board, relative to the folder. The command stops with an error unless it leads to one of the markdown files listed from the folder. Without it, `/` shows the first file as a document. |

## Hand a task to an existing agent session

Open a uniquely identified project item and choose **Prepare an agent handoff**.
Review the current Markdown/Mermaid context, enter a local recipient label, goal,
constraints and next action, then preview and prepare. The existing `--responses`
opt-in also enables this writer. Work Board creates `handoffs/<id>.md` with a stable
ID, direction, original source path/revision and the exact reviewed source below
its frontmatter, including declared criteria. Context is limited to 256 KiB.

**Copy tiny prompt** gives you a short instruction containing the absolute file
path. Paste it into the agent session you already use. Preparing a file records
`requested`; it does not wake or launch an agent. Without clipboard permission,
the prompt is selected for manual copying. Saved handoffs remain readable without
JavaScript; preparing them requires JavaScript and the existing Linux writer.

The agent reads the file and edits `handoff.state` to `acknowledged`, `rejected`
or `unavailable`, with optional `handoff.by` and `handoff.note`. These are literal
local labels and receipt, independent of task status, execution or human
acceptance. Agents can keep using the existing question poll/wait commands for
human answers. No acknowledgment command or special project editor is required.

Retries using the same handoff ID preserve the agent's receipt and extra metadata;
conflicting direction, moved/duplicate IDs and a changed source before initial
preparation are rejected. A missing receipt remains unconfirmed, including after
restart. Saved context remains inspectable if the source disappears or changes.
Drafts share the existing browser-local workspace store and its 30-day/2-MiB
bounds; clearing that store clears response and handoff drafts together.

## Local responses and one logical wait per question

Start one shared server with explicit write opt-in:

```sh
work-board ./project-notes --responses --port 4747
```

Use an existing explicit open attention request. In its **Work details and source**,
choose **Respond to this request**, review the exact source and SHA-256, enter a
local author label, and preview the Markdown before recording it. An answer may
say no; **Ask back / clarify** and **Not now** are separate reply kinds. These
labels are not authenticated identities. Recording a reply never changes source
status, closes an attention request, executes an agent or establishes acceptance.

The app creates immutable question/context and response Markdown files in
`responses/`. Original documents remain untouched. Questions identify the item,
request, source path and exact bytes reviewed; changing either the source bytes or
path creates a different generation. A stale save retains the draft and requires
review/preview again. The preview names both files and all authored fields; the
server assigns registration and recorded timestamps when saving.

Drafts use separate browser-local storage per workspace/origin: 2 MiB total and
30 days since the last edit. **Clear workspace drafts** affects drafts, not saved
source or Mark seen history. Expiry, corrupt/unavailable storage and quota failures
are disclosed. Text remains in the current window after a storage/save failure.
Navigation, reload and live source refresh preserve retained drafts; changed
context must be previewed again. Another unsaved edit made during submission is
retained. Saved feedback also remains readable without JavaScript.

An agent uses these short command names against the shared server:

```sh
# Read the exact current question/context and its reviewedRevision (no write).
work-board question investigation.model/review-model

# Register that reviewed generation and wait for one attributable reply.
work-board wait investigation.model/review-model --revision <reviewedRevision>

# After registration, repeat this same wait after a killed shell or restart.
work-board wait <question-id>

# Retrieve the saved conversation without waiting or consuming any reply.
work-board response <question-id>

# After a clarification/deferral, wait for the next response explicitly.
work-board wait <question-id> --after <response-id>
```

`--port` selects another local workspace/server; `--url` accepts only an HTTP
loopback origin. There is no hidden workspace discovery or automatic server launch.
Register-and-wait reports its stable question ID and deadline on stderr. Its stdout
is one JSON result containing the attributable question/context and response;
exit 0 means a recorded reply, including no/clarification/deferral, not approval.
Exit 2 reports an unanswered 48-hour deadline; other failures exit nonzero with
stderr diagnostics. `question` and `response` are explicit read commands.

The human deadline starts at first durable registration and does not reset when
rearming, revisiting a page or previewing. A deadline never deletes/cancels the
question. Late replies remain readable and take precedence over an old timeout.
A missing cursor fails explicitly. Replies can be read repeatedly; this provides
recovery, not exactly-once agent action. The server's 30-second request leases and
one-second reconciliation checks are distinct from the human's 48-hour deadline.
During a transport/index outage, waits retry the same question; at the deadline,
an unavailable service is reported as unavailable rather than falsely unanswered.
Damaged frontmatter in the `responses/` record namespace also makes history
unavailable; repair the record before treating its question as unanswered.

The client uses bundled native Effect RPC over the existing local command path.
Serving imports are loaded only for the server command. Each waiter has no
renderer, Mermaid, filesystem watcher, AtomRegistry or daemon. A pending lease
returns only its question and next reply, not the entire conversation history.
Harnesses own model wakeup and shell lifetime: completion is not a universal
promise of autonomous agent continuation. Re-read/reattach when your harness does
not inject a completed shell result.

Publication holds Linux directory descriptors, writes and synchronizes a private
temporary file, publishes with a no-replace hard link, then synchronizes the
response directory. Retries reconcile the same identity/content and never replace
another contribution; a moved/duplicated/conflicting identity is rejected.
Symlinked reference folders grant read access only. Changed/moved directories,
permissions, unsupported filesystem capabilities and uncertain outcomes remain
explicit. An unrelated editor can change the reviewed source after a preflight
check; immutable replies still identify the exact reviewed bytes and never claim
an atomic transaction with that editor. Directory moves after publication can
produce an uncertain result; reconcile saved source before retrying.

Source HTML cannot submit write forms: CSP disables form actions/frames, the
native route requires same-origin/loopback and NDJSON when writes are enabled,
and the official response surface renders reviewed context with raw HTML disabled,
with an escaped exact-source disclosure. Embedded apps must
explicitly opt in with `boardLayer({ root, responses: true })` and own the trusted
host boundary. There is no write endpoint for arbitrary paths or source rewriting.

## Local visual evidence

Use ordinary Markdown such as `![Review screenshot](shots/review.png)` or
`[Open screenshot](shots/review.png)`. PNG, JPEG (`.jpg`/`.jpeg`), GIF and WebP
paths resolve relative to the source file, including a nested home served at `/`.
The local image route serves at most 16 MiB per file, checks the resolved path on
every request, and refuses hidden/dependency paths, traversal and links outside
the workspace. Outside-workspace reference folders retain their Markdown support;
their images must be copied inside the workspace to be served. SVG, HTML, PDF and
arbitrary attachments are not served through this route.

Open a local image link (including an evidence source), or click/focus an embedded
image and press Enter, to inspect a gallery of the
current document's images. Previous/Next and arrow keys select images. Zoom from
25% to 800%, scroll, Fit, Actual size or Fullscreen to inspect details; Escape closes the viewer
and restores source focus. **Save locally** uses the browser download mechanism.
An unavailable image keeps its alt text and explains the local path/type/boundary
and size checks. Images still render through ordinary GET requests without JavaScript.

A rendered Mermaid diagram has **Inspect diagram**, with the same zoom, scrolling,
fullscreen, Actual size and keyboard dismissal, plus a local SVG download of its current
drawing. Failed diagrams expose their source and a readable error; source remains
visible without JavaScript. When fullscreen is unavailable, scrolling still works.
An open preview remains the earlier drawing/image after a source update, discloses
that state and requires reopening before saving. Image edits trigger conservative
native reconciliation and image reloads, respecting Pause/Resume. The explicit
Mark seen baseline stays Markdown-only: image bytes are not captured or retained.
Viewing and downloading do not write source files or imply verified acceptance.

## Document navigation

Markdown headings have passage links and an **On this page** outline, including separate
anchors for duplicate headings. Use the heading's `#` link to copy a passage URL.
Generated anchors use the heading text and duplicate order; changing either can
change the anchor. Renaming a file changes its document URL. Authored HTML IDs
and footnote links remain intact. Richer files can declare stable work-item IDs.

Markdown links resolve from their source file, including a nested `--home` file
served at `/`. Links within the workspace open in place; modified clicks and
links targeting another window keep their normal browser behavior. The browser
title and active file tooltip follow the document's main heading.

Back and forward restore the previous scroll, selected text, and open details.
The client keeps up to 30 page snapshots and tab-scoped reading records; it
fetches the current file again on return so changes and deletions are visible.
A missing document explains what happened, and a missing passage shows a notice.

**Save favorite** pins a document to the sidebar. Recent documents are deduplicated
and limited to the last ten. Favorites and recents use browser storage scoped to
the folder and server origin. Deleted favorites remain visible with a missing
label. If storage is unavailable, favorites and recents work on the current page;
reading navigation still works in the open tab. Content and the outline remain
readable with JavaScript disabled.

## Workspace search

Use **Search** or Ctrl/Cmd+K to find document titles/paths, Markdown headings, and
passage text. Results identify their type and source file/line where known, include text snippets,
and open the corresponding heading when available. Matching is case-insensitive
with Unicode normalization; all query terms must occur in a block. Titles rank
before headings, then passages, with stable source order within each group.
Results are limited to 40 and report the full match count. This is deterministic
text search, without fuzzy matching or semantic inference.

Arrow keys choose a result while the search field is focused; Enter opens it.
Escape closes the dialog and restores focus. With an empty query, commands open
the workspace or change the existing sidebar, density, and theme controls.

The server keeps a rebuildable index in memory and invalidates it when the file
watcher changes. An open dialog refreshes on edits and reconnects; older requests
cannot replace a newer query. Hidden entries, `node_modules`, and escaping standalone file
symlinks are excluded; linked reference directories are included. Unreadable
files produce an incomplete-results notice.
All indexing and requests stay local. Search needs JavaScript; document reading
does not. Source-in-editor links await an agreed local editor mechanism.

## Optional work identity

A Markdown file can begin with YAML frontmatter declaring an explicit `id`,
`kind`, `status`, `owner`, `next_action`, relationships, criteria, board membership,
and evidence. Every field is optional; ordinary Markdown and heading boards need
no migration. [Source examples and shapes](./docs/vision/delivery/source-examples.md)
describe the convention. No section name becomes a status or workflow rule.

Work details show recorded fields, source locations, and the original header.
Malformed/unknown fields, duplicate IDs, and unresolved references remain visible
with diagnostics while prose stays readable. A unique ID has a shareable
`/_board/item/<id>/` link that survives file/heading renames; criterion links open
and focus their context. Search also finds explicit work fields and criteria.
An incomplete index cannot assert unique identity. The index rebuilds from files
without persistent storage; the UI never writes project content.

Evidence records show their source, criterion, checked revision, observed time,
method, and recorded outcome when provided. They are source claims, not
independently verified acceptance; missing provenance stays **Not recorded**.

## Work views

Open **Work** to read identified items as a board or table. A `kind: board` file with a
unique ID and an explicit `items` list defines a selectable view; the same item
can appear in several boards. Board definitions are excluded from All work.
Missing/ambiguous members and repeated membership are disclosed without choosing
a duplicate source or counting repeated items twice. Legacy heading cards remain
on their original pages and do not become inferred identified work.

Columns use the exact recorded status, including a **Status not recorded** column.
Filter by status, owner, or work text and sort by title, owner, or status. Missing
values differ from literal text and sort last. Cards open a source detail pane;
its Markdown links resolve relative to its file. The URL records the board,
filters, sort, and selected ID, so reload and Back/Forward restore that context.
A selected item outside the filters stays visible with a notice; deletion or
ambiguous identity is explained. Live changes retain applied filters, including
filters with no current matches. Compact density applies to these cards too.
Board and table use the same projection and selection; switching layouts keeps
that URL context. Table rows show kind, status, owner, and next action, with
missing fields disclosed and the same source detail pane. Narrow tables scroll
inside their own container; compact density reduces row/card spacing.
Native links and GET filters remain usable without JavaScript.

Save up to 10 named views in browser storage scoped to the workspace and server
origin. A view retains the applied board, filters, sort, and layout; item selection
stays in its shareable URL. Saving the same name updates it. At capacity, remove
one or update a name; views are never silently evicted. Remove one or clear all
from the view picker. Unsafe stored destinations are ignored. If storage is
unavailable, named views work for the current page only; source files are unchanged.
Saving requires JavaScript; board/table reading does not.

## Attention overview

Open **Overview** to read explicit decision, review and blocker requests grouped
by kind and ordered by source title, item ID and request ID. Each entry shows the
recorded reason, response labels, target links and origin file/line. Opening it
focuses its source request, beside ordinary Markdown reasoning and evidence.
Source edits refresh the queues; native links also work without JavaScript.

Add optional [attention records](./docs/vision/delivery/attention-examples.md) to
item frontmatter. Status, owner, next action, file activity and finished runs do
not imply requests. Closed requests remain readable/searchable without implying
an answer or acceptance. Duplicate IDs, invalid records and unresolved targets
stay outside the queues with source diagnostics. An incomplete index withholds
counts rather than presenting a quiet workspace. The viewer never writes source
files or interrupts/starts agents; recipients are authored local labels.

## Changes since seen

Open **Changes**, then **Start remembering changes** to record one explicit
browser-local workspace baseline. Live updates and opening the view never mark
changes seen. After review, **Mark current workspace seen** replaces it;
**Clear remembered history** removes it and stays off until you start again.

Compare additions, removals, explicit field changes, decision Markdown and
recorded evidence with current source links and escaped before/after source text.
Unique explicit item IDs can match moved files; ordinary renames show removed
and added paths. Duplicate IDs have no winner. Content comparison ignores mtime
and does not establish authorship, decision acceptance or verified evidence.

Each origin/workspace retains at most one 2 MiB serialized snapshot for 30 days.
Old/deleted source may remain until replacement, clearing or expiry; expired data
is removed on the next workspace visit or an open-page check. Invalid/unsupported
history, incomplete reads and oversized workspaces are explained without invented
removals or truncated history. Blocked storage allows a disclosed page-only
baseline. The local server validates and compares observations without retaining
history, modifying Markdown or contacting a cloud service. Without JavaScript,
Changes explains the limitation while source reading, Overview and Work remain usable.

## Reasoning and evidence context

Follow explicit relationships from a result to its plan and decision. Decisions
keep options, comparisons, and rationale in ordinary Markdown; no new decision
fields are required. **Referenced by** lists incoming relationships, board
membership, criterion claims, evidence-source links, and local Markdown hyperlinks,
including plain files without frontmatter. Relative/encoded paths and root home
links use the source file's location. Repeated prose links from one file count
once; code examples do not become links. External URLs are not local backlinks.
Incomplete workspaces disclose partial references and do not select ambiguous IDs.

Each uniquely identified criterion lists claims recorded across the readable
workspace, with links to their source records. Missing claims say that acceptance
is not established. A record shows origin file/line, checked revision, observed
time, method, and outcome; missing provenance stays **Not recorded**. Old recorded
revisions remain visible, and Work Board does not compare them to a current Git
revision or infer human acceptance. Missing local Markdown evidence sources remain
linked with a notice. Generated `recorded-evidence-<index>` anchors follow source
array order and may change after insertion/reordering; item and criterion IDs are
the explicit stable references. Backlinks/claim associations rebuild on file
changes and after restart, without writing an event history.

## Diagrams

A ` ```mermaid ` block is drawn in the browser. Mermaid loads from the installed
package, and only on pages with a diagram.

- A diagram is drawn into space reserved for it; its source is never shown
  while it is drawn or redrawn.
- A drawn diagram stays in place when the page around it updates. An edited
  diagram keeps its old drawing until the new one is ready, as long as the page
  keeps the same number of diagrams; otherwise it shows its reserved space.
- Diagrams follow the light or dark colour scheme; switching schemes redraws
  them in place.
- A diagram that does not parse shows its source and the error, without the
  drawing it had before.

## Boards

The home file is shown as a board: a title, an intro, then sections of cards
with a count per section in the header. The counts are derived from the
markdown, so they are never typed by hand.

```md
# Project notes

What is open this week.

## In review

### `docs #12` [Refresh the install guide](https://example.com/pull/12)

Checks are green.

## To do

### `ops` Rotate the deploy key

<details>
<summary>Steps</summary>

1. Create the key.
2. Replace the old one.

</details>

## Later

Nothing planned yet.

---

Finished work moves to the changelog.
```

- `#` is the title, and anything before the first `##` is the intro.
- Each `##` is a section. Its `###` headings are its items, and its count is
  the number of items. A section without `###` items, such as "Later", has no
  count and shows its text as one card.
- An item's heading may start with a code span, shown as a quiet tag before the
  title, and the title may be a link. Everything up to the next heading is the
  item's body.
- Markdown inside `<details>` needs a blank line after `<summary>` and before
  `</details>`.
- A `---` after the last heading starts the footer; a `---` inside a card stays
  in the card.
- Reference links and footnotes work inside cards, wherever their definitions
  are in the file, and each card's footnotes get their own ids.

## Live updates

The server watches the workspace and linked reference directories recursively.
Adding or retargeting a directory link rebuilds the watch and triggers catch-up.
Broken links are ignored; after restoring a target that was missing when the
watch was built, restart the server to include it. No reference file is written.
Changes settle for 100 ms, then
`/events` sends one server-sent event naming the markdown files that changed:

```text
event: change
data: {"paths":["plan.md"]}
```

Open pages use locally bundled native Effect RPC and AtomRegistry queries over
`POST /_board/rpc`. The existing GET endpoints and `/events` stream remain
available for compatibility. No browser assets or source data need a cloud service.

Changed hints invalidate affected documents and derived views through former and
current references, board membership, criterion evidence and attention targets.
Unrelated documents keep their mounted query and DOM blocks. Relevant updates
preserve unchanged controls, expanded details and diagrams; changed reading blocks
receive a brief outline without animation. Native GET links and server-rendered
HTML remain usable with JavaScript disabled.

Use **Pause updates** to stop automatic invalidation while reading. The count
reports observed hints, bounded at **256+**, rather than a count of edits or work
completed. Resume and reconnect reconcile the full workspace. A missed server-local
PubSub sequence, unknown path or incomplete index also requires reconciliation;
there is no durable event journal or replay guarantee.

Connection, source-watcher availability, pending reads and read failures remain
separate. The status reports **live** only when the connection and last observed
watcher are available and active page/navigation reads have settled. A failed read
keeps the visible source and reports **refresh failed**. A transport outage or
unavailable watcher reports **reconnecting**. Mark seen remains an explicit action;
pausing never disables clearing or the 30-day baseline expiry.

Each page owns a native streaming HTTP subscription and disposes its registry on
pagehide. Returning from the browser's page cache creates a fresh client. Browser
HTTP connection limits still apply; simultaneous tab capacity is not established.

## Embedding

`boardLayer({ root, home })` is the router Layer the command serves. Serve it
with `HttpRouter.serve` on any Effect HTTP server, or turn it into a fetch
handler with `HttpRouter.toWebHandler`. It needs `FileSystem` and `Path`, for
example from `NodeServices.layer`. It still judges every request by its `Host`
header, so pass requests on with that header: a request without one, or whose
`Host` is not a loopback host, is refused, and so is a request from a
non-loopback address when the server knows the address.

```ts
import { NodeServices } from "@effect/platform-node"
import { Layer } from "effect"
import { HttpRouter } from "effect/unstable/http"
import { boardLayer } from "@shivaedev/work-board/board.ts"

const board = HttpRouter.toWebHandler(
  Layer.provide(boardLayer({ root: "./project-notes", home: "plan.md" }), NodeServices.layer),
)
```

On pnpm 11, installing into a project needs a decision on `msgpackr-extract`,
which `effect` pulls in: pnpm refuses its build script by default, and
`pnpm add` fails with `ERR_PNPM_IGNORED_BUILDS`. Record the decision under
`allowBuilds` in `pnpm-workspace.yaml`, or run `pnpm approve-builds`; `false`
skips the build. `pnpm dlx` and `pnpm add --global` need no setting.

```yaml
allowBuilds:
  msgpackr-extract: false
```

## Product vision

The [north star and visual direction](https://github.com/ShivaeDev/platform/tree/main/packages/work-board/docs/vision#readme)
describe the proposed local workspace for a person and their agents: stay
informed, give direction and coordinate, then collaborate. The
[roadmap](https://github.com/ShivaeDev/platform/blob/main/packages/work-board/docs/vision/roadmap.md)
sets the waves, acceptance criteria, and open design decisions.
[Experience designs and mockups](https://github.com/ShivaeDev/platform/blob/main/packages/work-board/docs/vision/experience.md)
illustrate the target with fictional data. These are future plans; the sections
above describe the package's current behavior.

### Markdown rendering

Work Board uses Antumbra's `react-markdown` and `remark-gfm` libraries for
server-rendered Markdown, with locally served Mermaid for ordinary `mermaid`
fences. Existing local links, images, heading anchors, footnotes, raw-HTML details
and Shiki code highlighting remain available without React client state. Mermaid
rendering and inspection need JavaScript; its source remains readable without it.

### Visual document directives

Use `:::metric{value="50" unit="documents"}`, `:::progress{completed="3" total="8"}`
and `:::timeline` containers with Markdown labels and linked sources. Components
render on the server and remain readable without JavaScript. Unknown counts stay
unknown, invalid components retain their source with a diagnostic, and timelines
preserve authored order. Recorded values do not establish verified acceptance.
See [the complete source conventions](./docs/vision/delivery/visual-document-examples.md).
GitHub alert blockquotes render as callouts; comparisons remain ordinary GFM tables.

## Rich question packets

Agents can prepare Markdown context with `question`/`option` directives and local
Mermaid diagrams. People select options, always add text, and submit the whole
packet once. Use `select="one"`, `select="many"` or `select="text"`; choices start
unselected and a text-only answer can reject the framing. Preview the complete
record before saving. The existing wait returns typed prompt/option IDs and human
text with the readable Markdown and exact reviewed context.

See [the full source example and contract](docs/vision/delivery/decision-write-examples.md).
Ordinary Markdown and older response files still work. Decisions are authored
feedback; superseding direction is explicit and does not establish acceptance or
change tasks. Response-page raw HTML is disabled. Local strict Mermaid and
no-JavaScript readable history/source fallback use the existing renderer; recording
requires JavaScript and `--responses`. Linux-only write support is unchanged.
