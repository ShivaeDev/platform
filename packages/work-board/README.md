# @shivaedev/work-board

A local workspace for reading your agents' plans, results and questions, then giving direction beside the source you reviewed. The work stays in Markdown files; Work Board adds live reading, connected views, attributable responses and reviewed direction for an existing agent session.

## Keep the work and its context together

An agent's finished run leaves you with another report to read and another question to answer. Work Board lets you read those files as one workspace, follow their reasoning and evidence, and find explicit requests for your judgment. Even a small Markdown plan can become a board:

```markdown
# Documentation review

## In review

### Check the install guide

Read [the proposed guide](guide.md) before choosing the next step.
```

As a home board, the section becomes a column and the heading a card, with its count derived from the file. Agents keep editing the files with their usual tools. An open page updates in place while keeping unchanged reading blocks and expanded details, so the reader can stay with the work as it changes.

## Using it

### How to think about it

A **workspace** is a folder of Markdown files. Those files are authoritative: plans, reasoning, work fields and recorded evidence remain readable outside the board. The server builds its document, search and relationship index from them. Its views arrange the same source for different reading tasks.

During normal watching, each settled batch re-reads changed Markdown paths and retains unchanged parsed documents and search entries. Adds, deletes and renames update the same index. Watcher recovery checks source bytes and reuses unchanged parses. The synthetic 2,000-item benchmark runs with `node --conditions=source packages/work-board/src/test-support/indexBenchmark.ts` from the repository root; it records index time, files read and files parsed for cold start, edit, add, delete and rename.

Identified documents open with a sticky title, kind icon, recorded status, owner and next action. Favorite and handoff controls sit in the header. Known Fleet items also show their stage and PR. An open rail shows criteria, relationships with target titles and statuses, and backlinks grouped by kind; membership and Markdown links keep their own groups. At 1024px the rail sits beside the 68ch Markdown column; on smaller screens it follows the introduction. The Source tab holds the file location and original frontmatter.

Open requests place an answer card directly below their source header and the headers of the items they unblock. The card renders the reason as Markdown, offers the recorded options with the recommendation marked, and retains response drafts through live reads. Record saves the answer against the request’s reviewed source. More holds the author label, optional Markdown preview, draft tools and response details; the default author is maintainer when no saved label exists. Managed decisions use the title of the work they unblock; generated identities remain in Source. Legacy response URLs redirect to the item and focus its card.

A file can declare an optional **item ID**. That ID connects it to other files, criteria and boards without tying the connection to its filename. A **criterion** is an explicitly named requirement; an **evidence record** is an author's claim about an observation. The board displays that claim and its provenance; it does not run the check or establish acceptance.

An **attention request** explicitly asks for a decision, review or help with a blocker. It is separate from an item's status. A **question** asks for a person's answer. It can be authored as a standalone item or captured from an attention request with its exact source text, source path and reviewed SHA-256. A **response** is an independent Markdown record of a person's answer, clarification or deferral. Responses retain their reviewed context; they do not close requests, change task status or start an agent. An optional execution integration can acknowledge a managed decision through a separate immutable request receipt. That receipt is distinct from a handoff receipt, execution or acceptance.

A **handoff** captures direction and the exact source the person reviewed in another Markdown file. The person copies its short file instruction into an existing agent session; the agent records receipt through ordinary file edits. Receipt states describe acknowledgment, rejection or unavailability, rather than execution or acceptance.

A **result** is an author's report linked explicitly to work and criteria. Its recorded status does not change the linked task's status. A result review presents the report, its claims and limitations with human feedback pinned to the reviewed source bytes and path. Choosing an authored acceptance option does not supply missing criterion evidence.

Browser preferences, drafts and the explicit **seen baseline** are personal state, scoped to the workspace and server origin. They do not change project meaning. Agents own normal project-file edits. Work Board owns the human response content it records. An agent's run completion, a recorded answer and an accepted result remain separate facts.

The work has three parts: choose a workspace once, author useful files per feature, and read or respond as the work changes.

### 1. Once per workspace: choose the reading surface

```sh
work-board ./project-notes --home plan.md
```

This serves the existing folder on `http://127.0.0.1:4747`. The optional home file is resolved from that folder and rendered as a heading board at `/`; other files are documents. Without a home, `/` shows the first listed document. An empty workspace opens getting-started guidance. **Getting started** remains available at `/_board/start`, with copyable project, investigation and agent-result templates. Save them through your editor or agent tool; the reader does not create files.

A heading board uses `#` for its title, text before the first `##` for its intro, `##` for sections and `###` for cards. A section without cards shows its text. A `---` after the last heading starts the footer; a divider inside a card before another heading stays in that card. Code spans, reference links, footnotes and `<details>` can stay in the Markdown body. Leave a blank line after `<summary>` and before `</details>` when its content is Markdown.

The sidebar shows Today, Goals, Now, Library and System with counts, followed by pinned documents, active goals with linked-work status bars, and at most five recent documents. Today counts waiting human actions, Goals counts open goals, Now counts open tasks, Library counts Markdown files including Fleet records, and System counts index diagnostics and unavailable sources. Below 768px, Files in the top bar opens an overlay drawer; Escape or a tap outside closes it and returns focus to Files. Library lists document titles with kind and status filters, a folder view that loads immediate children on expansion, and a Recently changed view sorted by file modification time. Links preserve logical workspace paths, including reference-directory aliases.

