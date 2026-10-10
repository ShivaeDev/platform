# @shivaedev/work-board

A local workspace for reading your agents' plans, results and questions, then
giving direction beside the source you reviewed. The work stays in Markdown files;
Work Board adds live reading, connected views, attributable responses and
reviewed direction for an existing agent session.

## Keep the work and its context together

An agent's finished run leaves you with another report to read and another question
to answer. Work Board lets you read those files as one workspace, follow their
reasoning and evidence, and find explicit requests for your judgment. Even a small
Markdown plan can become a board:

```markdown
# Documentation review

## In review

### Check the install guide

Read [the proposed guide](guide.md) before choosing the next step.
```

As a home board, the section becomes a column and the heading a card, with its
count derived from the file. Agents keep editing the files with their usual
tools. An open page updates in place while keeping unchanged reading blocks and
expanded details, so the reader can stay with the work as it changes.

## Using it

### How to think about it

A **workspace** is a folder of Markdown files. Those files are authoritative:
plans, reasoning, work fields and recorded evidence remain readable outside the
board. The server builds its document, search and relationship index from them.
Its views arrange the same source for different reading tasks.

A file can declare an optional **item ID**. That ID connects it to other files,
criteria and boards without tying the connection to its filename. A **criterion**
is an explicitly named requirement; an **evidence record** is an author's claim
about an observation. The board displays that claim and its provenance; it does
not run the check or establish acceptance.

An **attention request** explicitly asks for a decision, review or help with a
blocker. It is separate from an item's status. A **question** captures that
request's exact source text, source path and reviewed SHA-256. A **response** is
an independent Markdown record of a person's answer, clarification or deferral.
Responses retain their reviewed context; they do not close requests, change task
status or start an agent. An optional execution integration can acknowledge a
managed decision through a separate immutable request receipt. That receipt is
distinct from a handoff receipt, execution or acceptance.

A **handoff** captures direction and the exact source the person reviewed in
another Markdown file. The person copies its short file instruction into an
existing agent session; the agent records receipt through ordinary file edits.
Receipt states describe acknowledgment, rejection or unavailability, rather than
execution or acceptance.

A **result** is an author's report linked explicitly to work and criteria. Its
recorded status does not change the linked task's status. A result review presents
the report, its claims and limitations with human feedback pinned to the reviewed
source bytes and path. Choosing an authored acceptance option does not supply
missing criterion evidence.

Browser preferences, drafts and the explicit **seen baseline** are personal state,
scoped to the workspace and server origin. They do not change project meaning.
Agents own normal project-file edits. Work Board owns the human response content
it records. An agent's run completion, a recorded answer and an accepted result
remain separate facts.

The work has three parts: choose a workspace once, author useful files per feature,
and read or respond as the work changes.

### 1. Once per workspace: choose the reading surface

```sh
work-board ./project-notes --home plan.md
```

This serves the existing folder on `http://127.0.0.1:4747`. The optional home file
is resolved from that folder and rendered as a heading board at `/`; other files
are documents. Without a home, `/` shows the first listed document. An empty
workspace opens getting-started guidance. **Getting started** remains available at
`/_board/start`, with copyable project, investigation and agent-result templates.
Save them through your editor or agent tool; the reader does not create files.

A heading board uses `#` for its title, text before the first `##` for its intro,
`##` for sections and `###` for cards. A section without cards shows its text.
A `---` after the last heading starts the footer; a divider inside a card before
another heading stays in that card. Code spans, reference links, footnotes and
`<details>` can stay in the Markdown body. Leave a blank line after `<summary>`
and before `</details>` when its content is Markdown.

The sidebar groups Markdown into nested folders and keeps the home file first.
Folder expansion choices survive live file changes; opening a document expands
its ancestors. Empty folders without indexed Markdown stay out of the tree.
File links keep their logical workspace paths, including reference-directory
aliases.

Directory links can include reference Markdown without copying it:

```sh
ln -s ../reference-docs ./project-notes/reference
work-board ./project-notes --home plan.md
```

