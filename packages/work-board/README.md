# `@shivaedev/work-board`

A tiny local server that shows a folder of markdown files as a live page. Edit a
file and every open page updates in place, with no reload, no rebuild and
nothing to publish.

```sh
pnpm add --global @shivaedev/work-board
work-board ./project-notes --port 4747 --home plan.md
```

It listens on `127.0.0.1` only and answers only requests addressed to a
loopback host. Every `.md` file under the folder appears in the collapsible sidebar with how
long ago it changed. Below the folder, files and folders starting with a dot and
`node_modules` are never entered, and anything that is not markdown is skipped;
the folder itself may be a dot folder such as `.notes`. No path outside the
folder is served, and a symlink is followed only when it leads to a place
inside the folder. One long-lived process picks up new files and edits without
a restart.

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
| `--home` | none | The file shown at `/` as a board, relative to the folder. The command stops with an error unless it leads to one of the markdown files listed from the folder. Without it, `/` shows the first file as a document. |

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
cannot replace a newer query. Hidden files, `node_modules`, and symlinks outside
the workspace are excluded. Unreadable files produce an incomplete-results notice.
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

Open **Work** to read identified items as a board. A `kind: board` file with a
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
Native links and GET filters remain usable without JavaScript.

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

The server watches the folder recursively. Changes settle for 100 ms, then
`/events` sends one server-sent event naming the markdown files that changed:

```text
event: change
data: {"paths":["plan.md"]}
```

Open pages fetch their file again and replace only the blocks that changed,
also when blocks were added or removed around them; the rest of the page,
including which `<details>` are open and every drawn diagram, stays as it is,
and the page never reloads. A page that loses the connection shows
"reconnecting" and catches up once it is back. When the open file is deleted
or renamed, the page shows that it is gone. A refresh that gets no page back
keeps the page as it is and shows "refresh failed" until the next one
succeeds.

If watching the folder fails, the server restarts the watch, waiting longer
after each failure. Meanwhile `/events` sends `event: down`, open pages show
"reconnecting", and once watching resumes `event: ready` makes them catch up on
anything they missed.

Each open page keeps one connection to `/events`, and browsers allow only a few
per host, so the intended use is one board per browser.

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
import { boardLayer } from "@shivaedev/work-board"

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