Directory links can include reference Markdown without copying it:

```sh
ln -s ../reference-docs ./project-notes/reference
work-board ./project-notes --home plan.md
```

Explicitly linked directories may live outside the workspace. Their documents use the link's logical paths, so `/reference/guide.md` resolves its own relative links. The server watches reference edits and discovers added or retargeted links. Broken, ancestor and cyclic links are skipped. File links must stay inside their containing workspace or reference directory. Only link directories you intend to expose.

### 2. Per feature: write the source once

Plain Markdown needs no metadata. Add frontmatter when an item needs stable identity, connected criteria, work views or an explicit request. Save this as `search.md`:

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

Every top-level work field is optional. IDs are case-sensitive: an ASCII letter or digit, then letters, digits, dots, underscores or hyphens. A unique ID opens at `/_board/item/work.search/`, and its criterion at `/_board/item/work.search/#criterion-keyboard`. These references survive file and heading renames while their explicit IDs remain unique.

`status`, `owner` and `next_action` are nonblank authored text. No section title becomes a status rule. Unknown fields stay in **Original frontmatter** with a diagnostic; valid independent fields still render. Invalid metadata, duplicate IDs and unresolved references remain visible without choosing a source winner. An incomplete index cannot establish unique identity.

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

Open **Work** on Now, or choose All work and Table. The same item may belong to several boards; a board definition is excluded from All work. All work columns use exact recorded status, with missing status disclosed separately. Filters use status, owner and work text; sorting uses title, owner or status, with missing values last. The URL carries board, filters, layout, sort and selected item. Board and table share the projection and source detail; native links and GET filters work without JavaScript. Missing, repeated and ambiguous members are disclosed.

Use `relationships` for `implements`, `informs`, `depends_on` or `relates_to` links to an item or `item#criterion`. A result can record evidence against the criterion. Save this as `result.md`:

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

Record an outcome only after an actual observation, and save its supporting `evidence.md`; omit evidence until that check exists.

`source` is required for an evidence record; `criterion`, `checked_revision`, `observed_at`, `method` and `outcome` are optional. This example has no checked revision or observation time, so both stay **Not recorded**. When known, record a full 40- or 64-digit hexadecimal revision and an ISO timestamp with a timezone. Source paths resolve from the file holding the claim.

Criteria collect explicitly linked claims across files. **Referenced by** also shows incoming relationships, board membership, evidence sources and ordinary Markdown links. Decisions keep their options and rationale in body Markdown. Old recorded revisions remain visible; the viewer does not compare them with current Git state or infer human acceptance. See the [source field reference](docs/delivery/source-examples.md) and [attention field reference](docs/delivery/attention-examples.md) for complete shapes.

#### Richer reading in ordinary documents

Tables, task lists, footnotes, raw-HTML details and highlighted fenced code render on the server. Heading passage links and an **On this page** outline distinguish duplicate headings. Relative document links resolve from their source file, including a nested home served at `/`.

Document content starts with its title and, for frontmatter documents, source status and next action. Missing authored values say **Not recorded**. **Context and tools** follows the introduction in document order and contains source provenance, backlinks, the outline and the favorite control. DOM fixtures check this order, the disclosure's desktop/narrow media-query defaults, and a CSS upper bound on title placement using the viewport height and capped page controls. They also check the question form's text-column width and margins and the desktop grid's row allocation. These checks do not measure browser layout or establish physical-device behavior.

`mermaid` fences draw locally in the browser. Diagrams follow the theme and keep unchanged drawings during refresh. A parse failure exposes its source and error; without JavaScript the source remains readable.

Metrics and progress use fixed directives with a label and a source:

```markdown
:::progress{completed="3" total="8"}
Browser checks recorded

Source: [Reading checks](checks.md)
:::
```

The component shows the authored tally. Unknown or zero-total counts do not fabricate a percentage; invalid components retain source with a diagnostic. `:::metric` records a value/unit, and `:::timeline` preserves authored entry order. GitHub alert blockquotes render as callouts; comparisons remain GFM tables. The [visual document reference](docs/delivery/visual-document-examples.md) gives full examples and bounds.

Use ordinary image Markdown for source-relative PNG, JPEG, GIF or WebP files. The image route serves at most 16 MiB per file inside the real workspace; images in outside reference folders must be copied inside that boundary. The image gallery and **Inspect diagram** provide zoom and keyboard dismissal. Local image downloads and SVG downloads of a rendered diagram use the browser. A source update marks an already-open preview as older and requires reopening before saving. These actions do not write source or establish acceptance.

### 3. Every day: read, compare and give direction

**Search** or Ctrl/Cmd+K finds document titles/paths, headings, passages and recorded work fields. Matching uses the first 200 query characters and up to eight terms; each of those terms must occur in a block, ignoring case. Titles rank before headings, then passages. At most 40 results are shown with the full match count. Arrow keys choose, Enter opens, and Escape closes. Incomplete reads are disclosed, and older requests cannot replace a newer query. Search requires JavaScript.