Explicitly linked directories may live outside the workspace. Their documents use
the link's logical paths, so `/reference/guide.md` resolves its own relative links.
The server watches reference edits and discovers added or retargeted links. Broken,
ancestor and cyclic links are skipped. File links must stay inside their containing
workspace or reference directory. Only link directories you intend to expose.

### 2. Per feature: write the source once

Plain Markdown needs no metadata. Add frontmatter when an item needs stable
identity, connected criteria, work views or an explicit request. Save this as
`search.md`:

```markdown
---
id: work.search
kind: task
status: in-review
owner: agent-navigation
next_action: Review the keyboard evidence
criteria:
  - id: keyboard
    text: Escape returns focus to the search button
attention:
  - id: keyboard-review
    kind: review
    state: open
    response_from: [maintainer]
    reason: Review the keyboard result before continuing.
    unblocks: [work.search#keyboard]
---
# Workspace search

Read the proposed keyboard behavior and its recorded evidence before responding.
```

Every top-level work field is optional. IDs are case-sensitive: an ASCII letter or digit,
then letters, digits, dots, underscores or hyphens. A unique ID opens at
`/_board/item/work.search/`, and its criterion at
`/_board/item/work.search/#criterion-keyboard`. These references survive file and
heading renames while their explicit IDs remain unique.

`status`, `owner` and `next_action` are nonblank authored text. No section title
becomes a status rule. Unknown fields stay in **Original frontmatter** with a
diagnostic; valid independent fields still render. Invalid metadata, duplicate
IDs and unresolved references remain visible without choosing a source winner.
An incomplete index cannot establish unique identity.

A board file selects shared items explicitly. Save this as `review.md`:

```markdown
---
id: board.review
kind: board
items: [work.search]
---
# Review work

Inspect the selected work and its source before giving direction.
```

Open **Work** to switch between boards and tables. The same item may belong to
several boards; a board definition is excluded from All work. Columns use exact
recorded status, with missing status disclosed separately. Filters use status,
owner and work text; sorting uses title, owner or status, with missing values last.
The URL carries board, filters, layout, sort and selected item. Board and table
share the projection and source detail; native links and GET filters work without
JavaScript. Missing, repeated and ambiguous members are disclosed.

Use `relationships` for `implements`, `informs`, `depends_on` or `relates_to`
links to an item or `item#criterion`. A result can record evidence against the
criterion. Save this as `result.md`:

```markdown
---
id: result.search
kind: result
relationships:
  - kind: implements
    target: work.search
evidence:
  - source: evidence.md
    criterion: work.search#keyboard
    method: DOM regression
    outcome: passed
---
# Search result

The recorded check is a source claim. Review its evidence before accepting it.
```

Record an outcome only after an actual observation, and save its supporting
`evidence.md`; omit evidence until that check exists.

`source` is required for an evidence record; `criterion`, `checked_revision`,
`observed_at`, `method` and `outcome` are optional. This example has no checked
revision or observation time, so both stay **Not recorded**. When known, record a
full 40- or 64-digit hexadecimal revision and an ISO timestamp with a timezone.
Source paths resolve from the file holding the claim.

Criteria collect explicitly linked claims across files. **Referenced by** also
shows incoming relationships, board membership, evidence sources and ordinary
Markdown links. Decisions keep their options and rationale in body Markdown.
Old recorded revisions remain visible; the viewer does not compare them with
current Git state or infer human acceptance. See the
[source field reference](docs/delivery/source-examples.md) and
[attention field reference](docs/delivery/attention-examples.md) for complete shapes.

#### Richer reading in ordinary documents

Tables, task lists, footnotes, raw-HTML details and highlighted fenced code render
on the server. Heading passage links and an **On this page** outline distinguish
duplicate headings. Relative document links resolve from their source file,
including a nested home served at `/`.

`mermaid` fences draw locally in the browser. Diagrams follow the theme and keep
unchanged drawings during refresh. A parse failure exposes its source and error;
without JavaScript the source remains readable.

