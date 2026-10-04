# `@shivaedev/work-board`

A tiny local server that shows a folder of markdown files as a live page. Edit a
file and every open page updates in place, with no reload, no rebuild and
nothing to publish.

```sh
pnpm add --global @shivaedev/work-board
work-board ./project-notes --port 4747 --home plan.md
```

It listens on `127.0.0.1` only and answers only requests addressed to a
loopback host. Every `.md` file under the folder appears in the top bar with how
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
The page uses system fonts and follows the light or dark colour scheme.

| Option | Default | Meaning |
| --- | --- | --- |
| `<dir>` | required | The folder to serve. |
| `--port` | `4747` | The port on `127.0.0.1`. `0` picks a free one. |
| `--home` | none | The file shown at `/` as a board, relative to the folder. The command stops with an error unless it leads to one of the markdown files listed from the folder. Without it, `/` shows the first file as a document. |

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