Back restores selected text and expanded details. Reading history opens a bounded dialog with favorites and up to ten unique recents. Favorites and recents belong to the workspace/origin; deleted favorites remain labeled missing. Save up to ten named Work views with the applied board, filters, sort and layout. Selection stays in the URL, and saving the same name updates it. At capacity, remove or update a view; none is silently evicted. Unavailable storage is disclosed, with controls usable for the current page.

**Work** opens on **Now**: fixed Queued, Executing, Reviewing, Delivering, Waiting on a person, and collapsed Done in the last 7 days lanes. Fleet stages set the lane even when the source still says `planned`; reviewing, repairing and validating share Reviewing. Lanes hold tasks only. Every available Fleet stage takes precedence over authored status, including prepared and human-waiting work whose source is inactive. Without a matching Fleet item, authored superseded, deferred, cancelled, done and completed items stay outside Now. Done includes only recent Fleet completions. Queued holds prepared tasks or approved tasks waiting to start, never unapproved planned work. Cards show one Fleet-derived StatusChip and show the holder, PR link and time in stage only when known. When Fleet is unavailable, lanes use authored status and disclose the fallback. Saved views and filters sit behind **Filter**, collapsed by default on Now. Completed work with no known completion time is available through **All work**. All work keeps status columns in a fixed order; **Table** uses the chosen row sort. Decisions, questions, responses, results and request receipts remain readable in their source views and stay outside these work lists. With JavaScript, lists over 200 rows render a moving window inside bounded scrolling lanes or a table. The source fallback retains ordinary links and full lists in scrolling containers. `src/client/react/WorkNow.dom.test.tsx`, `workRecords.dom.spec.tsx` and `workScale.dom.spec.tsx` cover these projections and the rendered row bound with a 1,500-item fixture.

**Overview** groups explicit open decision, review and blocker requests. Status, owner, file edits and finished runs do not imply a request. Each entry links its reason, recipients, targets and source context. Closed requests remain readable without asserting a recorded answer or acceptance. Invalid or ambiguous requests stay outside the queue with diagnostics; incomplete indexes withhold counts.

**System** in the sidebar reads Codex usage windows labelled by duration, GitHub REST and GraphQL rate limits, and Fleet health through the Fleet daemon's `daemon.diagnostics` HTTP RPC query at `127.0.0.1:3457`. Set `--fleet-port <port>` or `BoardOptions.fleetPort` to select another daemon port. A stopped daemon leaves Diagnostics available with an explicit unavailable state and a start command; the next refresh retries. Board does not start provider commands or read Fleet's database or health file. The daemon reads Codex and GitHub with its existing CLI authentication, caches rate-limit observations for one minute across Board clients and reports each source's missing configuration or error independently.

The view refreshes through `client.api.diagnostics.query()` every 15 seconds while visible. Pause updates holds the displayed state; resume and returning to a visible tab refresh it. The shared `DiagnosticsContract` and `DiagnosticsSnapshot` schemas live in `@shivaedev/work-board/diagnostics/daemonContract.ts`; the version 2 `FleetHealth` schema lives in `@shivaedev/work-board/diagnostics/health.ts`. The page shows the publisher's observation time, freshness, running and queued counts and waiting counts for maintainer, orchestrator and automation, concurrency cap, last scheduler pass and last observed provider capacity rejection. Stale snapshots show a Stale badge and dimmed counts. Reset times show relative time and the browser’s local clock; the Diagnostics view requires JavaScript. Communication failures and API-key accounts explain why their data is unavailable. A publisher clock ahead of Board is disclosed; absent scheduler/rejection observations remain unknown or unobserved.

`client.api.fleetItems.run(undefined)` reads per-item execution through the same daemon client. A `ready` result has `items` for every stage except `completed` and `released`, and `completed` for current records completed within the last seven days, including the boundary. Each item carries `workId`, `stage`, a waiting `attentionOwner` when present, `prUrl` when known, and millisecond `stageEnteredAt` and `updatedAt`; completions also carry `completedAt`. Board joins each unique matching ID to `document: { file, title, metadata }`; missing or duplicate IDs keep the Fleet item with `document: null`. For legacy records, stage entry and completion times remain unknown until an observed stage transition; `updatedAt` becomes known on the next write. A stopped daemon, communication failure or Board index failure returns `{ state: "unavailable", reason }`. Set `BoardOptions.fleetPort: null` to disable the item integration. `src/server/views/fleetItems.test.ts` covers these reads through HTTP RPC with a synthetic daemon.

**Changes** starts remembering only through **Start remembering changes**. After review, **Mark current workspace seen** replaces the baseline; **Clear remembered history** turns it off. Opening a view and receiving live updates never mark it seen. Compare additions, removals, fields and source text against that one browser-local baseline. Unique IDs match moved items; plain-file renames are removed/added paths. The baseline is bounded to 2 MiB and 30 days, with expiry, corruption, incomplete reads and oversized workspaces disclosed. It holds Markdown, not image bytes.

**Pause updates** holds the displayed reading state while counting observed hints, bounded at **256+**. Resume and reconnect reconcile the workspace. Unrelated source edits retain mounted document reads; relevant updates retain unchanged reading blocks. A failed read keeps visible source and says **refresh failed**. Connection or watcher loss says **reconnecting**. These are reconciliation hints, not a durable event journal or a count of completed work.

#### Find what waits on you