Metrics and progress use fixed directives with a label and a source:

```markdown
:::progress{completed="3" total="8"}
Browser checks recorded

Source: [Reading checks](checks.md)
:::
```

The component shows the authored tally. Unknown or zero-total counts do not
fabricate a percentage; invalid components retain source with a diagnostic.
`:::metric` records a value/unit, and `:::timeline` preserves authored entry order.
GitHub alert blockquotes render as callouts; comparisons remain GFM tables. The
[visual document reference](docs/delivery/visual-document-examples.md) gives full
examples and bounds.

Use ordinary image Markdown for source-relative PNG, JPEG, GIF or WebP files.
The image route serves at most 16 MiB per file inside the real workspace; images
in outside reference folders must be copied inside that boundary. The image gallery
and **Inspect diagram** provide zoom and keyboard dismissal. Local
image downloads and SVG downloads of a rendered diagram use the browser. A source
update marks an already-open preview as older and requires reopening before saving.
These actions do not write source or establish acceptance.

### 3. Every day: read, compare and give direction

**Search** or Ctrl/Cmd+K finds document titles/paths, headings, passages and recorded
work fields. Matching uses the first 200 query characters and up to eight terms;
each of those terms must occur in a block, ignoring case. Titles rank before
headings, then passages. At most 40
results are shown with the full match count. Arrow keys choose, Enter opens, and
Escape closes. Incomplete reads are disclosed, and older requests cannot replace
a newer query. Search requires JavaScript.

Back restores selected text and expanded details. Favorites and recents
belong to the workspace/origin; deleted favorites remain labeled missing. Save up
to ten named Work views with the applied board, filters, sort and layout. Selection
stays in the URL, and saving the same name updates it. At capacity, remove or update
a view; none is silently evicted. Unavailable storage is disclosed, with controls
usable for the current page.

**Overview** groups explicit open decision, review and blocker requests. Status,
owner, file edits and finished runs do not imply a request. Each entry links its
reason, recipients, targets and source context. Closed requests remain readable
without asserting a recorded answer or acceptance. Invalid or ambiguous requests
stay outside the queue with diagnostics; incomplete indexes withhold counts.

**Changes** starts remembering only through **Start remembering changes**. After
review, **Mark current workspace seen** replaces the baseline; **Clear remembered
history** turns it off. Opening a view and receiving live updates never mark it seen.
Compare additions, removals, fields and source text against that one browser-local
baseline. Unique IDs match moved items; plain-file renames are removed/added paths.
The baseline is bounded to 2 MiB and 30 days, with expiry, corruption, incomplete
reads and oversized workspaces disclosed. It holds Markdown, not image bytes.

**Pause updates** holds the displayed reading state while counting observed hints,
bounded at **256+**. Resume and reconnect reconcile the workspace. Unrelated
source edits retain mounted document reads; relevant updates retain unchanged
reading blocks. A failed read keeps visible source and says **refresh failed**.
Connection or watcher loss says **reconnecting**. These are reconciliation hints,
not a durable event journal or a count of completed work.

#### Record a human response

```sh
work-board ./project-notes --responses
```

Explicit opt-in enables writes. Open the request in **Work details and source**,
choose **Respond to this request**, inspect the exact source and reviewed SHA-256,
enter a local author label, then preview and record the Markdown. **Answer** may
say no; **Ask back / clarify** and **Not now** are separate reply kinds. Author
labels provide local attribution, not authentication.

Registration captures one question generation in `responses/`; submission creates
an independent response file there. Original source bytes stay unchanged. Source
edits or moves require a fresh review/preview; historical replies still identify
the old context. Same-identity/content retries reconcile, conflicting contributions
are rejected, and uncertain publication is reported explicitly.

