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

A Board is a folder of Markdown files served by one local `work-board` process. The files are authoritative: plans, reasoning, work fields, evidence and recorded answers stay readable in an editor and in Git. The server builds its document, search and relationship index from them, and its views (Today, Goals, Now, Library and System) arrange the same source for different reading tasks without keeping a second copy. Browser preferences, pins, reading history and drafts are personal state, scoped to the workspace and server origin, and change no project meaning.

Any Markdown file is a document, and plain Markdown needs no metadata. Frontmatter makes a file an identified item: an optional **item ID** connects it to other files, criteria and boards without tying the connection to its filename. An item has one of four kinds. A **goal** is an outcome that the work implementing it rolls up into. A **task** is the brief for one piece of work. A **question** asks a person for an answer. A **report** is an author's account of returned work, linked explicitly to the work and criteria it addresses; its recorded status does not change the linked task's status. Every kind carries an authored status from the [work vocabulary](#work-vocabulary). A **criterion** is an explicitly named requirement, and an **evidence record** is an author's claim about an observation against it; the board displays that claim and its provenance and does not run the check or establish acceptance. A board file selects shared items for one view, and the optional home file is a heading board that shows its sections as columns and its headings as cards.

Agents and people write different files. Agents create and edit project Markdown with their usual tools; the Board needs no special agent writer. The browser never edits those files: when the server starts with `--responses`, it records what a person says as new files of its own under `responses/` and `handoffs/`, and the source stays unchanged. Work Board owns the human response content it records, and agents own the surrounding project Markdown. Beyond those records, Board changes project Markdown only by moving finished task briefs between `tasks/` and `archive/`, archiving settled questions with their response history, and rewriting vocabulary fields when you run `work-board migrate`. An optional execution integration such as Work Fleet reports a stage beside the authored status and never writes that stage into task frontmatter.

Work passes between an agent session and a person through explicit records:
1. The agent asks. An **attention request** on an item explicitly asks for a decision, a review or help with a blocker, separate from the item's status; a standalone **question** asks the same as its own item. Today gathers the asks addressed to the maintainer.
2. The person answers in context. A **response** is an independent Markdown record of an answer, a clarification or a deferral, pinned to the exact source bytes and path the person reviewed. An edit to the question afterwards needs a fresh answer. A response does not close the request, change task status or start an agent.
3. The agent reads the reply. `work-board wait` returns once a reply to the reviewed question is recorded, and `work-board responses --follow` lists replies across the workspace as they arrive.
4. The person hands direction over. A **handoff** captures direction and the exact source the person reviewed in another Markdown file. The person copies its short file instruction into an existing agent session, and the agent records receipt by editing that file: acknowledged, rejected or unavailable, which says nothing about execution or acceptance.
5. The agent reports back. A report linked to its work and criteria opens a result review, where the person's feedback is pinned to the reviewed report version. Choosing an authored acceptance option does not supply missing criterion evidence.

An agent's run completion, a recorded answer, a handoff receipt and an accepted result remain separate facts, and the board shows each one without inferring the next. An optional execution integration can acknowledge a managed decision through a separate immutable request receipt, which is equally distinct from a handoff receipt, execution or acceptance.

The rest of this guide follows the work: choose a workspace once, author useful files per feature, and read or respond as the work changes. [Reading the Board](docs/reading.md) describes each page in detail, organized by what you do on it.

### Work vocabulary

| Concept                        | Words                                                           |
| ------------------------------ | --------------------------------------------------------------- |
| Document kind                  | `goal`, `task`, `question`, `report`                            |
| Authored status, on every kind | `draft`, `ready`, `done`, `deferred`, `dropped`                 |
| Computed Fleet stage           | `queued`, `working`, `reviewing`, `waiting`, `done`, `released` |

A goal is **draft** while being shaped, **ready** while being pursued and **done** when reached. A task is **draft** while its brief is incomplete, **ready** when the brief is complete and **done** when its PR merges or its report is delivered. A question is **ready** while waiting for an answer and **done** when answered. A report is **draft** while being written and **done** when delivered. On every kind, **deferred** means parked with a `next_action` explaining what reopens it; **dropped** means given up or replaced. An omitted status is unshaped work and counts as draft. Goal progress splits tasks into done, running, blocked, scheduled and parked states, including work in child goals. Dropped tasks leave both the done and total counts. Set `standing: true` on a goal to keep it active as a home for new work even when its current tasks are done.

`fleet` is a separate approval switch: `approved` permits Fleet to run the task, `held` waits on a person and `manual` leaves execution to a person or Claude. `delivers` is `pr` by default or `report`. `owner` is exactly `codex`, `claude` or `marvin`. Relationships are `implements`, `depends_on`, `relates_to`, `informs` and `replaces`, directed from the replacement to the item it replaces.

Every question carries `scope: task | area | standing` and `urgency: blocking | whenever`. Blocking asks lead the needs-you list. Answered standing questions show their recorded answer, or their ruling body, on related items. Answer records retain response provenance and appear on their questions; they are never standalone items. Handoff records and heading boards do not add document kinds.

Fleet stages describe execution beneath authored status. A waiting stage names you, the orchestrator or automation and gives the reason. A predicted conflict hold says which PR must merge and which files conflict. Fleet never writes its stages into task frontmatter.

A file written with the earlier vocabulary, such as `kind: decision`, `status: planned` or the owner alias `Claude`, is refused with its file, field and the migration command until the Board is migrated once:

```sh
work-board migrate <board dir>
```

The command validates the complete rewrite before changing any file. Unmappable vocabulary values stop migration with a nonzero exit and name their file, field and value. Successful migration rewrites vocabulary fields in place, preserves other source bytes, reports changed files and fields, and changes nothing when repeated. Fleet's legacy `fleet: released` becomes `held`. Owner aliases fold without case sensitivity; Marvin remains `marvin`.

A legacy decision with a nonempty ruling body under `decisions/` becomes a standing, answered question with its ruling kept in the body. Other legacy decisions become task questions. Fleet's own attention state determines their status: closed asks become done, and open asks remain ready and blocking even with an earlier answer. Answers stay in their response records, including answers with only selected options; migration adds no `answer` field. Reviewed question identities and request receipts remain linked through the exact vocabulary rewrite, so settled asks stay settled and Fleet retains its published revision. A subsequent edit to the question still needs a fresh answer. Fleet question bodies never become rulings or answers. Migration retains scalar quoting styles, removes obsolete key lines and keeps JSON frontmatter valid JSON. Replacement fields and `next_action` text such as `Replaced by task.new`, `Superseded by task.new and task.other` or `Folded into task.new` add a `replaces` link on every named existing successor, including hints on done items. The command lists dropped items whose successors it cannot find.

Finished task briefs in `tasks/` move to `archive/` after fourteen days without a change, retaining their area subfolders. Board checks on refresh and hourly while running. Run `work-board archive <board dir>` to archive them immediately. Archived tasks remain in goal progress, relationships and ID lookup, and their IDs cannot be reused for new records. Change an archived task to an open status to return it to `tasks/` on the next refresh; moving it out by hand also makes it active, including while Board is stopped. Keep the workspace's `.board-archive.json` file so Board remembers archived identities across restarts; restoring a brief starts a fresh fourteen-day retention period. In either direction, an occupied destination gets a numbered filename in the same area folder, keeping both briefs. Repository area checks apply only to work that can still run.

Settled questions and their registered questions, responses and request receipts move to `.board-settled/` on refresh, without a retention delay. A source is settled when it is done or dropped, or all its explicit requests are closed; any open request keeps it active. Deferred questions stay active. `work-board archive <board dir>` performs the same move for existing records. The archive catalogue preserves original source paths and item IDs, so existing document and item links load the selected question and its answer history on demand. Routine scans and Fleet answer streams leave the archive alone. Keep the whole `.board-settled/` folder with the Board; its catalogue lets an interrupted move finish when repeated.

### 1. Once per workspace: choose the reading surface

```sh
work-board ./project-notes --home plan.md
```

This serves the existing folder on `http://127.0.0.1:4747`. The first screen at `/` is **Today**, which gathers what needs you, recent answers, work in progress, parked work and goals; [Start from Today](docs/reading.md#start-from-today) describes each part. The optional home file remains a heading board, linked from Today by its own title; other files remain documents. **Getting started** at `/_board/start` offers copyable goal, task and report templates. Save them through your editor or agent tool; the reader does not create files.

A heading board uses `#` for its title, text before the first `##` for its intro, `##` for sections and `###` for cards. A section without cards shows its text. A `---` after the last heading starts the footer; a divider inside a card before another heading stays in that card. Code spans, reference links, footnotes and `<details>` can stay in the Markdown body. Leave a blank line after `<summary>` and before `</details>` when its content is Markdown.

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
status: ready
owner: claude
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

Work fields are optional except that a question requires scope and urgency. IDs are case-sensitive: an ASCII letter or digit, then letters, digits, dots, underscores or hyphens. A unique ID opens at `/_board/item/work.search/`, and its criterion at `/_board/item/work.search/#criterion-keyboard`. These references survive file and heading renames while their explicit IDs remain unique.

`status` and `owner` use the work vocabulary above; `next_action` is nonblank authored text. No section title becomes a status rule. Unknown fields stay in **Original frontmatter** with a diagnostic; valid independent fields still render. Invalid metadata, duplicate IDs and unresolved references remain visible without choosing a source winner. An incomplete index cannot establish unique identity.

A board file selects shared items explicitly. Save this as `review.md`:

```markdown
---

id: board.review
items: [work.search]
---

# Review work

Inspect the selected work and its source before giving direction.
```

Open **Work** on Now, or choose All work and Table. The same item may belong to several boards; a board definition is excluded from All work. All work columns use exact recorded status; missing status stays blank. Filters use status, owner and work text; sorting uses title, owner or status, with missing values last. The URL carries board, filters, layout, sort and selected item. Board and table render the same projection and source detail in React. Missing, repeated and ambiguous members are disclosed.

Use `relationships` for `implements`, `informs`, `depends_on` or `relates_to` links to an item or `item#criterion`. A result can record evidence against the criterion. Save this as `result.md`:

```markdown
---

id: result.search
kind: report
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

`source` is required for an evidence record; `criterion`, `checked_revision`, `observed_at`, `method` and `outcome` are optional. This example has no checked revision or observation time, so both stay blank. When known, record a full 40- or 64-digit hexadecimal revision and an ISO timestamp with a timezone. Source paths resolve from the file holding the claim.

Criteria collect explicitly linked claims across files. Item pages list the item's own relationships under **Links to** and incoming ones under **Linked from**, labelled from the item's side: Depends on and Needed by, Implements and Implemented by, Informs and Informed by, Related to. **Linked from** also shows board membership, evidence sources and ordinary Markdown links. Each source appears under its most specific kind. Repeated source titles collapse into a count that expands to the individual links. Decisions keep their options and rationale in body Markdown. Old recorded revisions remain visible; the viewer does not compare them with current Git state or infer human acceptance. See the [source field reference](docs/delivery/source-examples.md) and [attention field reference](docs/delivery/attention-examples.md) for complete shapes.

#### Richer reading in ordinary documents

`DocumentView` renders tables, task lists, footnotes, raw-HTML details and highlighted fenced code in the browser from typed document-query data. The server delivers the React shell rather than document HTML. Heading passage links and an **On this page** outline distinguish duplicate headings. A long document that opens with its title shows the title and header first and renders the rest section by section, so the page stays responsive; links to a late heading land once that section is in place. Relative document links resolve from their source file, including a nested home served at `/`.

Document content starts with its title and, for frontmatter documents, source status and next action. Missing authored values render nothing. **Context and tools** follows the introduction in document order and contains source provenance, backlinks and the outline of a document with sections. [Read an item](docs/reading.md#read-an-item) describes the page of an identified item: its header, rail, outline and Source tab.

`mermaid` fences draw locally in the browser. Diagrams follow the theme and keep unchanged drawings during refresh. A parse failure exposes its source and error in the React document view.

Metrics and progress use fixed directives with a label and a source:

```markdown
:::progress{completed="3" total="8"}
Browser checks recorded

Source: [Reading checks](checks.md)
:::
```

The component shows the authored tally. Unknown or zero-total counts do not fabricate a percentage; invalid components retain source with a diagnostic. `:::metric` records a value/unit, and `:::timeline` preserves authored entry order. GitHub alert blockquotes render as callouts; comparisons remain GFM tables. The [visual document reference](docs/delivery/visual-document-examples.md) gives full examples and bounds.

Use ordinary image Markdown for source-relative PNG, JPEG, GIF or WebP files. The image route serves at most 16 MiB per file inside the real workspace; images in outside reference folders must be copied inside that boundary. The image gallery and **Inspect diagram** provide zoom and keyboard dismissal. Local image downloads and SVG downloads of a rendered diagram use the browser. A source update marks an already-open preview as older and requires reopening before saving. These actions do not write source or establish acceptance.

### 3. Every day: read and give direction

The sidebar leads to Today, Goals, Now, Library and System, and to pinned and recent documents; **Search** or Ctrl/Cmd+K opens a command palette over document titles and paths, IDs, headings, passages and recorded work fields. [Find your way](docs/reading.md#find-your-way) and [Search the workspace](docs/reading.md#search-the-workspace) describe navigation, Library, reading history and search ranking.

An open page updates in place as files change, and **Pause updates** holds what you are reading until you resume. [Follow live changes](docs/reading.md#follow-live-changes) describes the connection states it reports.

**Work** opens on **Now**, with Fleet work grouped by stage and waiting actor. Waiting cards name who must act and why; a predicted conflict names the PR to merge and the conflicting files. Lanes hold tasks only. Fleet stage remains separate from authored status and takes precedence for execution display. Without Fleet, the Board discloses that execution state is unavailable and shows ready tasks in the queue. A stopped daemon also offers **How to start Fleet**. Recent completions need Fleet's recorded completion time. **All work** shows tasks grouped by authored status; **Table** uses the chosen row sort. Questions, reports and answer records remain available in their reading surfaces. Lists over 200 rows render a moving window inside bounded scrolling lanes or a table.

**System** in the sidebar reads Codex usage windows labelled by duration, the GitHub rate limits Fleet recorded from its own responses, and Fleet health through the Fleet daemon's `daemon.diagnostics` HTTP RPC query at `127.0.0.1:3457`. Set `--fleet-port <port>` or `BoardOptions.fleetPort` to select another daemon port. A stopped daemon leaves System available with one Fleet card marked **Not running** in place of the Codex, GitHub, Fleet and Fleet work cards it feeds; **How to start Fleet** opens `npx @shivaedev/work-fleet serve <folder> --port <port>` with this Board's folder relative to where the Board was started, which runs where `@shivaedev/work-fleet` is a project dependency, and a **Copy** button that selects the command when the clipboard refuses it; and the next refresh retries. Board does not start provider commands or read Fleet's database or health file. The daemon reads Codex with its existing CLI authentication and caches that observation for one minute across Board clients. GitHub figures come from the rate-limit headers of Fleet's own GitHub responses, one row per resource with its observation age and any active rate-limit wait or pause below Fleet's 20% reserve; Board makes no GitHub call. Each source reports its missing configuration or error independently.

The view refreshes through `client.api.diagnostics.query()` every 15 seconds while visible. Pause updates holds the displayed state; resume and returning to a visible tab refresh it. The shared `DiagnosticsContract` and `DiagnosticsSnapshot` schemas live in `@shivaedev/work-board/diagnostics/daemonContract.ts`; the version 2 `FleetHealth` schema lives in `@shivaedev/work-board/diagnostics/health.ts`. The Fleet lane lists every running or waiting item from `client.api.fleetItems.query()` by source title, stage and recorded PR, with explicit loading, unavailable and empty states. Items without readable source retain their work ID; missing PRs remain explicit. The page also shows the publisher's observation time, freshness, running and queued counts, the **Needs you** count Today and the sidebar show, Fleet's counts of work waiting on the orchestrator and on Fleet agents, concurrency cap, last scheduler pass and last observed provider capacity rejection. Fleet's waiting counts never mark the Fleet card as needing attention, so the Board's count stays the only needs-you number on System. Stale snapshots show a Stale badge. Reset times show relative time and the browser’s local clock; System requires JavaScript. Communication failures and API-key accounts explain why their data is unavailable. A publisher clock ahead of Board is disclosed; absent scheduler/rejection observations remain unknown or unobserved.

`client.api.fleetItems.run(undefined)` reads per-item execution through the same daemon client. A `ready` result has `items` for every stage except `done` and `released`, and `completed` for current records completed within the last seven days, including the boundary. Each item carries `workId`, `stage`, a waiting `attentionOwner` when present, `prUrl` when known, and millisecond `stageEnteredAt` and `updatedAt`; completions also carry `completedAt`. Board joins each unique matching ID to `document: { file, title, metadata }`; missing or duplicate IDs keep the Fleet item with `document: null`. For legacy records, stage entry and completion times remain unknown until an observed stage transition; `updatedAt` becomes known on the next write. A stopped daemon returns `{ state: "unavailable", reason, startCommand }`; a communication failure or Board index failure returns `{ state: "unavailable", reason }`. When Board can read every source, an unavailable result also carries `authored`: tasks whose authored status is `ready`, each with `file`, `status`, `title` and `workId`. Set `BoardOptions.fleetPort: null` to disable the item integration.

#### Find what waits on you

**Today** and its navigation badges count human asks from the shared attention projection. They include human-owned next actions, unaddressed standalone questions and validated open attention requests addressed to the maintainer label. Set `--maintainer <name>` to select another literal, case-sensitive label. The default is `maintainer`. Each row shows its title, reason, age and one action; item IDs stay on the item page. **Answer** opens a popover with the request's options or a text answer and a **Read the full question** link to its answer card. When the question's body lists options or a recommendation, a collapsed section in the popover shows them. The popover closes as soon as the server has saved the answer: the row leaves Needs you at once, **Answer saved** appears beside the heading, and the Board refreshes in the background. The server finishes a save it has started even when the browser leaves mid-save, so a question never lands without its answer. While the Board's live connection is reconnecting, the answer controls in the popover and on the item page's answer card are disabled with the reason beside them; a draft on the item page stays in place. A row that can't be answered inline, such as a multi-question packet, a question that takes several choices, a question that can't be read, human-owned work or a row with a problem, shows **Open**, which links to its item or source. Below 640px the reason takes its own full-width line. A Fleet decision's reason reads **Fleet asks:** followed by its question, or by Fleet's reason when it has no single question. A person's next action is the reason as written when the owner is the maintainer label, and reads **<owner> notes:** otherwise; a leading word that repeats the item's status, such as `Dropped:`, is left out. On a Board started without `--responses`, the popover shows the question and its options as text, says answering is turned off and offers no form controls. When a save is rejected, the popover says why. Missing or duplicated identities stay visible with a problem and source link. When a workspace file can't be read, Today says that what needs you is unknown and withholds membership and counts. When workspace sources have metadata problems, the Today summary ends with how many files have problems, linking to **Files with problems** on System, which lists each problem's file, line and reason; the summary drops it once every source reads cleanly. Today rows carry no status chip, because each section heading already names their state. Status chips and the All work and Library filters use the authored states from the vocabulary table.

**Answered** on Today lists recent answers to questions that ask you: a standalone question, or an attention request addressed to the maintainer label. Each row's first line is the item the question is about: the one item its request unblocks, else the question's own document. Its second line joins the question's short label, the answer and what happened since with `·`. The label is the heading of the request's single question, else the request's reason as plain text cut at a word near 80 characters, and is left out when it would repeat the first line. When two rows on one item would still read the same, the label adds the request ID. A row also shows when the latest current answer was recorded. What happened since is read from the source: **Waiting on the agent.** while the item and request stay open and the question's source is unchanged; **It's closed now.** once either closes; **The question changed after the answer, so it asks again.** when its source changed, and the row returns to Needs you; and for a managed decision, Fleet's pickup line until its receipt says it applied or replaced the answer. The source can't show whether an agent read an answer without editing anything, or who made a later edit. Answers still waiting stay at any age; once acted on, your own answers stay for a week and other people's leave. A Board with unreadable sources lists none.

A recorded answer to a uniquely registered ordinary request retires that ask only for the reviewed source bytes and path. Managed decisions retire after an exact-context acknowledgement or when all their targets are closed or deferred. Active asks for the same target set share one row, using the newest reason and response link. Agent-only asks remain available through the typed attention projection. Source diagnostics never create human asks. Work cards show Fleet stage separately from authored status and attention. These projections do not edit source status.

The owner identifies who does the work: `codex` and `claude` are automation, and `marvin` is the maintainer. A human-owned item needs a nonblank `next_action` to enter Today. Deferred items move to **Later**; done and dropped items leave the open queue. These projections do not edit authored status.

Fleet decision sources, captured questions, their answers and request receipts are hidden by default in Library. **Include files Fleet writes (N)** includes them in the current view. Ordinary authored questions remain visible, and all underlying files remain readable and searchable with **Include files Fleet writes** or the `records:` query prefix.

An agent can ask a standalone question with frontmatter:

```markdown
---

id: question.storage
kind: question
status: ready
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

Start with `--responses` to enable saving. Preview and record the answer on the item page. The item page records it under the local author label the browser remembers for the workspace, which the Today popover sets. The kind of reply and the choice to replace an earlier answer sit in the collapsed **More options** section; option questions show a choice and one answer box by default. Closed questions and invalid options keep recorded answers readable, with a clear message when another answer is unavailable. The existing publisher captures the reviewed source as a `kind: question` record in `responses/`, then writes an answer record that links to that capture. Its `question.item` links back to the authored question. An `answer` removes the authored question from Today for those exact source bytes and path; clarification and deferral keep it waiting. An edited question needs another answer. The original source file stays unchanged, and the answer does not establish acceptance or start an agent.

#### Record a human response

```sh
work-board ./project-notes --responses
```

Explicit opt-in enables writes. Open the item’s answer card, read the request reason, and inspect the original source in **Source**. Choose an option or write an answer, then preview and record the Markdown. Questions and decisions can declare frontmatter options and a recommendation; the recommendation is marked but never selected for you. Requests with Markdown question directives keep their prompts and controls together in the card. An answer may say no; a question back and **Not now** are separate kinds of reply. Author labels provide local attribution, not authentication. [Answer on the item page](docs/reading.md#answer-on-the-item-page) describes the answer card.

Registration captures one question generation in `responses/`; submission creates an independent response file there. Original source bytes stay unchanged. Source edits or moves require a fresh review/preview; historical replies still identify the old context. Same-identity/content retries reconcile, conflicting contributions are rejected, and uncertain publication is reported explicitly.

An execution integration may mark a generated `kind: question` request with `attention[].managed: true`. A separate immutable `kind: report` document records `request_receipt` with the registered question ID, its `reviewedRevision`, `recordedAt` and disposition `applied` or `superseded`. An applied receipt names the unique current `answer`; clarification and deferral cannot acknowledge it. Supersession retires the request without inventing an answer. A receipt counts only when it matches the exact current source path and bytes. Until then, a request that asks you, has exactly one current `answer` and no receipt leaves Needs you for **Answered** on Today. Its answer card and Now card say who answered, which option they chose and whether Fleet picks it up on its next pass, once it starts again, or, while Fleet is still loading, that it waits for Fleet; the Fleet stage shows `waiting` with automation as the actor. The answer card keeps the answer form behind **Change your answer**, prefilled to supersede the current answer, so a changed answer from you or anyone else replaces it. Requests between agents do not enter this state. When every receipt for the question counts, the request leaves the item's answer cards and Today lists it under **Answered** as applied or replaced, and the reading shows the applied receipt if there is one. When any receipt does not count, for example because it names another revision or an answer that was since replaced, Today keeps the request with a problem naming the receipt files instead of offering an answer. `currentResponses(responses)` from `@shivaedev/work-board/responses/current.ts` selects the latest response per author, ordered by recorded time and then response ID, and removes explicitly superseded responses. Managed acknowledgements use this selection; different authors remain competing, and superseding an author’s latest response does not revive an earlier answer. The source remains unchanged and readable. Ordinary authored requests remain source-driven; receipts grant no execution, acceptance or delivery authority.

Browser drafts use form’s persisted drafts, keyed by workspace, item and request, with a 256 KiB limit per draft and a seven-day lifetime after the last edit. Navigation, reload and source refresh retain them; text edited while an earlier save completes remains an unsaved draft with a fresh identity. Malformed or expired drafts are discarded; unavailable storage leaves the form usable. **Clear draft** restores the current form’s initial values without changing saved records or saved responses.

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

To watch replies across every question in a workspace, follow its files:

```sh
work-board responses --follow ./project-notes
work-board responses --follow ./project-notes --since 2026-01-01T00:00:00Z
```

Each stdout line contains the item ID, request ID, response ID and first line of the answer Markdown, separated by tabs. The feed includes answers, clarifications and deferrals once each, ordered by recorded time and then response ID within each refresh. It skips responses recorded before startup unless `--since` supplies an inclusive ISO timestamp. It reads the folder directly, so a running Board server is unnecessary.

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

Options begin unselected. `select="one"` is the default, `select="many"` permits multiple choices, and `select="text"` uses human text without options. Every prompt accepts extra text. By default, an answer needs a choice or nonempty text per prompt, including a text-only rejection of the framing. Add `required="selection"` to a choice question when an answer must name an option; text remains an optional note, and Clarify / Not now still accepts explanatory text. Fleet uses this requirement for its guided actions. The server validates prompt/option IDs, selection mode and completeness against captured context; one submission returns one response with typed answers and readable Markdown through the existing wait.

If several requests are open in one file, add `request="keyboard-review"` to each matching question directive. Optional explicit supersession links immutable new direction to an earlier response; it does not rewrite task status or accept work. Source edits preserve human text and clear selections for review. The [packet reference](docs/delivery/decision-write-examples.md) gives a complete item, all modes and validation limits.

#### Hand a task to an existing agent session

Open a uniquely identified project item and choose **Prepare an agent handoff**. The page is titled with the item. The agent name starts as the item's owner, and the next step starts as the item's `next_action` unless the item is closed, such as done or dropped. Review the current source, adjust the fields and choose **Prepare handoff**; **Preview file** optionally shows the file first. The existing `--responses` opt-in enables this writer too. It creates `handoffs/<id>.md` with a stable identity, direction, source path, reviewed SHA-256 and exact source snapshot, including original frontmatter and declared criteria. Context is limited to 256 KiB of UTF-8.

After preparing, focus moves to the prompt, and one status line reports the save and any copy. The agent name stays for the next handoff. **Copy prompt** gives a short instruction containing the absolute saved path. Paste it into the intended existing session. If clipboard access is unavailable, the prompt is selected for manual copying. Preparing a handoff records `requested`; it does not notify, wake or launch an agent.

The agent edits `handoff.state` to `acknowledged`, `rejected` or `unavailable` and can add `handoff.by` and `handoff.note`. These are explicit local receipt facts, independent of task status, execution and human acceptance. An absent receipt stays unconfirmed; damaged or ambiguous history stays unavailable.

Same-ID retries preserve receipt and extra metadata, including after source deletion. Restarted servers read the recorded receipt. Different direction and moved or duplicate identities are conflicts; a changed source before initial preparation requires another review. Saved context remains inspectable when its source disappears. Earlier handoffs show when they were prepared. Native navigation and Back retain owned draft text. When the source changes under a draft, the first **Prepare handoff** binds the draft to the new version without saving, and a second one saves it. Handoff drafts use form with a separate key per workspace and item, under the same seven-day/256-KiB limits. **Clear draft** clears only the current form.

The [handoff source reference](docs/delivery/handoff-examples.md) shows a complete record, ordinary receipt edits and the boundary with optional execution integrations.

#### Review the returned result

A file with `kind: report` and a unique ID is reviewed on its own item page, `/_board/item/<id>/`. Above the report sit its open review requests, then each linked item by title with its status chip and a **Prepare follow-up handoff** link, the criterion-level claims and missing provenance, and the human feedback. The report's authored status stays in the page header, apart from linked work status. Whatever is missing, whether a review request, checks or feedback, is said in one line. Older `/_board/result?item=<id>` links redirect to the item page. Reading through normal GET or the typed query leaves project files unchanged.

The agent declares an explicit open `attention` request of kind `review` on the report. That request links into the existing response surface. A Markdown question packet can offer request revision or accept this exact report, with room for human rationale. These options are authored text, rather than reserved acceptance states. Preview and submit the response against the exact source you reviewed.

Feedback matching both the current report SHA-256 and source path is labeled **This version** and dated by when the report was received. An edit or move labels the old feedback **Earlier version**, dated by when it was reviewed; its saved snapshot and full SHA-256 remain inspectable under **Report as reviewed**. A new response can explicitly supersede the revision request. Malformed or duplicate history stays unknown: the feedback list names each file it can't read, says why, and links to System's source problems. Only files that could hold this result's feedback count: questions about the result or its linked work, their responses, and response files too broken to say which question they answer. A broken file about other work shows only in System. None of those actions changes linked task status or supplies missing criterion evidence.

Reported `evidence.checked_revision` is a Git revision, distinct from the report's source SHA-256. Work Board does not compare evidence with the current checkout; evidence freshness remains unknown. The [returned-result source reference](docs/delivery/result-review-examples.md) gives complete task/report files and the reviewed-revision wait workflow.

### API and integration

Import the module that defines a name. The package has no root entry; a module's import path is its path under `src/`, which the `./*.ts` export maps to its source, declaration and runtime files. The browser bundle sources under `client/` stay unexported. The main entry points are `server/board.ts` (`boardLayer`), `server/serve.ts` (`serveBoard`), `server/responses/agent.ts` (`agentRequest`) and `browserClient.ts` (`browserClient`); `rpc/` holds the native contracts and `rpc/rejections.ts` the declared errors. The [source directory](https://github.com/ShivaeDev/platform/tree/main/packages/work-board/src) contains file/watch, HTTP, rendering, search, views and result-review helpers. Compose `boardLayer` to retain the package's source policy and request guards.

#### Embed the workspace

```ts
import { NodeServices } from "@effect/platform-node";
import { boardLayer } from "@shivaedev/work-board/server/board.ts";
import { Layer } from "effect";
import { HttpRouter } from "effect/http";

const board = HttpRouter.toWebHandler(Layer.provide(boardLayer({ root: "./project-notes", home: "plan.md" }), NodeServices.layer));

try {
	const response = await board.handler(new Request("http://localhost/", { headers: { host: "localhost" } }));
	console.log(await response.text());
} finally {
	await board.dispose();
}
```

`boardLayer` needs `FileSystem`, `Path` and the HTTP router services; `NodeServices` provides the filesystem/path implementation here. `root` is required, `home` is optional, `maintainer` selects the human responder label (default `maintainer`), and `responses: true` explicitly opts into publication. `HttpRouter.serve` can compose it beside application routes in a scoped Effect HTTP server. Requests require a loopback host as resolved by Effect's HTTP server; a missing or non-loopback host is refused, as is a known non-loopback remote address. The embedding host owns its trust boundary.

#### Read and wait from a Node agent

```ts
import { Effect } from "effect";
import { agentRequest } from "@shivaedev/work-board/server/responses/agent.ts";

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
import { agentRequest } from "@shivaedev/work-board/server/responses/agent.ts";

const [revision] = process.argv.slice(2);
if (!revision) throw new Error("Pass the reviewed revision as the first argument.");

const answer = await Effect.runPromise(
	agentRequest(
		"wait",
		{
			request: "work.search/keyboard-review",
			revision,
			url: "http://127.0.0.1:4747",
		},
		console.error,
	),
);

console.log(JSON.stringify(answer, null, 2));
```

`agentRequest` returns an Effect and manages its RPC scope. `question` uses `item/request`; registering `wait` needs that pair plus `revision`. To reattach, pass the returned question ID as `request` without `revision`. `response` also takes a question ID; `after` on `wait` selects a later reply.

#### Use the native browser client

```ts
import { browserClient } from "@shivaedev/work-board/browserClient.ts";

export async function registerReviewedQuestion(url: string, revision: string) {
	const client = browserClient(url);
	try {
		const page = await client.read(client.api.document.query({ url: "/_board/item/work.search/" }));
		const question = await client.mutate(
			client.responses.registerQuestion.run({
				item: "work.search",
				request: "keyboard-review",
				revision,
			}),
		);
		const history = await client.run(client.responses.responses.run({ question: question.id }));
		return { page, question, history };
	} finally {
		client.registry.dispose();
	}
}
```

Call this function with a revision whose source/context you have reviewed and a server started with `--responses`. `api` binds reading operations; `responses` binds question and response operations. Each of its three writes has one job: `answerQuestion` registers a question and records its answer in one save, which is what the browser uses; `registerQuestion` registers a question without answering it, which is how an agent registers before it waits; `recordResponse` answers a question that is already registered, by its ID, such as one an agent registered with `wait` or one Fleet published. `answerQuestion` takes the answer with its `item`, `request` and reviewed `revision`, and finishes on the server even when the caller goes away. `read` resolves a query atom, `run` executes a query Effect, and `mutate` executes a command with its invalidation service. `handoffs` binds source/history queries and the preparation command. The client also exposes `registry` and `updates`; dispose the registry when its owner ends.

`client.api.navigation.query({ current: "" })` returns compact destination `counts`, `inboxCount` (a number or `null` when the index is unavailable), and optional `home` with the configured home file and its unique identity. It contains no file tree. `client.api.library.query({})` loads document metadata on demand: `files` contain `path`, encoded `href`, `title`, `modified`, `kind` and `status`; `kinds` and `statuses` populate filters, with one status per plain name, and `fleetCount` counts hidden generated records. Optional `kind`, `status`, `query` and `showFleet` filter the files; `status` matches every status that shares its plain name, and `query` keeps the files whose title or ID contains every word, ignoring case. Passing `folder: ""` lists root files and immediate folder descriptors; passing a folder path loads its direct files and immediate child folders. Folder descriptors contain `path`, `name` and descendant `count`. The shell reads active goal status counts from `client.api.goals.query()`; opening Library loads its own query.

`client.api.goals.query()` returns `{ closedGoals, deferredGoals, goals, items }`. Goals are uniquely identified goal documents grouped by authored status, with standing homes kept active. `items` holds identified implementing documents with source metadata and open-ask context; answer records are excluded. Each goal has authored fields, `criteria`, `asks`, `openAsks`, task `counts`, `linked` and `unlinked`, plus `lanes` containing each implementing goal and its own task counts. Counts use `done`, `running`, `blocked`, `scheduled` and `parked`, count each task once through child goals, and exclude dropped tasks. Each criterion includes its task counts and the number of recorded evidence claims targeting it. Started Fleet work stays running until done or released, including turns waiting for an answer, CI or merge; work blocked before it starts counts as blocked. Fleet replies without execution details use their working or reviewing stage. Approved work that has not started counts as scheduled; draft, deferred, held and manual work stays parked. Mounted queries refresh when indexed source changes. [Read a goal](docs/reading.md#read-a-goal) describes the goal page that renders this query.

`client.api.overview.query()` returns `{ fleet, goals }` from one Board index and one Fleet read. The pane and overview tools use this snapshot so In flight and goal running counts agree. An unreachable Fleet returns an explicit unavailable state.

For a handoff, first read the preview with `client.run(client.handoffs.handoffSource.run({ item: "work.search" }))` and inspect its `context`. This complete program takes that reviewed path and revision as inputs:

```ts
import { browserClient } from "@shivaedev/work-board/browserClient.ts";

export async function prepareReviewedHandoff(url: string, source: string, revision: string) {
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
				constraints: "Preserve keyboard navigation.",
				nextAction: "Inspect the current source and report browser evidence.",
			}),
		);
		const history = await client.run(client.handoffs.handoffs.run({ item: "work.search" }));
		return { saved, history };
	} finally {
		client.registry.dispose();
	}
}
```

Pass `preview.source` and `preview.reviewedRevision` only after reviewing the preview's context. `saved.prompt` is the short instruction to copy into the agent session, and `history` contains records plus paths whose history is unknown. Keep the same ID for a retry of identical direction; choose a new ID for new direction.

Result reading returns the report, linked criteria and revision-pinned feedback from its typed query:

```ts
import { browserClient } from "@shivaedev/work-board/browserClient.ts";

export async function readReturnedResult(url: string, item: string) {
	const client = browserClient(url);
	try {
		return await client.read(
			client.api.result.query({
				url: `/_board/item/${encodeURIComponent(item)}/`,
			}),
		);
	} finally {
		client.registry.dispose();
	}
}
```

Pass a uniquely identified result, such as `result.keyboard`. Answer its declared review request like any other: read it with `responses.question`, then save with `answerQuestion` or the normal browser response controls; there is no separate acceptance writer.

RPC rejections use Platform taxonomy classes: `Forbidden` for disabled writes, `NotFound` for missing context, `PreconditionFailed` for stale review, `Conflict` for incompatible content, `BadRequest` for unsupported input and `ServiceUnavailable` for unavailable reads. Unexpected handler failures become `InternalServerError` with a redacted public message and a server-only trace cause. These errors need no login middleware. `PublicationUncertain` means publication may already have produced a file; inspect the saved identity/content before retrying. `Unanswered` is the wait client’s deadline error.

#### Render a source query in React

Read `client.api.document.run({ url: "/notes.md" })` to get Markdown body source, metadata and diagnostics, resolved links and references, file information, resolved question actions and request previews with response history. Identity URLs and `/` use the same document query. Missing and duplicate identities reject with `NotFound` and `Conflict`; incomplete history stays explicitly unavailable. The query sends no rendered HTML or syntax tree.

The Board shell renders this data in its internal `DocumentView`, using the Board's GFM, directive, heading and footnote plugins with raw HTML, browser-side Shiki and a Mermaid code override. The Board shell is a React app with TanStack Router. Its route loaders read document and projection contract queries through `react` in the shell's native registry; preloading and navigation share those reads. Document and item pages mount `DocumentView` from the typed document query; Today, Goals, Now, Library and System render typed projection queries in React, as do the home document, Start, Handoff and Result. Their direct URLs load the shell and require JavaScript. While a page waits for its data, the shell shows a skeleton shaped like that page instead of a blank page. Empty lists, lanes, tables and search results say what is empty, what fills them and, where one exists, link to a next step. The optional `reading` data supplies source context, backlinks, criterion claims and managed receipts; request `prompts` supply answer controls. Consumers of the source query own their rendering.

#### Headless addon API

Work Fleet uses the server entry points below and the portable metadata type entry point under `@shivaedev/work-board/integration/`. The server APIs reuse Board's document, response, attention and diagnostics implementations. They need no browser or HTTP server; filesystem Effects use the native Node services Layer, and watchers retain their native Effect scope.

| Entry point                         | API object                                                                                                                   |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `server/integration/processes.ts`   | `processes`: scoped Board directory ownership shared by the Board CLI and Fleet supervision                                  |
| `server/integration/board.ts`       | `board`: the scoped watched index, metadata parsing and model, Markdown listing and watching                                 |
| `integration/metadata.ts`           | Portable metadata types, also available through `server/integration/board.ts`                                                |
| `server/integration/responses.ts`   | `responses`: the workspace and response services, reading, recording and publishing questions and responses                  |
| `server/integration/attention.ts`   | `attention`: managed request receipts and the attention projection                                                           |
| `server/integration/diagnostics.ts` | `diagnostics`: Fleet health, the daemon diagnostics contract and provider limits                                             |
| `server/integration/publication.ts` | `publication`: `directoryPath`, `validateDirectory` for addons that publish their own records through open directory handles |

```ts
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { board } from "@shivaedev/work-board/server/integration/board.ts";

const read = Effect.scoped(
	Effect.gen(function* () {
		const index = yield* board.watchIndex("./notes");
		return yield* index.read;
	}),
).pipe(Effect.provide(NodeServices.layer));
```

Start `board.watchIndex(root, home?, maintainer?)` once in the owning Effect scope and share its `read` Effect and `changes` with in-process consumers. It starts indexing immediately, retains the listing, parsed documents, identity diagnostics and unavailable paths, and updates the index before publishing each settled change through `changes.events`. Reads share the snapshot and touch no unchanged files while the watcher is healthy. A full check every minute rereads source bytes to repair missed events, including edits that preserve timestamps; `index.reconcile` runs the same check on demand. Closing the scope releases the watcher and background checks.

Other processes read the same listing, parsed metadata, diagnostics and unavailable paths with the `work-board.index` RPC, available over TCP and `board.sock`. Subscribe to that query through the native `work-board.$changes` API and reread on a change or resync. `BoardIndex` from `@shivaedev/work-board/rpc/BoardIndex.ts` describes the RPC result; maps are represented as arrays for transport.

Provide `responses.Workspace.layer` to `responses.Responses.layer`, then supply `responses.WorkspaceConfig` with that typed index, the same watcher, workspace `root`, optional `home` and explicit `writable` choice. The workspace service exposes `settings()` (root, real root, changes, home and write choice), `index()` (with `PlatformError` failures) and `document(url)`; the Board runtime and its in-memory harness compose the same service and RPC Layer. Use the service to register reviewed questions and record answers; `responses.publish` writes an immutable record under `responses/` (or `handoffs/` when selected), and the record helpers preserve exact reviewed bytes and source path. Agent-owned items remain ordinary Markdown edits. `attention.projection(snapshot)` returns the typed attention projection: `you`, `answered`, `agents`, `resolved`, `parked`, `later`, `issues` and `complete`, with `items` retaining the same rows as `you` for existing clients. `attention.managedRequestReceipt` qualifies an acknowledgement against those records; it does not confer execution or acceptance authority. The publication helpers retain the filesystem limits below.

`pnpm lint` fences Fleet's production imports to these entry points; its test fixtures may use Board modules directly.

#### Read the running board through MCP

Start the board with `work-board /absolute/path/to/notes`. Register its read-only stdio MCP server with Claude Code or Codex:

```sh
claude mcp add --transport stdio work-board -- work-board mcp /absolute/path/to/notes
codex mcp add work-board -- work-board mcp /absolute/path/to/notes
```

Both commands require `work-board` on the client's PATH. `work-board mcp <dir>` reads the running board through `<dir>/board.sock`; it uses the same computed queries as the browser. If no board answers, every tool returns one error naming the directory and the `work-board <dir>` command to start it.

| Tool                                   | Returns                                                                                                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `board_overview`                       | Needs-you count and items, in-flight Fleet items with stage and PR, and active and closed goal progress counts                                                                       |
| `needs_you`                            | The `you` lane with reason, frontmatter options, computed question prompts and their choices, recommendation, and `ageMs` since the source's last modification (`null` when unknown) |
| `item` with `{ "id": "task.example" }` | Computed status, owner, criteria, relationships, Fleet stage and open decisions                                                                                                      |

Fleet unavailability stays explicit in results. These tools read state without changing files or starting a board.

In Claude Code, the [Work Board plugin](https://github.com/ShivaeDev/platform/tree/main/packages/work-board-plugin) reads the same socket without registering a server: it finds the nearest `.work` folder above the session, shows Needs you, In flight and Goals in a pane and a band above the prompt, and offers the same three tools.

#### CLI reference

| Server argument       | Default      | Meaning                                                                                             |
| --------------------- | ------------ | --------------------------------------------------------------------------------------------------- |
| `<dir>`               | Required     | Existing folder to read                                                                             |
| `--home <file>`       | None         | Listed Markdown heading board linked from Today by its title; a missing file prevents startup       |
| `--maintainer <name>` | `maintainer` | Literal `response_from` label for human questions; unaddressed standalone questions remain included |
| `--port <number>`     | `4747`       | Loopback server port; `0` asks for a free port                                                      |
| `--responses`         | Off          | Enable local question/response/handoff publication                                                  |

| Agent argument                               | Meaning                                            |
| -------------------------------------------- | -------------------------------------------------- |
| `question <item>/<request>`                  | Read current context without registration          |
| `wait <item>/<request> --revision <hash>`    | Register reviewed context and wait                 |
| `wait <question-id> [--after <response-id>]` | Reattach or wait for the next response             |
| `response <question-id>`                     | Read the saved conversation                        |
| `--port <number>`                            | Select the shared server's port; default `4747`    |
| `--url <origin>`                             | Select an HTTP loopback origin instead of `--port` |

The browser carries RPC and live query traffic over one WebSocket at `/_board/rpc`. Local command clients can also use NDJSON RPC at `POST /_board/rpc`. Ordinary document GETs, `/_board/start`, `/_board/goals`, `/_board/work`, `/_board/library`, `/_board/system`, `/_board/handoff`, and identity links load the React shell. `GET /_board/respond` redirects an open request to its item’s answer card and `GET /_board/result` redirects to the result's item page, both with HTTP 302; an unavailable request returns an HTTP 409 page. Search and live subscriptions use the same RPC route. There is no automatic workspace discovery or server launch in agent commands.

A running `work-board <dir>` also serves that NDJSON RPC at `POST /_board/rpc` over the Unix socket `<dir>/board.sock`, using the same handlers and services as TCP. Tools can read `work-board.inbox`, `work-board.fleetItems` and `work-board.goals` from the board directory without knowing its port. Each board directory has its own socket. For example:

```sh
printf '%s\n' '{"_tag":"Request","id":"1","tag":"work-board.server","payload":null,"headers":[]}' |
  curl --unix-socket ./notes/board.sock http://localhost/_board/rpc \
    -H 'Content-Type: application/ndjson' --data-binary @-
```

The `work-board.server` query takes no payload and returns `{ url, directory }`, for example `{ "url": "http://127.0.0.1:4747/", "directory": "/home/me/project/notes" }`. It is available over both TCP and the socket; `url` uses the actual browser port, including when `--port 0` selects a free port. Its `Server` schema is exported from `@shivaedev/work-board/rpc/Server.ts`.

The socket has owner-only access from creation: startup binds inside a private sibling directory at `.sXXXXXX/s`, applies mode `0600`, then publishes `board.sock`. The private socket pathname is no longer than the public pathname, so staging does not reduce the directory lengths that Unix sockets support. These permissions provide its access boundary because Unix connections have no TCP remote address. Requests to `http://localhost/_board/rpc` with `Host: localhost` work over the socket; TCP retains its loopback Host and remote-address checks. Startup removes an unanswered stale socket and refuses to start when another board already answers there. A temporary `.board.sock.starting/` directory serializes stale removal and publication across processes. It is removed when startup completes or its scope closes. The private staging directory is also removed when startup completes or its scope closes. If a process is forcibly killed during startup, the error identifies the lock directory; remove abandoned startup directories only after confirming that startup is no longer running. Closing the board removes its socket, including on SIGINT and SIGTERM. If the board directory is committed, add `board.sock` and `.board.sock.starting/` to that directory's ignore rules.

### Install and limits

```sh
pnpm add --global @shivaedev/work-board
```

Node 24 or newer is required. For embedding, install the package into the project with the matching Effect peers declared in its [manifest](https://github.com/ShivaeDev/platform/blob/main/packages/work-board/package.json): `effect`, `@effect/platform-node` and `@effect/platform-node-shared`.

Serve trusted folders: the ordinary reader retains raw HTML rather than sanitizing it. Response, handoff and result-review surfaces disable raw HTML, escape exact-source disclosure and block source form actions/frames. Writes require same-origin loopback NDJSON commands and explicit server opt-in; local author labels are not accounts.

Files/folders below the root beginning with a dot, and `node_modules`, are skipped; the root itself may be a dot folder. Unlisted paths and traversal are refused. Directory references grant reading, not write permission. Restoring a target that was already broken when watches were built requires restarting the server.

Publication runs on Linux and macOS and needs a real workspace directory, hard links and directory synchronization. Linux anchors each step to open directory descriptors through `/proc/self/fd`. macOS has no such anchor in Node, so it uses canonical paths and checks the directories' device/inode identity before and after publishing; a directory or ancestor swapped between two checks is not detected, so keep write boundaries under trusted local ownership. Node's `fsync` on macOS does not issue `F_FULLFSYNC`, so a successful save is not a power-loss guarantee there. Read mode remains separate. No-replace publication and retry reconciliation protect recorded contributions; agents edit handoff receipt through ordinary files. An unrelated editor can still change source after preflight. Records retain the exact reviewed context, rather than claiming an atomic transaction with that editor. Moved directories or synchronization failures can produce an uncertain outcome.

The browser workspace requires JavaScript. Tailwind and shared React primitives style its views; project Markdown remains readable in an editor independently of the browser. Image routes exclude SVG, HTML, PDF and arbitrary attachments. The board does not launch agents, verify recorded evidence or generate exported document packets.