The sidebar offers **Today** and the top bar offers **Inbox** with a live count, including on narrow screens. One server projection classifies asks into **Waiting on you**, **Waiting on agents**, **Resolved elsewhere** and **Parked**. The Inbox, Overview summary and both navigation badges count the same Waiting on you rows. This lane includes open human-owned next actions, unaddressed standalone questions, work whose status is `needs-human`, and validated open attention requests whose `response_from` includes the maintainer label. The default label is `maintainer`; set `--maintainer <name>` to use another literal, case-sensitive label. Requests for only other responders appear in the collapsed Waiting on agents group with their audience labels, including orchestrator and automation. An attention request does not need a registered question to appear. A recorded answer to a uniquely registered ordinary request in its current source context retires that ask. Source diagnostics are reported separately in Overview and never create asks. Invalid managed requests stay outside the lanes. Managed decisions leave the Inbox when their exact-context acknowledgement retires them. Question and request rows open the item’s answer card; other rows link to the source. Each row shows the reason and time since the source last changed. Work cards show one Fleet-derived state, or **needs-you** for an authored ask when Fleet has no item state. The table marks the same asks as **Waiting on you** while retaining authored status. Missing or duplicated IDs on human-owned actions remain listed with a visible problem and a link to each source. Ages of 48 hours or more use days. `src/server/attention/projection.test.ts` and `src/client/react/attentionLanes.dom.spec.tsx` prove the lanes, audience labels, separate diagnostics and matching counts with fixtures.

Managed requests also leave the main Inbox when every `unblocks` target has a closed status: they appear individually in collapsed **Resolved elsewhere (N)**. Requests whose targets are all `deferred` appear in collapsed **Parked (N)**. Mixed closed and deferred targets remain waiting. Active asks for the same target item set and lane share one row (agent audiences remain separate), using the newest source modification time, its reason and response link, and **N earlier asks**. Criterion references group by their item ID. A waiting target has one row even when it also has a human-owned next action. The sidebar and top-bar badges count only main-list rows. These views do not edit source files. `src/server/attention/closedInbox.spec.ts`, `src/client/react/closedInbox.dom.spec.tsx` and `src/server/attention/closedInbox.dom.spec.ts` prove classification, grouping, counts and live updates with fixtures.

Owner labels are local conventions: `codex`, `claude`, `fleet`, `orchestrator`, `agent`, `automation`, `bot` and `copilot`, including labels beginning with those names followed by a dash, underscore, dot, space or slash, denote automation. Other nonblank owner labels denote people. A human owner needs a nonblank `next_action` to enter the Inbox. Statuses `closed`, `done`, `superseded`, `completed`, `cancelled`, `canceled`, `resolved` and `released` leave the queue. These rules classify waiting work; they do not edit the recorded status.

Fleet decision sources, captured questions, their answers and request receipts are hidden by default in Library. **Show Fleet records (N)** includes them in the current view. Ordinary authored questions remain visible, and all underlying files remain readable and searchable.

An agent can ask a standalone question with frontmatter:

```markdown
---
id: question.storage
kind: question
status: open
options:
  - label: Keep local files
    description: Keep readable Markdown in the project folder.
  - label: Use a database
    description: Store project documents in a shared database.
recommended: Keep local files
---
# Where should the project documents live?

Choose where the project keeps its readable source.
```

`options` is optional and accepts up to 32 entries with unique nonblank labels and descriptions. `recommended` names an option label. The item page presents buttons, marks the recommendation without selecting it, and accepts another answer as free text. Omit `options` for a text-only question. Use frontmatter options or a Markdown question packet on a question, rather than both.

Start with `--responses` to enable saving. Preview and record the answer on the item page with a local author label. The browser remembers that label for the workspace. The required author label stays visible; response kind and superseding controls sit in a collapsed details section; option questions show a choice and one answer box by default. Closed questions and invalid options keep recorded answers readable, with a clear message when another answer is unavailable. The existing publisher captures the reviewed source as a `kind: question` record in `responses/`, then writes a `kind: response` that links to that capture. Its `question.item` links back to the authored question. An `answer` removes the authored question from the Inbox for those exact source bytes and path; clarification and deferral keep it waiting. An edited question needs another answer. The original source file stays unchanged, and the answer does not establish acceptance or start an agent.

#### Record a human response

```sh
work-board ./project-notes --responses
```

Explicit opt-in enables writes. Open the item’s answer card, read the request reason, and inspect the original source in **Source**. Enter a local author label, choose an option or write an answer, then preview and record the Markdown. Questions and decisions can declare frontmatter options and a recommendation; the recommendation is marked but never selected for you. Requests with Markdown question directives keep their prompts and controls together in the card. **Answer** may say no; **Ask back / clarify** and **Not now** are separate reply kinds. Author labels provide local attribution, not authentication.

Registration captures one question generation in `responses/`; submission creates an independent response file there. Original source bytes stay unchanged. Source edits or moves require a fresh review/preview; historical replies still identify the old context. Same-identity/content retries reconcile, conflicting contributions are rejected, and uncertain publication is reported explicitly.