An execution integration may mark a generated `kind: decision` request with
`attention[].managed: true`. A separate immutable `kind: result` document records
`request_receipt` with the registered question ID, its `reviewedRevision`,
`recordedAt` and disposition `applied` or `superseded`. An applied receipt names
the unique current `answer`; clarification and deferral cannot acknowledge it.
Supersession retires the request without inventing an answer. Only an unambiguous
receipt matching the exact current source path and bytes removes the managed
request from the overview and response surface. The source remains unchanged
and readable. Ordinary authored requests remain source-driven; receipts grant
no execution, acceptance or delivery authority.

Browser drafts have their own 2 MiB workspace bound and expire 30 days after their
last edit. Navigation, reload and source refresh retain them; text edited while an
earlier save completes remains an unsaved draft with a fresh identity. Corruption,
expiry and storage failures are disclosed. Clearing drafts does not clear saved
records or the seen baseline.

#### Wait for an attributable reply

```sh
work-board question work.search/keyboard-review
```

Read the exact source/context and its `reviewedRevision` without registering it.
Use that returned hash to register and wait:

```sh
work-board wait work.search/keyboard-review --revision "$reviewedRevision"
```

Set `reviewedRevision` from the question output after reviewing its context.
Registration reports a stable question ID and deadline on stderr. Successful
stdout is one JSON result with `kind: "response"`, its question/context and its
response. Exit 0 means receipt of a reply, including no, clarification or deferral.

```sh
work-board wait "$questionId"
work-board response "$questionId"
work-board wait "$questionId" --after "$responseId"
```

Set these variables to the returned record IDs. Repeating `wait` reattaches to the
registered question after a stopped shell or server restart. `response` retrieves
its conversation without waiting. `--after` explicitly waits for the next reply;
reads are repeatable and do not consume replies. A missing cursor fails.

The 48-hour deadline starts at first durable registration and does not reset on
reattachment or preview. Exit 2 reports an unanswered deadline; the question stays
available and a late response wins over the old timeout. Transport/index failures
remain failures, rather than evidence that the human did not answer. Damaged or
ambiguous response history is unavailable until repaired. Harnesses own shell
lifetime and model wakeup; reading a reply does not promise agent continuation.

#### Ask several related questions in one packet

Add question/option directives to the body of the item with an explicit request:

```markdown
::::question{id="display" select="one"}
### How should replies appear?

:::option{id="latest"}
Latest response, with a link to history.
:::

:::option{id="history"}
Full history beside its reviewed context.
:::
::::
```

Options begin unselected. `select="one"` is the default, `select="many"` permits
multiple choices, and `select="text"` uses human text without options. Every prompt
accepts extra text, including a text-only rejection of the framing. An answer
needs a choice or nonempty text per prompt. The server validates prompt/option IDs,
selection mode and completeness against captured context; one submission returns
one response with typed answers and readable Markdown through the existing wait.

If several requests are open in one file, add `request="keyboard-review"` to each
matching question directive. Optional explicit supersession links immutable new
direction to an earlier response; it does not rewrite task status or accept work.
Source edits preserve human text and clear selections for review. The
[packet reference](docs/delivery/decision-write-examples.md) gives a complete item,
all modes and validation limits.

#### Hand a task to an existing agent session

Open a uniquely identified project item and choose **Prepare an agent handoff**.
Review the current source, enter a local recipient label, goal, constraints and
next action, then preview and prepare. The existing `--responses` opt-in enables
this writer too. It creates `handoffs/<id>.md` with a stable identity, direction,
source path, reviewed SHA-256 and exact source snapshot, including original
frontmatter and declared criteria. Context is limited to 256 KiB of UTF-8.

**Copy tiny prompt** gives a short instruction containing the absolute saved path.
Paste it into the intended existing session. If clipboard access is unavailable,
the prompt is selected for manual copying. Preparing a handoff records `requested`;
it does not notify, wake or launch an agent.

The agent edits `handoff.state` to `acknowledged`, `rejected` or `unavailable` and
can add `handoff.by` and `handoff.note`. These are explicit local receipt facts,
independent of task status, execution and human acceptance. An absent receipt
stays unconfirmed; damaged or ambiguous history stays unavailable.