An execution integration may mark a generated `kind: decision` request with `attention[].managed: true`. A separate immutable `kind: result` document records `request_receipt` with the registered question ID, its `reviewedRevision`, `recordedAt` and disposition `applied` or `superseded`. An applied receipt names the unique current `answer`; clarification and deferral cannot acknowledge it. Supersession retires the request without inventing an answer. Only an unambiguous receipt matching the exact current source path and bytes removes the managed request from the overview and response surface. `currentResponses(responses)` from `@shivaedev/work-board/responses/current.ts` selects the latest response per author, ordered by recorded time and then response ID, and removes explicitly superseded responses. Managed acknowledgements use this selection; different authors remain competing, and superseding an author’s latest response does not revive an earlier answer. `src/responses/current.test.ts` and Fleet’s PostgreSQL question tests cover this rule. The source remains unchanged and readable. Ordinary authored requests remain source-driven; receipts grant no execution, acceptance or delivery authority.

Browser drafts use effect-form’s persisted drafts, keyed by workspace, item and request, with a 256 KiB limit per draft and a seven-day lifetime after the last edit. Navigation, reload and source refresh retain them; text edited while an earlier save completes remains an unsaved draft with a fresh identity. Malformed or expired drafts are discarded; unavailable storage leaves the form usable. **Clear draft** restores the current form’s initial values without changing saved records or the seen baseline.

#### Wait for an attributable reply

```sh
work-board question work.search/keyboard-review
```

Read the exact source/context and its `reviewedRevision` without registering it. Use that returned hash to register and wait:

```sh
work-board wait work.search/keyboard-review --revision "$reviewedRevision"
```

Set `reviewedRevision` from the question output after reviewing its context. Registration reports a stable question ID and deadline on stderr. Successful stdout is one JSON result with `kind: "response"`, its question/context and its response. Exit 0 means receipt of a reply, including no, clarification or deferral.

```sh
work-board wait "$questionId"
work-board response "$questionId"
work-board wait "$questionId" --after "$responseId"
```

Set these variables to the returned record IDs. Repeating `wait` reattaches to the registered question after a stopped shell or server restart. `response` retrieves its conversation without waiting. `--after` explicitly waits for the next reply; reads are repeatable and do not consume replies. A missing cursor fails.

The 48-hour deadline starts at first durable registration and does not reset on reattachment or preview. Exit 2 reports an unanswered deadline; the question stays available and a late response wins over the old timeout. Transport/index failures remain failures, rather than evidence that the human did not answer. Damaged or ambiguous response history is unavailable until repaired. Harnesses own shell lifetime and model wakeup; reading a reply does not promise agent continuation.

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

Options begin unselected. `select="one"` is the default, `select="many"` permits multiple choices, and `select="text"` uses human text without options. Every prompt accepts extra text, including a text-only rejection of the framing. An answer needs a choice or nonempty text per prompt. The server validates prompt/option IDs, selection mode and completeness against captured context; one submission returns one response with typed answers and readable Markdown through the existing wait.

If several requests are open in one file, add `request="keyboard-review"` to each matching question directive. Optional explicit supersession links immutable new direction to an earlier response; it does not rewrite task status or accept work. Source edits preserve human text and clear selections for review. The [packet reference](docs/delivery/decision-write-examples.md) gives a complete item, all modes and validation limits.

#### Hand a task to an existing agent session

Open a uniquely identified project item and choose **Prepare an agent handoff**. Review the current source, enter a local recipient label, goal, constraints and next action, then preview and prepare. The existing `--responses` opt-in enables this writer too. It creates `handoffs/<id>.md` with a stable identity, direction, source path, reviewed SHA-256 and exact source snapshot, including original frontmatter and declared criteria. Context is limited to 256 KiB of UTF-8.

**Copy tiny prompt** gives a short instruction containing the absolute saved path. Paste it into the intended existing session. If clipboard access is unavailable, the prompt is selected for manual copying. Preparing a handoff records `requested`; it does not notify, wake or launch an agent.

The agent edits `handoff.state` to `acknowledged`, `rejected` or `unavailable` and can add `handoff.by` and `handoff.note`. These are explicit local receipt facts, independent of task status, execution and human acceptance. An absent receipt stays unconfirmed; damaged or ambiguous history stays unavailable.

Same-ID retries preserve receipt and extra metadata, including after source deletion. Restarted servers read the recorded receipt. Different direction and moved or duplicate identities are conflicts; a changed source before initial preparation requires another review. Saved context remains inspectable when its source disappears. Native navigation and Back retain owned draft text; source changes require a fresh preview. Handoff drafts use effect-form with a separate key per workspace and item, under the same seven-day/256-KiB limits. **Clear draft** clears only the current form.

Response and handoff forms are React components on `effect-react`’s `useCreate` and `effect-form`’s Schema decoding, field messages and persisted drafts. Board owns preview and reviewed-context checks. Draft text, source-change notices and caret selection survive query refresh and reload. Input typed during a response or handoff save remains an unsaved draft; a fresh preview assigns its next identity. The forms use the shell’s shared native registry.

The [handoff source reference](docs/delivery/handoff-examples.md) shows a complete record, ordinary receipt edits and the boundary with optional execution integrations.

#### Review the returned result

A file with `kind: result` and a unique ID offers **Review returned result** at `/_board/result?item=<id>`. The page separates the report's authored status from linked work status, lists its criterion-level claims and missing provenance, and keeps the report, limitations and human feedback together. Reading through normal GET or the typed query leaves project files unchanged.