Same-ID retries preserve receipt and extra metadata, including after source
deletion. Restarted servers read the recorded receipt. Different direction and
moved or duplicate identities are conflicts; a changed source before initial
preparation requires another review. Saved context remains inspectable when its
source disappears. Native navigation and Back retain owned draft text; source
changes require a fresh preview.
Drafts share the existing workspace store and its 30-day/2-MiB bounds. Clearing
that store clears response and handoff drafts together.

The [handoff source reference](docs/delivery/handoff-examples.md) shows a complete
record, ordinary receipt edits and the boundary with optional execution integrations.

#### Review the returned result

A file with `kind: result` and a unique ID offers **Review returned result** at
`/_board/result?item=<id>`. The page separates the report's authored status from
linked work status, lists its criterion-level claims and missing provenance, and
keeps the report, limitations and human feedback together. Reading through normal
GET or the native page query leaves project files unchanged.

The agent declares an explicit open `attention` request of kind `review` on the
report. That request links into the existing response surface. A Markdown question
packet can offer request revision or accept this exact report, with room for human
rationale. These options are authored text, rather than reserved acceptance states.
Preview and submit the response against the exact source you reviewed.

Feedback matching both the current report SHA-256 and source path is labeled
**Feedback on this exact result revision**. An edit or move labels the old feedback
as earlier context; its saved snapshot remains inspectable. A new response can
explicitly supersede the revision request. Malformed or duplicate history stays
unknown. None of those actions changes linked task status or supplies missing
criterion evidence.

Reported `evidence.checked_revision` is a Git revision, distinct from the report's
source SHA-256. Work Board does not compare evidence with the current checkout;
evidence freshness remains unknown. The
[returned-result source reference](docs/delivery/result-review-examples.md) gives
complete task/report files and the reviewed-revision wait workflow.

### API and integration

Import the module that defines a name. The package has no root entry; its manifest
maps `./*.ts` to defining source/declaration/runtime modules, including nested
paths. The main integration surfaces are:

| Module | Names and purpose |
| --- | --- |
| `board.ts` | `BoardOptions`, `boardLayer(options)`: Effect HTTP router Layer for the workspace |
| `serve.ts` | `ServeOptions`, `HOST`, `listenOn(port)`, `serveBoard(options)`: Node loopback serving Layers |
| `responses/agent.ts` | `AgentOptions`, `agentRequest(action, options, diagnostic?)`: Effect client for `question`, `response` or `wait` |
| `browser/client.ts` | `Reader`, `BrowserClient`, `browserClient(url, options?)`: native reading, response and handoff bindings, registry and live updates |
| `rpc/contract.ts` | `ReadFailed`, `workContract`, `Subscribe`, `workRpcs`: reading queries and combined native RPC group |
| `rpc/responseContract.ts` | `responseContract`: question/read/wait queries and register/record commands |
| `rpc/handoffContract.ts` | `handoffContract`: source/history queries and reviewed preparation command |
| `browser/responses/schema.ts` | Question, response, answer and draft schemas/types; `ResponseFailed` |
| `browser/handoffs/schema.ts` | Handoff record, input, reading and source-preview schemas/types |
| `metadata/schema.ts`, `metadata/parse.ts`, `metadata/model.ts` | Source schemas, parsed fields/diagnostics and explicit identity/reference model |