The agent declares an explicit open `attention` request of kind `review` on the report. That request links into the existing response surface. A Markdown question packet can offer request revision or accept this exact report, with room for human rationale. These options are authored text, rather than reserved acceptance states. Preview and submit the response against the exact source you reviewed.

Feedback matching both the current report SHA-256 and source path is labeled **Feedback on this exact result revision**. An edit or move labels the old feedback as earlier context; its saved snapshot remains inspectable. A new response can explicitly supersede the revision request. Malformed or duplicate history stays unknown. None of those actions changes linked task status or supplies missing criterion evidence.

Reported `evidence.checked_revision` is a Git revision, distinct from the report's source SHA-256. Work Board does not compare evidence with the current checkout; evidence freshness remains unknown. The [returned-result source reference](docs/delivery/result-review-examples.md) gives complete task/report files and the reviewed-revision wait workflow.

### API and integration

Import the module that defines a name. The package has no root entry; its manifest maps `./*.ts` to defining source/declaration/runtime modules, including nested paths. The main integration surfaces are:

| Module | Names and purpose |
| --- | --- |
| `board.ts` | `BoardOptions`, `boardLayer(options)`: Effect HTTP router Layer for the workspace |
| `serve.ts` | `ServeOptions`, `HOST`, `serveBoard(options)`: loopback Board serving through Platform’s `appHost` |
| `responses/agent.ts` | `AgentOptions`, `agentRequest(action, options, diagnostic?)`: Effect client for `question`, `response` or `wait` |
| `browser/client.ts` | `Reader`, `BrowserClient`, `browserClient(url, options?)`: native reading, response and handoff bindings, registry and live updates |
| `rpc/contract.ts` | `workContract`, `Subscribe`, `workRpcs`: reading queries and combined native RPC group |
| `browser/document/schema.ts`, `browser/document/View.ts` | `Document`, `DocumentRequest`, `DocumentView`, `DocumentViewProps`: source query data and React document rendering |
| `rpc/responseContract.ts` | `responseContract`: question/read/wait queries and register/record commands |
| `rpc/handoffContract.ts` | `handoffContract`: source/history queries and reviewed preparation command |
| `browser/navigation/schema.ts` | `Navigation`: compact navigation result schema/type |
| `browser/navigation/library.ts` | `Library`, `LibraryFile`, `LibraryInput`: titled document and folder query schemas |
| `browser/responses/schema.ts` | Question, response, answer and draft schemas/types |
| `rpc/rejections.ts` | `documentRejections`, `DocumentRejection`, `responseRejections`, `ResponseRejection`: declared taxonomy and application errors; `PublicationUncertain` and `Unanswered` |
| `browser/handoffs/schema.ts` | Handoff record, input, reading and source-preview schemas/types |
| `metadata/schema.ts`, `metadata/parse.ts`, `metadata/model.ts` | Source schemas, parsed fields/diagnostics and explicit identity/reference model |

Other defining modules are also exposed by the wildcard. Their [source directory](https://github.com/ShivaeDev/platform/tree/main/packages/work-board/src) contains file/watch, HTTP, rendering, search, views, history and result-review helpers. Compose `boardLayer` to retain the package's source policy and request guards.

#### Embed the workspace

```ts
import { NodeServices } from "@effect/platform-node";
import { boardLayer } from "@shivaedev/work-board/board.ts";
import { Layer } from "effect";
import { HttpRouter } from "effect/http";

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

`boardLayer` needs `FileSystem`, `Path` and the HTTP router services; `NodeServices` provides the filesystem/path implementation here. `root` is required, `home` is optional, `maintainer` selects the Inbox responder label (default `maintainer`), and `responses: true` explicitly opts into publication. `HttpRouter.serve` can compose it beside application routes in a scoped Effect HTTP server. Requests still require a loopback `Host`; a missing/non-loopback host is refused, as is a known non-loopback remote address. The embedding host owns its trust boundary.

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

Read the returned context before registration. This second program takes the reviewed revision as its first command-line argument and registers that context:

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

`agentRequest` returns an Effect and manages its RPC scope. `question` uses `item/request`; registering `wait` needs that pair plus `revision`. To reattach, pass the returned question ID as `request` without `revision`. `response` also takes a question ID; `after` on `wait` selects a later reply.

#### Use the native browser client

```ts
import { browserClient } from "@shivaedev/work-board/browser/client.ts";

export async function registerReviewedQuestion(url: string, revision: string) {
  const client = browserClient(url);
  try {
    const page = await client.read(
      client.api.document.query({ url: "/_board/item/work.search/" }),
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

Call this function with a revision whose source/context you have reviewed and a server started with `--responses`. `api` binds reading operations; `responses` binds question and response operations. `read` resolves a query atom, `run` executes a query Effect, and `mutate` executes a command with its invalidation service. `handoffs` binds source/history queries and the preparation command. The client also exposes `registry` and `updates`; dispose the registry when its owner ends.

`client.api.navigation.query({ current: "" })` returns compact destination `counts`, `inboxCount` (a number or `null` when the index is unavailable), and optional `home` with the configured home file and its unique identity. It contains no file tree. `client.api.library.query({})` loads document metadata on demand: `files` contain `path`, encoded `href`, `title`, `modified`, `kind` and `status`; `kinds` and `statuses` populate filters, and `fleetCount` counts hidden generated records. Optional `kind`, `status` and `showFleet` filter the files. Passing `folder: ""` lists root files and immediate folder descriptors; passing a folder path loads its direct files and immediate child folders. Folder descriptors contain `path`, `name` and descendant `count`. The shell reads active goal status counts from `client.api.goals.query()`; opening Library loads its own query.

`client.api.goals.query()` returns `{ goals }` for uniquely identified `kind: project` documents with an open status, using the Inbox's open-item convention. Each goal includes `id`, `title`, optional authored `status`, `owner` and `nextAction`, and `criteria`. `linked` counts distinct identified items with an `implements` relationship targeting the goal or a criterion anchor; `counts` maps each authored status to its item count, using `"not recorded"` for missing status. Multiple matching relationships on one item count once. Each criterion includes its `id`, `text`, `linked`, `counts` and `evidence`, the number of recorded claims targeting that exact criterion across the indexed documents. `openAsks` counts authored open attention requests whose `unblocks` include the goal, its criteria or a linked item, once per request. A goal without linked items has `linked: 0`, `counts: {}` and `unlinked: true`; an untargeted criterion has `linked: 0`. The query returns no completion percentage or overall success flag. Mounted queries refresh when indexed source changes.

For a handoff, first read the preview with `client.run(client.handoffs.handoffSource.run({ item: "work.search" }))` and inspect its `context`. This complete program takes that reviewed path and revision as inputs:

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

Pass `preview.source` and `preview.reviewedRevision` only after reviewing the preview's context. `saved.prompt` is the short instruction to copy into the agent session, and `history` contains records plus paths whose history is unknown. Keep the same ID for a retry of identical direction; choose a new ID for new direction.

Result reading returns the report, linked criteria and revision-pinned feedback from its typed query:

```ts
import { browserClient } from "@shivaedev/work-board/browser/client.ts";

export async function readReturnedResult(url: string, item: string) {
  const client = browserClient(url);
  try {
    return await client.read(
      client.api.result.query({
        url: `/_board/result?item=${encodeURIComponent(item)}`,
      }),
    );
  } finally {
    client.registry.dispose();
  }
}
```

Pass a uniquely identified result, such as `result.keyboard`. Its declared review request still uses `responses.question`, `registerQuestion` and `recordResponse`, or the normal browser response controls; there is no separate acceptance writer.

RPC rejections use Platform taxonomy classes: `Forbidden` for disabled writes, `NotFound` for missing context, `PreconditionFailed` for stale review, `Conflict` for incompatible content, `BadRequest` for unsupported input and `ServiceUnavailable` for unavailable reads. Unexpected handler failures become `InternalServerError` with a redacted public message and a server-only trace cause. These errors need no login middleware. `PublicationUncertain` means publication may already have produced a file; inspect the saved identity/content before retrying. `Unanswered` is the wait client’s deadline error.

#### Render a source query in React

Read `client.api.document.run({ url: "/notes.md" })` to get Markdown body source, metadata and diagnostics, resolved links and references, file information, resolved question actions and request previews with response history. Identity URLs and `/` use the same document query. Missing and duplicate identities reject with `NotFound` and `Conflict`; incomplete history stays explicitly unavailable. The query sends no rendered HTML or syntax tree.

Pass that data as the `document` prop of `DocumentView` from `@shivaedev/work-board/browser/document/View.ts`. The view uses the Board's GFM, directive, heading and footnote plugins with raw HTML, browser-side Shiki and a Mermaid code override. `idPrefix` scopes footnotes when a host displays several documents. The Board shell is a React app with TanStack Router. Its route loaders read document and projection contract queries through `effect-react` in the shell's native registry; preloading and navigation share those reads. Document and item pages mount `DocumentView` from the typed document query; the configured home board, Work board/table and selected detail, Overview and Inbox render typed projection queries in React. Changes, Diagnostics, Start, Respond, Handoff and Result also render typed query data in React. Their direct URLs load the shell and require JavaScript. The HTML page RPC is removed. The optional `reading` data supplies source context, backlinks, criterion claims and managed receipts; request `prompts` supply answer controls. Hosts can mount `DocumentView` directly from source-query data, or pass `context` and `introduction` React nodes for its document layout.

#### Headless addon API

Work Fleet uses five server entry points and one portable metadata type entry point under `@shivaedev/work-board/integration/`. The server APIs reuse Board's document, response, attention and diagnostics implementations. They need no browser or HTTP server; filesystem Effects use the native Node services Layer, and watchers retain their native Effect scope.

| Entry point | API object and members |
| --- | --- |
| `integration/board.ts` | `board`: `metadataParse`, `metadataModel`, `listMarkdown`, `markdownPath`, `watchChanges`, `searchSnapshot`; exported types `Diagnostic`, `ParsedMetadata`, `MetadataDocument`, `MetadataModel`, `MarkdownFile`, `Changes`, `Snapshot` |
| `integration/metadata.ts` | Portable types `Diagnostic`, `ParsedMetadata`, `MetadataDocument`, `MetadataModel`, also available through `integration/board.ts` |
| `integration/responses.ts` | `responses`: `Responses`, `ResponseConfig`, `readResponses`, `currentResponses`, `makeResponse`, `publish`, `revisionOf`, `questionId`, `questionFrom`, `questionMarkdown`, `responseMarkdown`, `DraftInput`, `Question`, `Reading`, `RecordedResponse`; exported types `DraftInput`, `Question`, `Reading`, `RecordedResponse`, `ResponseOptions` |
| `integration/attention.ts` | `attention`: `RequestReceipt`, `managedRequestReceipt`, `projection(snapshot)`; exported types `RequestReceipt`, `AttentionProjection` |
| `integration/diagnostics.ts` | `diagnostics`: `FleetHealth`, `CapacityRejection`, `FLEET_HEALTH_NAME`, `fleetHealth`, `DiagnosticsContract`, `DAEMON_PORT`, `DAEMON_RPC_PATH`, `DiagnosticsSources`, `SourceFailure`, `diagnostics`, `codexRateLimits`, `codexLimits`, `githubLimits`; exported types `FleetHealth`, `CapacityRejection`, `SourceFailure` |
| `integration/publication.ts` | `publication`: `directoryPath`, `validateDirectory` for addons that publish their own records through open directory handles |

```ts
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { board } from "@shivaedev/work-board/integration/board.ts";

const read = Effect.scoped(Effect.gen(function* () {
  const changes = yield* board.watchChanges("./notes");
  const snapshot = yield* board.searchSnapshot("./notes", undefined, changes);
  return yield* snapshot;
})).pipe(Effect.provide(NodeServices.layer));
```

The snapshot retains parsed documents, identity diagnostics and unavailable paths. Compose `responses.Responses.layer` with `responses.ResponseConfig` containing that index, the same watcher, workspace root and explicit `enabled` write choice. Use the service to register reviewed questions and record answers; `responses.publish` writes an immutable record under `responses/` (or `handoffs/` when selected), and the record helpers preserve exact reviewed bytes and source path. Agent-owned items remain ordinary Markdown edits. `attention.projection(snapshot)` returns the typed Inbox projection: `you`, `agents`, `resolved`, `parked`, `issues` and `complete`, with `items` retaining the same rows as `you` for existing clients. `attention.managedRequestReceipt` qualifies an acknowledgement against those records; it does not confer execution or acceptance authority. The publication helpers retain the filesystem limits below.

Fleet's production imports are fenced to these six entry points by `pnpm lint`; its test fixtures may still use Board modules directly. The packed-package consumer exercises the headless read, response and receipt path through these exports.

#### CLI reference

| Server argument | Default | Meaning |
| --- | --- | --- |
| `<dir>` | Required | Existing folder to read |
| `--home <file>` | None | Listed Markdown file rendered as a board at `/`; a missing file prevents startup |
| `--maintainer <name>` | `maintainer` | Literal `response_from` label for Inbox questions; unaddressed standalone questions remain included |
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

The browser uses local NDJSON RPC at `POST /_board/rpc`. Ordinary document GETs, `/_board/start`, `/_board/work`, `/_board/overview`, `/_board/changes`, `/_board/respond`, `/_board/handoff`, `/_board/result`, and identity links remain available alongside it. Search, retained-source history and live subscriptions use the same RPC route. There is no automatic workspace discovery or server launch in agent commands.

### Install and limits

```sh
pnpm add --global @shivaedev/work-board
```

Node 24 or newer is required. For embedding, install the package into the project with the matching Effect peers declared in its [manifest](https://github.com/ShivaeDev/platform/blob/main/packages/work-board/package.json): `effect`, `@effect/platform-node` and `@effect/platform-node-shared`.

Serve trusted folders: the ordinary reader retains raw HTML rather than sanitizing it. Response, handoff and result-review surfaces disable raw HTML, escape exact-source disclosure and block source form actions/frames. Writes require same-origin loopback NDJSON commands and explicit server opt-in; local author labels are not accounts.

Files/folders below the root beginning with a dot, and `node_modules`, are skipped; the root itself may be a dot folder. Unlisted paths and traversal are refused. Directory references grant reading, not write permission. Restoring a target that was already broken when watches were built requires restarting the server.

Publication runs on Linux and macOS and needs a real workspace directory, hard links and directory synchronization. Linux anchors each step to open directory descriptors through `/proc/self/fd`. macOS has no such anchor in Node, so it uses canonical paths and checks the directories' device/inode identity before and after publishing; a directory or ancestor swapped between two checks is not detected, so keep write boundaries under trusted local ownership. Node's `fsync` on macOS does not issue `F_FULLFSYNC`, so a successful save is not a power-loss guarantee there. Read mode remains separate. No-replace publication and retry reconciliation protect recorded contributions; agents edit handoff receipt through ordinary files. An unrelated editor can still change source after preflight. Records retain the exact reviewed context, rather than claiming an atomic transaction with that editor. Moved directories or synchronization failures can produce an uncertain outcome.

JavaScript enables live updates, search, draft/response/handoff controls and diagram inspection. Server-rendered documents, source details, native Work/Overview links, copyable templates and saved feedback remain readable without it. Image routes exclude SVG, HTML, PDF and arbitrary attachments. The board does not launch agents, verify recorded evidence or generate exported document packets.

The [north star](docs/north-star.md) explains design priorities. The [roadmap](docs/roadmap.md) owns implementation status and unresolved decisions. [Experience designs and mockups](docs/experience.md) illustrate the product direction with fictional data.