Other defining modules are also exposed by the wildcard. Their
[source directory](https://github.com/ShivaeDev/platform/tree/main/packages/work-board/src)
contains file/watch, HTTP, rendering, search, views, history and result-review
helpers. Compose `boardLayer` to retain the package's source policy and request
guards.

#### Embed the workspace

```ts
import { NodeServices } from "@effect/platform-node";
import { boardLayer } from "@shivaedev/work-board/board.ts";
import { Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";

const board = HttpRouter.toWebHandler(
  Layer.provide(boardLayer({ root: "./project-notes", home: "plan.md" }), NodeServices.layer),
);

try {
  const response = await board.handler(
    new Request("http://localhost/", { headers: { host: "localhost" } }),
  );
  console.log(await response.text());
} finally {
  await board.dispose();
}
```

`boardLayer` needs `FileSystem`, `Path` and the HTTP router services; `NodeServices`
provides the filesystem/path implementation here. `root` is required, `home` is
optional, and `responses: true` explicitly opts into publication. `HttpRouter.serve`
can compose it beside application routes in a scoped Effect HTTP server.
Requests still require a loopback `Host`; a missing/non-loopback host is refused,
as is a known non-loopback remote address. The embedding host owns its trust boundary.

#### Read and wait from a Node agent

```ts
import { Effect } from "effect";
import { agentRequest } from "@shivaedev/work-board/responses/agent.ts";

const question = await Effect.runPromise(
  agentRequest("question", {
    request: "work.search/keyboard-review",
    url: "http://127.0.0.1:4747",
  }),
);

console.log(JSON.stringify(question, null, 2));
```

Read the returned context before registration. This second program takes the
reviewed revision as its first command-line argument and registers that context:

```ts
import { Effect } from "effect";
import { agentRequest } from "@shivaedev/work-board/responses/agent.ts";

const [revision] = process.argv.slice(2);
if (!revision) throw new Error("Pass the reviewed revision as the first argument.");

const answer = await Effect.runPromise(
  agentRequest("wait", {
    request: "work.search/keyboard-review",
    revision,
    url: "http://127.0.0.1:4747",
  }, console.error),
);

console.log(JSON.stringify(answer, null, 2));
```

`agentRequest` returns an Effect and manages its RPC scope. `question` uses
`item/request`; registering `wait` needs that pair plus `revision`. To reattach,
pass the returned question ID as `request` without `revision`. `response` also
takes a question ID; `after` on `wait` selects a later reply.

#### Use the native browser client

```ts
import { browserClient } from "@shivaedev/work-board/browser/client.ts";

export async function registerReviewedQuestion(url: string, revision: string) {
  const client = browserClient(url);
  try {
    const page = await client.read(
      client.api.page.query({ url: "/_board/item/work.search/" }),
    );
    const question = await client.mutate(
      client.responses.registerQuestion.run({
        item: "work.search",
        request: "keyboard-review",
        revision,
      }),
    );
    const history = await client.run(
      client.responses.responses.run({ question: question.id }),
    );
    return { page, question, history };
  } finally {
    client.registry.dispose();
  }
}
```

Call this function with a revision whose source/context you have reviewed and a
server started with `--responses`. `api` binds reading operations; `responses`
binds question and response operations. `read` resolves a query atom, `run`
executes a query Effect, and `mutate` executes a command with its invalidation
service. `handoffs` binds source/history queries and the preparation command. The
client also exposes `registry` and `updates`; dispose the registry when its owner
ends.

For a handoff, first read the preview with
`client.run(client.handoffs.handoffSource.run({ item: "work.search" }))` and inspect
its `context`. This complete program takes that reviewed path and revision as
inputs:

```ts
import { browserClient } from "@shivaedev/work-board/browser/client.ts";

export async function prepareReviewedHandoff(
  url: string,
  source: string,
  revision: string,
) {
  const client = browserClient(url);
  try {
    const saved = await client.mutate(
      client.handoffs.prepareHandoff.run({
        id: "handoff.search.keyboard.1",
        item: "work.search",
        source,
        revision,
        recipient: "agent-navigation",
        goal: "Fix keyboard focus",
        constraints: "Preserve no-JavaScript links.",
        nextAction: "Inspect the current source and report browser evidence.",
      }),
    );
    const history = await client.run(
      client.handoffs.handoffs.run({ item: "work.search" }),
    );
    return { saved, history };
  } finally {
    client.registry.dispose();
  }
}
```

Pass `preview.source` and `preview.reviewedRevision` only after reviewing the
preview's context. `saved.prompt` is the short instruction to copy into the agent
session, and `history` contains records plus paths whose history is unknown. Keep
the same ID for a retry of identical direction; choose a new ID for new direction.

Result reading uses the same page query as other workspace views:

```ts
import { browserClient } from "@shivaedev/work-board/browser/client.ts";

export async function readReturnedResult(url: string, item: string) {
  const client = browserClient(url);
  try {
    return await client.read(
      client.api.page.query({
        url: `/_board/result?item=${encodeURIComponent(item)}`,
      }),
    );
  } finally {
    client.registry.dispose();
  }
}
```

Pass a uniquely identified result, such as `result.keyboard`. Its declared review
request still uses `responses.question`, `registerQuestion` and `recordResponse`,
or the normal browser response controls; there is no separate acceptance writer.

`ResponseFailed.code` distinguishes `Disabled`, `Missing`, `Stale`, `Conflict`,
`Unavailable`, `Unsupported`, `Uncertain` and `Unanswered`. An uncertain publication
may already have produced a file; inspect the saved identity/content before retrying.

#### CLI reference

| Server argument | Default | Meaning |
| --- | --- | --- |
| `<dir>` | Required | Existing folder to read |
| `--home <file>` | None | Listed Markdown file rendered as a board at `/`; a missing file prevents startup |
| `--port <number>` | `4747` | Loopback server port; `0` asks for a free port |
| `--responses` | Off | Enable local question/response/handoff publication |

| Agent argument | Meaning |
| --- | --- |
| `question <item>/<request>` | Read current context without registration |
| `wait <item>/<request> --revision <hash>` | Register reviewed context and wait |
| `wait <question-id> [--after <response-id>]` | Reattach or wait for the next response |
| `response <question-id>` | Read the saved conversation |
| `--port <number>` | Select the shared server's port; default `4747` |
| `--url <origin>` | Select an HTTP loopback origin instead of `--port` |

The browser uses local NDJSON RPC at `POST /_board/rpc`. Ordinary document GETs,
`/_board/start`, `/_board/work`, `/_board/overview`, `/_board/changes`,
`/_board/respond`, `/_board/handoff`, `/_board/result`, identity
links, the search/history endpoints and `/events` remain available alongside it.
There is no automatic workspace discovery or server launch in agent commands.

### Install and limits

```sh
pnpm add --global @shivaedev/work-board
```

Node 24 or newer is required. For embedding, install the package into the project
with the matching Effect peers declared in its
[manifest](https://github.com/ShivaeDev/platform/blob/main/packages/work-board/package.json):
`effect`, `@effect/platform-node` and `@effect/platform-node-shared`.

Serve trusted folders: the ordinary reader retains raw HTML rather than sanitizing
it. Response, handoff and result-review surfaces disable raw HTML, escape
exact-source disclosure and block source form actions/frames. Writes require
same-origin loopback NDJSON commands and explicit server opt-in; local author
labels are not accounts.

Files/folders below the root beginning with a dot, and `node_modules`, are skipped;
the root itself may be a dot folder. Unlisted paths and traversal are refused.
Directory references grant reading, not write permission. Restoring a target that
was already broken when watches were built requires restarting the server.

Publication requires Linux, a real workspace directory, `/proc/self/fd`, hard links
and directory synchronization. Read mode remains separate. No-replace publication
and retry reconciliation protect recorded contributions; agents edit handoff
receipt through ordinary files. An unrelated editor can still change source after
preflight. Records retain the exact reviewed context,
rather than claiming an atomic transaction with that editor. Moved directories or
synchronization failures can produce an uncertain outcome.

JavaScript enables live updates, search, draft/response/handoff controls and diagram
inspection. Server-rendered documents, source details, native Work/Overview links,
copyable templates and saved feedback remain readable without it. Image routes
exclude SVG, HTML, PDF and arbitrary attachments. The board does not launch agents,
verify recorded evidence or generate exported document packets.

The [north star](docs/north-star.md) explains design priorities. The
[roadmap](docs/roadmap.md) owns implementation status and unresolved decisions.
[Experience designs and mockups](docs/experience.md) illustrate the product direction
with fictional data.
