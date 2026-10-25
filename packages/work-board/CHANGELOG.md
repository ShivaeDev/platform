# Changelog

## 0.31.5 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.31.4 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.31.3 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.31.2 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.31.1 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.31.0 - 2026-10-25

### Added

- Declare `keyScope: "session"` on a contract and bind it with `bind(Api, Client, { registry })`. Its query keys, successful-command invalidations, live hints and reconciliation use that session registry's scope. `List` and `Item` retain their shapes and item/list/wildcard semantics; `readKeys`, `invalidationKeys`, `makeLiveServer.stream` and `live` accept contextual scope resolution. Server adapters receive the `KeyScope` annotation and must resolve session scopes from request-local authenticated identity.
- Session-scoped automatic subscriptions track mounted query references per registry and release them when queries unmount or the registry is disposed.

### Breaking

- The reserved `<contract>.$changes` payload is now `{ queries: [{ query: "get", payload: { id: 1 } }] }`, typed and decoded with the contract's declared query payload schemas. Custom clients must replace `{ keys }` with declared query references; payloadless queries use `{ query: "list", payload: undefined }`. Subscription handlers must resolve these references with `queryKeys(Api.declaration.queries, queries)` or the RPC's `ChangesReads` annotation before calling `makeLiveServer.stream`. `changesRpc` now requires both the contract name and its query declarations. No raw-key subscription endpoint remains.
- Board's handoff and response RPC contracts use distinct `work-board-handoffs` and `work-board-responses` namespaces so merging contracts preserves each declared subscription schema. Custom RPC clients must replace the `work-board.` prefix for handoff and response operations with the corresponding namespace; operation names and payloads stay the same.

## 0.30.11 - 2026-10-25

### Fixed

- Build browser assets before starting the Board from source so checkout runs serve the current client. Failed pages show RPC error tags and messages, or a reload hint when the browser and server disagree on the response shape.
- Keep parallel Board stories from rebuilding the shared browser assets while readers load them.

## 0.30.10 - 2026-10-25

### Fixed

- Keep answered standing decisions out of Needs you while they wait on the agent; editing the reviewed question asks again.
- Show Today answer controls before collapsed item context, and keep desktop answer panels within the viewport.

## 0.30.9 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.30.8 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.30.7 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.30.6 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.30.5 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.30.4 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.30.3 - 2026-10-24

### Changed

- Require Effect and its companion packages at exactly 4.0.5. Generated applications use the same versions.

## 0.30.2 - 2026-10-24

### Changed

- Align published dependency and peer pins and the generated starter with React and React DOM 19.3.1, TanStack Router 1.170.45, Better Auth 1.7.10, happy-dom 21.0.3 and Vitest 5.0.5. The starter also uses pg-boss dashboard 1.12.1.

## 0.30.1 - 2026-10-22

### Fixed

- Fleet's close-finished-decisions command settles asks whose current answers were already applied, closing their attention and marking their questions done. Unconsumed answers to earlier revisions stay open.
- Board migration stops reading successor lists at comma-separated prose, preserving item links without reporting ordinary words as unresolved successors or linking them to unrelated items.

## 0.30.0 - 2026-10-22

### Breaking

- Board and Fleet share four document kinds, five authored states, canonical owners, approval and deliverable fields, question scope and urgency, and six Fleet stages. Run `work-board migrate <board dir>` before starting the new version. Old vocabulary is rejected without aliases. Fleet upgrades stored stages through its database migrations. Consumers of detailed engine states use `record.step`; `record.stage` now contains the shared stage.
- Migration validates all files before writing, reports unmappable values, preserves Fleet questions and recorded answers, retains Marvin as the maintainer, and links named replacements while listing unresolved successors.
- Fleet ask status follows its open or closed attention state, including when earlier revisions have answers. Selection-only answers survive migration. YAML scalar styles and JSON frontmatter stay intact. Closing or acknowledging a Fleet ask marks its question done.
- Vocabulary migration preserves reviewed question identities, published Fleet revisions and request receipts. Answers remain in response records and standing rulings remain in their bodies; migration writes no `answer` field. Replacement hints link every named successor, including done items and “Folded into” hints.

## 0.29.1 - 2026-10-21

### Changed

- Release with updated workspace dependencies.

## 0.29.0 - 2026-10-20

### Added

- Fleet supports advisory reviews with the worker’s product context. Completed reviews are saved as linked Board result documents, and their TL;DR appears in ready-to-merge decisions and the Board’s ready list without sending reviewer findings back to the worker.

### Breaking

- `@shivaedev/work-fleet`’s `Review.verdict` also allows `"unavailable"` for an advisory reply without a parseable verdict. Consumers that exhaustively handle verdicts must handle this value and read the retained document for the original reply.

## 0.28.0 - 2026-10-19

### Added

- A Pull requests page groups Fleet's current PRs with ready-to-merge work first, links PR numbers and Board task titles, and shows time in each state. Its navigation badge counts PRs waiting for a merge and updates with Fleet's live state.
- Board's Fleet item projection exposes an optional `readyToMerge` flag derived from Fleet's current published merge decision.

## 0.27.1 - 2026-10-19

### Changed

- A returned result is reviewed on its own item page: its review request, checks and evidence, and feedback sit above the report, and whatever is missing is said in one line. `/_board/result?item=<id>` links redirect to the item page, and the item no longer offers a separate **Review returned result** button.
- Feedback says when the reviewed report version was received or reviewed instead of showing a shortened hash; the full SHA-256 stays under **Report as reviewed**.

### Fixed

- When feedback can't be read, the Board names each file and the reason, and links to System's source problems.
- A broken question or response about other work no longer hides a result's feedback, and an authored question about a result no longer counts as a broken record.
- Mermaid diagrams use the Board's neutral colours in light and dark, so notes, clusters, edge labels, Gantt bars, mind maps and branch labels stay readable and no diagram is painted amber.

## 0.27.0 - 2026-10-19

### Added

- Reading history groups documents by the day you read them and shows when each was read, its kind and its status. Each entry has a remove button, and **Clear history** removes them all after an in-page confirmation while pinned documents stay. History now keeps the last 30 documents instead of 10.

### Changed

- The sidebar's and phone More sheet's Recent list leaves out pinned documents and the page you are on.
- The palette command that toggles the sidebar reads **Show or hide sidebar**, and documents that list this one in a heading board appear under **Listed in**.

## 0.26.0 - 2026-10-19

### Added

- A closed decision or question opens with an **Outcome** block before its body: the chosen option or recorded answer, who answered and when. A closed decision without a recorded answer says so.
- `Changes` accepts an optional `refreshPaths` that rereads only the given files. Board writes use it when present and fall back to `refresh`.

### Changed

- Fleet decision pages are titled "Fleet decision:" followed by the task title in their heading, the browser tab, sources and search, so they no longer share the task's title.
- Fleet decision pages wrap their fenced decision and recommendation text and hide sections with nothing in them, such as an empty "Relevant links".
- On item pages, screen readers and the Tab key reach the main content before the side panel with details and the outline. The layout on screen does not change.
- Goal sections link as `#progress`, `#criteria`, `#linked-work` and `#by-criterion`, so outline links and shared links keep working on every goal.
- Only Progress, Criteria, Linked work and the item context are named page regions. Link groups in the side panel are plain lists under headings.
- A plain Markdown file without front matter shows no empty Details card.
- Now cards call held work **In progress** instead of naming its stage, and Today's In progress rows from Fleet say **Fleet** without the stage; Now's lane titles still name the stage. Today's In progress also lists Fleet work that is validating or delivering.

### Fixed

- Going back focuses the link that opened the page when that link is still there, and the page otherwise.
- An empty Details panel is no longer a Tab stop.
- Tasks whose files say `status: review` appear in Now's Reviewing lane, count as in progress on Today and in the Now count, and land in the same group on their goal page. One status vocabulary now drives Now, Today, the navigation count and goal pages.
- Fleet-approved tasks with `status: ready` appear in Now's Queued lane while Fleet is unavailable, and `approved` work counts as planned on goal pages instead of in progress.
- A task, or an item that implements a goal, whose status the Board does not know is listed on System as a file problem instead of being dropped from Now or counted as in progress on its goal page.
- The sidebar's Now count reads **1 open task** in the singular.
- Today's text box for a question's prompt stops at the 8,192 characters such an answer can hold, as the item page does, instead of accepting a longer answer that then cannot be saved.
- Saving an answer, registering a question or preparing a handoff updates the index for the file it wrote instead of rereading the whole workspace, so the saved answer is confirmed and reaches open pages sooner.
- A new or removed folder, such as the response folder an answer lands in, is listed on its own instead of listing the whole workspace again.
- Startup lists the workspace once instead of twice before the first index.

## 0.25.0 - 2026-10-19

### Added

- An item page leads with the open asks in other files that name it: "Waiting on you: <title>" in amber with an **Answer** button when the ask waits on you, and "Waiting on agents: <title>" in neutral colours when only agents can answer it.
- On a phone, a question page shows an **Answer** button at the top that moves to the answer box and focuses it.
- Item IDs and workspace paths in a next action show the named document's title as a link with its status chip. Words that name no document stay plain.
- `#123` and `PR 123` in a next action link to the pull request when the workspace's `package.json` names a GitHub repository or its git checkout's `origin` remote is on GitHub, without Fleet running.

### Changed

- On a phone, Answer on Today opens a bottom sheet instead of a small popover, and its Answer and Record answer buttons are touch-sized. The phone navigation bar hides while you type in any text field, and the page fits above the on-screen keyboard.
- Opening Answer on Today puts focus in the text box, or on the first option, instead of the question's context.

### Fixed

- Today's answer keeps what you typed after you close it, and shares one draft with the item page for the same question: start on Today, finish on the item page, or the other way round.
- An option chosen on Today records the same response body as the item page, without a nested second copy of the recorded response.
- An answer recorded on Today includes everything in the shared draft, such as a note, reply kind or replaced answer set on the item page. Today says when it sends any of those and links to the item page to review them.

## 0.24.0 - 2026-10-19

### Added

- The **On this page** outline marks the section the reader is in, on wide screens and in the phone outline menu.
- Today lists recent answers under **Answered**: the item each question is about, when it was answered and what happened since. An answer reads "Waiting on the agent." until its item closes, its question changes or Fleet's receipt settles it. Answers still waiting stay listed at any age; your own settled answers stay for a week. The inbox projection carries them as `recent`.
- The Fleet start command has a Copy button. When the clipboard refuses it, the command is selected so you can copy it yourself. Start, Handoff and closed drafts share the same copy behaviour.

### Changed

- Table and All work on Now scroll with the page instead of inside fixed-height boxes, and so does the phone's Now lane. The table header sticks below the workspace header.
- Switching between Now, All work and Table keeps the page still while the results already start in the top three quarters of the view, and the focused results show the Board's control focus ring instead of the browser outline.
- Each Answered row names the item its question is about, then the question's short label, your answer and the outcome on a second line. Two rows that would read the same add the request ID.
- The Fleet start command wraps, so the whole command shows on a phone.
- The sidebar and top bar show no needs-you badge at zero, like the phone's Today tab; screen readers still hear the count.
- Getting started appears on an empty Today only while the workspace has no identified documents; the inbox projection carries this as `identified`.
- The Today button for the `--home` file is named after that document's title instead of "Workspace notes". The breadcrumb root stays "Workspace".
- "How to start Fleet" shows `npx @shivaedev/work-fleet serve <folder> --port <port>` with the Board's folder relative to where it was started, so it runs where work-fleet is a project dependency.
- Plainer words on Today and System: "N marked in progress" instead of "N in progress in task files", no "Task file" badge, "Age unknown" instead of "Age ?", a plain sentence when files can't be read, "Fleet isn't set up for this Board" and System says where Pause updates lives.

### Fixed

- Long documents show their title and item header right away and render the body section by section, instead of freezing the page while the whole document renders. Deep links to a late heading still land on it once its section is in place.
- A task with an open ask for you, linked through `attention.unblocks`, sits in **Waiting on a person** and its card reads "Waiting on your answer". Asks only for agents and questions that only relate to a task leave it where it was.
- An item's header says "Needs you" only when an open ask is for you, and "Waiting on agents" when only agents can answer it, matching Now and Today.
- All work cards and the table's Kind column name a goal's kind "Goal" instead of "PROJECT" or "project".
- Native RPC handlers cover the reserved `$changes` stream required by typed contracts. Filesystem change delivery continues through the declared `work-board.subscribe` stream.

## 0.23.0 - 2026-10-19

### Added

- Quality's `manifests/exports-shape` rule checks exports at the package root and in workspace members by default. Modules use one file-preserving TypeScript wildcard with matching source, types and runtime targets; root entries, exact non-code assets, package metadata and null blocks are allowed.
- **Find documents** on Library keeps the documents whose title or ID contains every typed word, as Now's **Find work** does. `library.query` accepts the same text as an optional `query`.

### Changed

- Library keeps its text, kind, status, view and **Include files Fleet writes** choice in the URL, so Back, reload and a shared link reopen the same list. It used to reset to all documents by title.
- Library opens on Recently changed and renders the first 100 rows with a count of all matches. **Show more** adds the next 100, and Back from a document returns to the same rows.
- Library's Kind and Status filters use the same compact controls as Now.

### Breaking

- Quality's Biome preset moves from `@shivaedev/quality/biome` to `@shivaedev/quality/biome/preset.json`. Change the `extends` entry in your Biome config to the new path; the old alias is removed. TypeScript preset paths are unchanged.
- `@shivaedev/effect-pg-boss`, `@shivaedev/effect-test-sql`, `@shivaedev/local-postgres` and `@shivaedev/test-story` expose server modules at their file paths. Add `/server/` after the package name in imports, for example `@shivaedev/test-story/server/storyKit.ts`. The shortened paths are removed; internal server modules remain blocked.
- Work Board moves `@shivaedev/work-board/client/client.ts` to `@shivaedev/work-board/browserClient.ts`; change browser-client imports to that file path. `@shivaedev/work-board/client/document/View.ts` is removed: consume document queries with your own renderer, or use the bundled Board browser UI. The client bundle stays private and the old export overrides are removed.

## 0.22.0 - 2026-10-19

### Added

- `client.responses.answerQuestion` saves an answer in one command: it registers the question for the reviewed revision and records the response together.
- The item header shows when the item last changed, after its ID.
- When the file changes while the page is open and the status changes with it, the header says so, for example "Status changed: Active → In review". Screen readers announce it politely. The first load is not announced.
- An item that implements a goal links to it from the header as "Part of <goal title>".
- Header controls (the ID link, the copy button, the goal link, the PR chip, **On this page**, **Pin** and the page actions) are at least 44px tall on touch screens. The desktop header keeps its height.

### Changed

- The handoff page is titled with the item, starts the agent name as the item's owner and keeps it after saving. A done or dropped item's next step starts empty with a placeholder instead of its old `next_action`.
- **Prepare handoff** saves directly; **Preview file** is optional. When the item changed under a draft, the first **Prepare handoff** binds the draft to the new version and a second one saves it. Preparing moves focus to the prompt, and one status line reports the save and the copy. **Prepare handoff** and **Copy prompt** use neutral buttons instead of the amber one.
- Earlier handoffs show how long ago they were prepared.
- The result page names each linked item by title with its status chip and offers **Prepare follow-up handoff**, and shows how long ago the report changed. An empty review and empty checks collapse into one line, and a feedback summary with a link to the feedback sits above the report.
- Answering from Today closes the popover as soon as the server saves the answer. The row leaves Needs you at once and "Answer saved" appears beside the heading while the Board refreshes in the background. The popover says "Saving your answer…" while it waits.
- The Today popover shows the options or recommendation from the question's body in a collapsed section, and its link reads "Read the full question".
- Today and the item page use the same words: "Your answer", "Answers so far" and "More options".
- The Today popover and the item page's answer card disable their answer controls while the Board's live connection is reconnecting, and say why. A draft on the item page stays in place.
- Screen readers name the popover's answer group after the question's title instead of its IDs.
- The Board's answer forms save through `answerQuestion` instead of calling `registerQuestion` and then `recordResponse`.
- While the server reads the workspace, the loading page says how far it has got, such as "Reading 1,240 of 3,936 files…", and "Reading the workspace…" before the count is known.
- Pages start their reads as soon as the Board is live instead of waiting for the sidebar's navigation read.
- The header names its state in plain words, such as "Connecting…", "Updating…" and "Can't reach the Board server", and the Needs you badge shows a spinner while its count is still loading.
- The header no longer repeats a failure that the page already explains, and says "Couldn't refresh this page" when it keeps showing an older copy.

### Fixed

- An answer whose browser closes mid-save is still saved in full, so a registered question never lands without its response.
- An item page's status chip shows **Needs you** whenever a request on that item is open and unanswered, for every kind of item. Before, only decisions and questions did, so a task waiting on you said **Active**. Once someone answers, the chip shows **Waiting on agents**.
- Decisions and questions with no open request show **Answered** or **Closed** instead of no status.
- The item header on goal pages names the kind **Goal** instead of "project".
- **Prepare an agent handoff** is no longer offered on finished or dropped items or on goals.
- Server startup lists the workspace concurrently, which cuts listing a workspace of about 4,000 files from several seconds to under half a second.
- Wide Markdown tables stay readable. Prose columns keep a readable width instead of shrinking to a word or two per line, short columns such as IDs, statuses and numbers stay on one line, and a table wider than the page scrolls sideways in its own box. A soft shadow at the edge shows that more of the table is hidden.
- Tables in answer cards and result reports now look and behave like tables in documents.

## 0.21.6 - 2026-10-19

### Added

- The goals query returns each goal's open `asks` with a link to each answer card, and each linked item's file `modified` time and `waiting` reason.
- Search results carry a `match` field: `exact`, `prefix`, `title` or `text`.
- The empty search palette lists what needs you at the top, so Enter opens it.

### Changed

- Every time on the Board reads the same way: "just now" under a minute, relative under a week, such as "4m ago", and a short local date after, such as "Oct 13, 09:35", with the year only when it differs. This covers Today rows, Now cards, Library, the Source tab, response history, workspace notes and System, which used to mix raw ISO timestamps, UTC strings and their own relative formats.
- Times use the regular sans font. On the Source tab records, System and the document context panel, pointing at, tapping or pressing Enter on a time shows its exact date, time and time zone, so keyboard and touch readers can reach it too. In list rows a time stays plain text, so each row keeps its link as its only Tab stop.
- Fleet card stages read "Executing, started 4h ago" instead of "Executing for 4h", while queued and finished stages read "Queued 4h ago" and "Done 4h ago".
- Documents with sections keep an "On this page" outline beside the text on wide screens. It stays in view while the reader scrolls. Narrow screens show an **On this page** button in the page header that opens the outline.
- The pinned header on item and document pages shrinks to a one-line title while the reader scrolls. The text below does not move when the header shrinks.
- Item criteria render inline Markdown such as code, emphasis and links. Lists of more than three criteria, or criteria with long text, show in the main column after the body instead of in the details panel.
- `PR #123` and `PR 123` in an item's next action link to that pull request when every Fleet pull request is in one repository.
- The goal chart labels each row with its criterion text, cut to fit, and links it to that criterion's card. The "All work" row is gone, since the progress bar above already shows it.
- Counts sit on the bars, so a phone reader no longer needs the tooltip. A segment too narrow for its number leaves it to the tooltip.
- A criterion without linked work stays in the chart as an empty row that says "No linked work".
- The chart shows a focus ring when it has keyboard focus, and its labels use the foreground color in both themes.
- The chart and Recharts load only on a goal page that shows the chart, which cuts the first bundle from 1.47 MB to 1.10 MB before compression. A skeleton holds the chart's height while it loads. If the chunk cannot be fetched, the page says so and asks for a reload; progress and criteria stay readable.
- A goal page links its open asks in amber: one ask goes straight to its answer card, and several open a short list of links. Zero counts in the progress legend are muted, so amber appears only when something needs you.
- Linked work that is not done and has an open ask counts as Needs you, so the Needs you count and the open asks agree.
- Deferred work counts in the Planned table group, so each table group matches its count in the progress header.
- Criteria render as cards with a one-line count summary, and their linked items sit in a disclosure that starts closed. The Planned and Done tables also start closed, which keeps long goal pages short.
- The In progress table shows each item's owner and when it last changed.
- A goal with no linked work shows an empty state instead of zero progress and an empty Linked work section.
- Item pages show relationships in two groups, **Links to** and **Linked from**, with labels read from the item's side: Depends on and Needed by, Implements and Implemented by, Informs and Informed by, Related to. Incoming kinds such as Agent handoff and Listed on board use sentence case, and declared board items join the **Links to** group.
- Relationship links are underlined, and on touch screens each link is at least 44px tall.
- In the search palette, a row whose title or ID matches the query exactly, or starts with a query of two or more words, comes first whatever its group, including plain documents. The other groups follow their best match. An empty query keeps the fixed group order with Needs you first.
- Exact and starts-with matches rank ahead of the 40-result limit, so many work items that only mention the words can no longer push them out.
- Search results and the Library show the kind `project` as Goal, and show every kind in sentence case.
- The phone navigation's Today tab shows the same needs-you count as the sidebar, as a badge, and names it for screen readers, such as "Today, 4 need you".
- The sidebar, top bar and phone tab share one needs-you badge, in the needs-you colour when the count is above zero.
- The sidebar leaves out Active goals while Today is open, because Today already lists them.
- While a page waits for its data, the Board shows a skeleton shaped like that page (lanes, table, cards, rows or document) instead of "Opening view…" or a blank page. Sections that load on their own, such as Fleet work, linked work and folders, show row skeletons.
- Empty lists, lanes, tables, search results and sidebar sections show an empty state that says what is empty, what fills it and, where one exists, a next step such as All goals, All work, Clear filters, Show all documents or Include files Fleet writes. A workspace with no work shows one empty state instead of six empty lanes, and a filtered table with no matches no longer shows a header-only table.
- System uses plain labels: "Codex usage", "GitHub request limits", "5-hour limit", "Weekly limit", "REST API", "4321 of 5000 requests left", "Files with problems" and stage names such as "Executing" instead of raw keys.
- Library says what each control does: "By title", "By folder", "Recently changed", "Include files Fleet writes (N)", and shows kinds in plain words.
- Status chips use 12px text instead of 10px, so they read on a phone.
- The Needs you chip is solid amber with dark text in both themes, the strongest signal on the page. Every other status keeps a quiet tint, which now stays at least 4.5:1 when the row behind it is hovered or selected.

### Fixed

- While Fleet isn't ready, the Now page's Done lane shows no count and says it needs Fleet, instead of a `0` and "Nothing here" that read as nothing finished. The Fleet notice above the lanes uses the Board's one "Fleet isn't running" sentence and offers **How to start Fleet** when the daemon is stopped.
- When the Board server stops answering, a page now says "The Board server isn't answering" with a Retry button instead of showing `HttpError:`. Other read failures say the page couldn't be opened and offer Retry and System.
- The breadcrumb and browser title keep the page's name, file path or item ID when its data fails to load.
- An unknown `/_board/*` or other non-document URL shows the not-found page instead of the Templates page.
- A file or item link with invalid percent-encoding, such as `/notes/broken%E0.md`, shows the not-found page instead of crashing.
- A result link that names no single result, a handoff for a missing item and an item ID shared by two files now explain the problem in plain words, without error type names.
- Search puts an exact title or ID match first, then other title and ID matches, ahead of open work that only mentions the words. An ID also matches by its last segment, so "answer card" finds `board.answer-card`.
- Search snippets show inline Markdown as plain text and mark the searched words.
- A result list cut short at 40 asks for more words or an ID.
- On phones, the header says when updates are paused, a refresh failed or the connection is reconnecting, with an icon and a short word that screen readers announce. It stays empty while nothing is wrong.
- Items with status `dropped` count as closed: they leave Needs you and every needs-you count, and managed asks that target only dropped work resolve. One shared list of closed statuses now drives Needs you, goal progress and Now.
- Deferred goals no longer count as active. The goals query returns them in a new `deferredGoals` list, the Goals page shows them in a collapsed Deferred goals section, and Today, the sidebar and the active-goal counts leave them out. The MCP overview carries `deferredGoals` as well.
- Today's In progress falls back to the task files when Fleet is unavailable, the same way Now does. Rows say Task file, the section says the status comes from the task files and not live Fleet, and the summary reads "N in progress in task files". The `fleetItems` query carries this list as `authored` on its unavailable state.

## 0.21.5 - 2026-10-19

### Changed

- A standalone question shows its answer card after its own text, so its context reads before the answer box. The answer box grows with the answer up to most of the screen height.
- Following a link to an answer card puts focus on the first option of a choice question, or in the answer box.
- The answer card no longer shows the local author label; it records under the label the browser remembers, or `maintainer`. **More options** names the kind of reply and the choice to replace an earlier answer in plain words, and offers that choice only when an earlier answer exists.
- Markdown tables in documents use the Board's table styling, wrap at word boundaries and scroll sideways inside their own box when they are wider than the page.
- Workspace notes show the board's introduction and its heading columns as readable text in the main column, with item cards under each column and the counts and last update in the header.
- Hovering an age such as "3h" shows the exact date and time.
- Item headers lead with the title, kind and status; the item ID follows in small muted type with a button that copies it.
- A missing file or unknown item ID shows an empty state with links back to Today and the Library.
- On a Board started without `--responses`, answer cards list the question and its options as text and say "Answering is turned off on this Board." with no form controls.
- The Board compresses its scripts, stylesheet, page shell and RPC answers with Brotli or gzip when the browser accepts them.
- Content-hashed bundle chunks and Mermaid chunks are cached for a year as immutable; `react.js`, `react.css`, `theme.js` and the Mermaid entry revalidate with an ETag, so a rebuilt bundle is never served stale, and the HTML shell stays `no-store`.
- The first bundle no longer carries Markdown rendering and Shiki highlighting; they load when a page first shows Markdown, which cuts the first-load JavaScript from 1.52 MB to 1.0 MB before compression. If that chunk cannot be fetched, the page says Markdown could not be loaded and asks for a reload, while the rest of the Board keeps working.
- The HTML shell paints an outline of the header, sidebar and phone navigation in the saved theme before any script runs.
- When the Fleet daemon is not running, Today's In progress section says "Fleet isn't running, so agent work and its health are unknown." instead of a CLI hint, and System shows one Fleet card marked Not running instead of separate Codex, GitHub, Fleet and Fleet work cards. Both pages keep the exact `work-fleet serve <board> --port <port>` command, with this Board's folder and Fleet port, in a "How to start Fleet" popover. The unavailable Fleet items projection and the error diagnostics observation carry that command as an optional `startCommand`.
- The System Fleet card's state reflects only Fleet health (capacity and clock). Fleet's own waiting counts no longer mark it as needing attention, so the only needs-you number on System is the Board's count shown on Today and in the sidebar.
- The result review, agent handoff and getting-started pages now look like the rest of the Board: the shared page header, cards, badges, alerts and the Board's colours and spacing.
- These pages use plain words. A result shows its status as a status chip, its checks and evidence in a table that says "No evidence recorded" or "Not recorded" instead of leaving gaps, and a warning when some feedback can't be read.
- The handoff page links back to its item, asks for an agent name and next step, says when the Board is read-only, and labels its copy button **Copy prompt**.
- Each getting-started template has a **Copy** button, so you no longer have to select the text by hand.
- Reading history opens as a dialog with Pinned and Recent documents lists, and closes with Escape.
- A clicked sidebar or phone destination is marked current at once, and the header shows a progress bar when a page takes longer than 150 ms to open.
- Settings choose Theme (System, Light, Dark) and Density (Comfortable, Compact) with toggle groups.
- Keyboard focus shows a 3 px ring that meets 3:1 contrast against the page in light and dark themes.
- The header's sidebar button is an icon button named Sidebar, and its Today link appears only while the desktop sidebar is hidden.
- The document action to keep a document in Pinned is named Pin and Unpin.
- The phone More sheet lists pinned and recent documents and opens reading history.
- Inspecting an image or diagram opens the shared stock dialog, which Escape and Close dismiss back to the source.
- Today's Needs you rows drop the item ID, which the item page still shows. Each row has one primary button: **Answer** opens a popover with the request's options or a text answer and an **Open question** link, and **Open** links to the item page when a request can't be answered inline. On a phone the reason gets its own full-width line.
- Needs you reasons read as plain sentences. Fleet decisions start with "Fleet asks:" and their question, and a person's note drops the raw `owner:` and status prefixes.
- The Today popover says "Answering is turned off on this Board." when the Board runs without `--responses`.
- The Table view is a sortable data table: click a column header to sort by it, click again to reverse, and each row is headed by a link to the item with its ID underneath. Saved views keep the sort direction.
- All work and Table share one toolbar with a search box and Status, Owner, Board and Sort menus, plus a Reset link while a filter applies.
- All work heads each status group with a count badge.
- Now lanes mark empty lanes, keep Done collapsed until opened, show Fleet outages in one notice, and on a phone show one lane at a time behind lane tabs. Long card lists now scroll inside their lane instead of leaving blank space.
- The sidebar's Now count is the number of open cards on the Now page: queued, executing, reviewing, delivering and waiting work, using Fleet stages when Fleet is available.
- Done in the last 7 days sits under the lanes as a one-line disclosure.
- The work page heading names the selected view: Now, All work or Table.
- Filter links drop empty parameters, so shared URLs stay short.

### Fixed

- effect-contract's `live` coordinator no longer reconciles its read scope when `paused` is read for the first time; a component that showed the pause state while connecting used to make every loaded query read again.
- Opening a Board page sends each read once. The page starts its reads after the live connection's first update, which used to read navigation and watcher state a second time, and a failed connection does not hold the page.
- A file event that changes neither the bytes nor the modification time no longer refreshes open Board pages. A file saved with the same bytes and a new modification time still refreshes them.
- When a question closes while you write, its answer card stays with your unsent draft read-only, a **Copy draft** button and what closed it, instead of disappearing.

## 0.21.4 - 2026-10-19

### Changed

- Goal cards, the sidebar and Today show goal progress on the stock shadcn progress bar, and goal cards align at the top instead of stretching to the tallest card.
- The goal page charts linked work by state, overall and per criterion, with a stacked bar chart next to written counts.
- Linked work on a goal page is a table with Work, Criteria, State and PR columns, and each whole row links to its item.
- The goals query and the MCP goal summary report a `needs you` count beside `done`, `in progress` and `planned`.

### Fixed

- Goal progress counts dropped work as done and ready work as planned, so ready items no longer inflate the in-progress count.
- Linked work that Fleet holds for a person counts as "needs you" in goal progress and gets its own group on the goal page, instead of reading as in progress.

## 0.21.3 - 2026-10-19

### Changed

- The search palette groups rows under **Go to**, **Appearance**, **Work** and **Documents** headings and drops the "command" subtitle from command rows.
- **Include Fleet records** in the palette sets the new optional `records` search option; the `records:` query prefix keeps working.
- The palette closes through the dialog's standard close control. The Search button is gone: Enter in the field still searches an unfinished query at once, and a failed search offers **Retry search**.

### Fixed

- Sidebar destinations, the Now / All work / Table switch and answer card links are announced as links instead of buttons, and the All work board shows one column per status name, so items spelled `needs-you` and `needs-human` share one Needs you column.
- Search lists each item once: a document's title and the passages under it now share the document's row instead of adding a second row for the title anchor.
- Search rows no longer repeat their title as the snippet; they show the next matching passage instead, or no snippet.

## 0.21.2 - 2026-10-19

### Changed

- Release with updated workspace dependencies.

## 0.21.1 - 2026-10-19

### Changed

- Release with updated workspace dependencies.

## 0.21.0 - 2026-10-18

### Added

- Board task metadata accepts a nonempty `sweep` list of repository-relative path globs, including `['*']` for all paths.
- Fleet carries sweep paths in `BoardWork` and durable Fleet records. Sweeps block new implementers, hold matching reviewed PRs on automation, prioritize their own repairs, and send held PRs through one migration repair with the sweep brief after merging.
- PostgreSQL admission also guards merge readiness. `StorageAdmission` can carry an exact-head sweep hold, so a sweep launching during a readiness observation records a durable hold before any ready decision can publish.

## 0.20.3 - 2026-10-18

### Changed

- Release with updated workspace dependencies.

## 0.20.2 - 2026-10-18

### Changed

- Release with updated workspace dependencies.

## 0.20.1 - 2026-10-18

### Changed

- The Board's top bar stays in place while the page scrolls, and anchored sections land below it.
- Every page opens with the same header: title, an optional summary line and its actions. Item pages share the other pages' padding, and their actions look like buttons: Save favorite, Clear selections and Change your answer are buttons, while actions that open another page, such as Prepare an agent handoff, stay links for screen readers. The top bar's Today link is a link too. `DocumentView` accepts an `actions` slot for the title row.

## 0.20.0 - 2026-10-18

### Added

- The Today summary row ends with how many workspace sources have problems, linking to a new Source problems section on System, which lists each problem's file, line and reason.

### Changed

- Answer cards use the stock shadcn RadioGroup for single-choice questions and the stock Checkbox for multi-choice questions. Arrow keys move and select within a single-choice question, which is one Tab stop, and Space toggles a multi-choice option. Labels, descriptions, the recommended option and the recorded answers are unchanged.
- Today's Needs you, Answered and Later rows no longer repeat their section's state in a status chip; each row keeps its ID, age and Answer control.
- Status chips on Now, goal and item pages, search results, the All work status filter and the Library's rows and status filter show plain words such as "Needs you", "Blocked" or "In progress" instead of raw values like `needs-you`.
- The Library and All work status filters offer one option per plain name, matching every status that shares it, so **Needs you** lists both `needs-you` and `needs-human` items. `client.api.library.query({ status })` matches the same way and returns one entry per name in `statuses`.

### Fixed

- Opening the Board shows its header, sidebar and an "Opening view…" state at once instead of a blank page while the workspace is still being indexed.
- The live status reads "connecting" before the first live update, instead of a red "reconnecting".
- The Board starts indexing the workspace as soon as it starts and reads files concurrently, so the first page after a start waits less for its data.

## 0.19.0 - 2026-10-18

### Added

- An answered Fleet decision that Fleet has not acknowledged yet leaves Needs you for an **Answered, waiting for Fleet** group on Today and moves its task to Queued on Now. Its answer card and Now card say who answered and what, for example "You answered: Request changes. Fleet picks this up on its next pass.", and say "Fleet isn't running. It picks this up when it starts again." while Fleet is unavailable. **Change your answer** supersedes the current answer. The attention projection carries these rows as `answered`, and inbox rows, work items and document requests carry an `answered` summary.
- Export `DaemonReadContract` from `diagnostics/daemonContract.ts`, accepting unknown diagnostics payloads while retaining the typed Fleet items query for independent source validation.
- `work-board responses --follow <dir>` streams responses across all questions as tab-separated item, request, response ID and first answer line. It starts with new responses; `--since <ISO timestamp>` includes recorded history from that time.
- `responseFeed(root, since?)` from `server/responses/feed.ts` exposes the same lines as an Effect Stream using the workspace filesystem services.

### Changed

- Now cards say who holds the work in plain words, such as "Fleet is working on this", "Needs you" or "Assigned to you", and how long it has been in its stage, such as "Executing for 4h". Task cards no longer repeat the word "task".
- Now lanes share the page width and scroll inside their own container when the window is too narrow.
- System shows the same "Needs you" count as Today, by Today's rule, in place of Fleet's own "Waiting on maintainer" count. Inbox count badges and the Today links name that count "need you".
- A Fleet decision shows the Board work it reviewed as the work's title, criteria and description instead of its raw front matter.
- The Library filters are stock shadcn controls: Kind and Status are Selects, View is a toggle group and the Fleet records switch is a Checkbox, with the same URL state as before.
- The search palette is a stock Command inside a stock Dialog, with the same debounce, keyboard selection and Enter behaviour as before.
- The Board's buttons, badges, cards, popovers, tabs, the phone More sheet and the answer form's text, label, input and select controls are now stock shadcn/ui components in the base-mira style on Base UI, so the settings and Today answer popovers, the item context tabs and the phone sheet get Base UI focus handling, dismissal and keyboard support.
- The Board uses the Amber Watch theme: graphite surfaces with an amber accent in light and dark, and the Geist and Geist Mono fonts, which ship with the Board instead of loading from the web.

### Fixed

- Response history and the saved-answer messages show the authored option labels instead of "Option 1".
- Keep System usable when a Fleet daemon diagnostics source has an incompatible shape: show that source's decode error while retaining valid Codex usage, GitHub limits and Fleet health observations.
- Today says "Fleet unavailable" instead of "? in progress" when the Fleet daemon cannot be reached, and names loading or unavailable counts instead of showing "?".
- Sidebar destinations carry explicit accessible names that include their counts.

## 0.18.0 - 2026-10-18

### Fixed

- Notify live clients and report that watching stopped when an outside process removes the workspace root, including when the filesystem emits no descendant file events.
- Keep live updates active when delayed directory notifications arrive without a change to the watched roots, and name the edited, added and removed Markdown files when a populated directory moves or its contents change without individual file notifications.
- Keep reads available after unchanged directory notifications, including directory names with Markdown or image extensions.
- Saving an answer on Today could be interrupted before the response was recorded.

### Breaking

- Every module's import path is now its path under `src/`, through one `./*.ts` export. Modules that lived under `src/server/` gain a `server/` prefix, for example `@shivaedev/work-board/server/board.ts`, `server/serve.ts` and `server/integration/board.ts`. The browser client moves from `browser/client.ts` to `client/client.ts`, `browser/document/View.ts` moves to `client/document/View.ts`, and `browser/navigation/schema.ts` moves to `browser/Navigation.ts`. The other remapped paths, such as `page/escape.ts`, are gone; import the defining module instead.

## 0.17.1 - 2026-10-18

### Changed

- Answer cards lead with what happened and the recommendation, show each option as a selectable card with what it does, and confirm the recorded choice by name.
- The Today answer popover shows the reason, the question and each option's effect before you choose.
- Recorded responses show who chose which option and their note, with the full Markdown behind a toggle.
- Today keeps `status: deferred` items out of Needs you and lists the ones that would otherwise need you in a collapsed Later section with their count and next action. The attention projection exposes them as `later`; deferred stays an open status everywhere else.

### Fixed

- Answer options written as `**Label** — description` show that label on the option card, in the Today popover and in recorded responses, instead of a name made from the option id.
- A managed decision leaves Today once every receipt for its question is valid, so an applied receipt followed by a superseded one no longer keeps an answered decision under Needs you. When only some of several receipts are valid, Today shows the request with a problem naming the receipt files instead of offering an answer.

## 0.17.0 - 2026-10-18

### Changed

- Work Board serves its browser client in `/_board/react.js`; `/_board/native.js` is no longer served.

### Fixed

- Answer links open the item’s answer card directly. Existing `/_board/respond` links retain the server redirect.
- Fleet items declares `InternalServerError` for unexpected index defects instead of returning an unavailable projection. Typed index failures still report unavailable documents.

### Breaking

- Remove the `work-board.respond` query from `workContract` / `workRpcs` and the browser client API, and remove `RespondProjection`. Read the item document or use the response `question` query instead.
- Remove the repository-only `NATIVE_ROUTE`, `nativeAsset` and `checkNativeAsset` exports from `http/assets.ts`.
- Replace `responses.ResponseConfig` and the `ResponseOptions` type in `integration/responses.ts` with `responses.Workspace`, `responses.WorkspaceConfig` and `WorkspaceOptions`. Provide `Workspace.layer` to `Responses.layer`, configured with the root, watcher, typed index, optional home and explicit `writable` choice.
- Workspace-backed server helpers now require the declared workspace service: `boardServices` composes services and handlers, `handlers` accepts only transport options, `projectionQueries` and `remainingQueries` are Effects that read the workspace, `hints()` reads it directly, and `fleetItems` accepts only the daemon port. `readDocument` takes workspace settings and a snapshot instead of `DocumentOptions`; `ResponseConfig` and `ResponseOptions` are removed; import `Responses` through `integration/responses.ts` instead of the removed `responses/service.ts` module. `readingActions` accepts the question locator directly.

## 0.16.0 - 2026-10-18

### Breaking

- Rename `@shivaedev/work-board/render/failed.ts` to `@shivaedev/work-board/render/Failed.ts` and `@shivaedev/work-board/render/footnotes.ts` to `@shivaedev/work-board/render/footnoteIds.ts`. Import `RenderFailed` and `footnoteIds` from their new module paths.

## 0.15.0 - 2026-10-17

### Added

- Browser clients expose their AtomRpc runtime for typed form commands.

### Changed

- The diagnostics contract declares a typed `ServiceUnavailable` rejection for `daemon.fleetItems`, so Board returns an unavailable Fleet items projection with a reason when the daemon rejects the read.
- Board treats a `fleet-priority` frontmatter field as Fleet-owned, like `fleet-launch` and `fleet-deliverable`, so a task carrying it reads without an unknown-field diagnostic and keeps the field in its source.

### Fixed

- Answer and handoff forms retain typed save rejections and use the current session client after page restoration, keeping drafts and retry identities intact.
- System shows the GitHub rate limits Fleet recorded from its own responses, one row per resource with its observation age and any active rate-limit wait or pause below Fleet's 20% reserve, instead of reading `/rate_limit` itself.

### Breaking

- `GithubLimits` is an array of per-resource observations (`limit`, `remaining`, `used`, `reset`, `resource`, `observedAt`, `limitedUntil`, `limitedBy`), and `FleetHealth` gains an optional `github` field carrying them. `githubLimits(fleet)` reads them from a Fleet health source instead of running `gh api rate_limit`. Release together with `@shivaedev/work-fleet`.

## 0.14.2 - 2026-10-17

### Fixed

- Uses Platform 0.14.1 for the exported trace URL redaction security fix.

## 0.14.1 - 2026-10-17

### Fixed

- Align published Platform and contract dependencies with the current framework releases.

## 0.14.0 - 2026-10-16

### Added

- The typed Inbox query and headless `attention.projection(snapshot)` expose `you`, `agents`, `resolved` and `parked` lanes, with audience labels and separate source diagnostics.
- `work-board mcp <dir>` serves the read-only `board_overview`, `needs_you` and `item` tools over stdio using Effect's MCP server. Tools query the running board's Unix socket for the same computed state as the browser and explain how to start a board when none answers.
- Serve the same NDJSON RPC over `<dir>/board.sock` alongside the browser's TCP listener. Each directory has its own socket with owner-only access from creation; serialized startup replaces stale sockets and refuses a live or starting board, and shutdown removes the socket, including SIGINT and SIGTERM. Private bind paths use no more pathname bytes than the public socket path.
- Add the `work-board.server` query returning `{ url, directory }` with the board's browser URL and absolute board directory on both transports. Export its `Server` schema from `@shivaedev/work-board/rpc/Server.ts`.
- The typed `fleetItems` Board query reads current Fleet stages, waiting owners, PR URLs and persisted times through the Diagnostics daemon client, joins unique Board documents by ID, and returns `unavailable` with a reason for failed reads or a disabled (`fleetPort: null`) daemon. The shared `DiagnosticsContract` adds `daemon.fleetItems`, backed by `FleetItem`, `CompletedFleetItem` and `FleetItems` schemas. `FleetStage` and `FleetTimestamp` are also available through the diagnostics integration. Legacy stage entry and completion times remain unknown until an observed transition.
- `FleetItemsProjection` describes the Board result. The shared `readDaemon(port, read)` transport and `daemonUnavailableReason(error, port)` explanation are available from `diagnostics/daemon.ts`.
- The typed `goals` query returns open projects with counts of linked work by authored status, criterion-level work and recorded evidence counts, and open ask counts. Missing statuses stay not recorded and unlinked goals are explicit; progress has no computed completion percentage or overall success flag.
- Project pages open with the goals query's done, in progress and planned counts and Inbox-aligned open-ask count before answer cards, followed by criteria with progress, linked work and recorded evidence before authored Markdown. Empty work groups, untargeted criteria labels and absent evidence stay quiet. Each work row has one held Fleet stage or authored status chip; missing status and PR stay blank.
- The document query's optional `referenceDetails` record supplies each resolved reference's title and recorded status alongside the existing reference URLs.
- Recognize `goal` and `report` item kinds in frontmatter and the portable metadata schema.
- Document reading-context backlinks include optional `title` and `status` fields for consumers that render source references.
- The command palette offers navigation to Today, Goals, Now, Library, System and active goals alongside appearance commands. Search results show item IDs, kinds and status chips.

### Changed

- Open requests show an answer card directly below the item header, using the existing response form and retained drafts. The separate respond link opens and focuses that card.
- Managed decisions use the unblocked item's title, render their reason as Markdown, and show the complete question once, including unfenced multi-paragraph reasons. Page and card headings name the unblocked item. Generated identities stay in Source instead of the item header.
- Decisions can use frontmatter options and a recommended choice. Answer cards lead with the recommendation and relevant PR actions, and directive choices use human labels. Decision and question headers show request state and omit missing fields. Response validation waits for an attempt, with the last saved local author label prefilled.
- Typed document requests include optional `title` and `sourceOpen` fields; `DocumentViewProps` accepts an optional `answer` node below the header.
- `documentHtml` accepts optional answer-card HTML, and `composerHtml` accepts an optional card title.
- Open requests also show their answer cards under the headers of the items they unblock, preserving the request's reviewed source and choices.
- Answer cards record with one action and keep author labels, draft tools and response details under More. Read-only cards show one line explaining how to enable answers.
- The workspace has five views: Today, Goals, Now, Library and System. Retired destinations redirect to their current view; System lists running and waiting Fleet items by title, stage and PR beside provider limits.
- Browser pages use Tailwind and shared React primitives and require JavaScript.
- Goal and criterion `counts` now always contain `done`, `"in progress"` and `planned`, including zeros. Held Fleet stages override authored status; released stages fall back to authored status. Deferred and unrecorded work count as planned. `goals(snapshot, fleet?)` accepts an optional Fleet projection. Internal Inbox rows retain their `unblocks` targets for goal-specific counts; browser Inbox projections keep their existing shape.
- Goals shows compact progress cards with next actions, positive open-ask counts and single-line done/total rows for linked criteria. Zero-count metadata stays quiet, and closed goals sit in one collapsed section.
- Identified documents open with a sticky title, kind icon, status, owner, next action and header actions. Known Fleet items show their execution stage and PR link. Criteria, target titles and statuses, and backlinks grouped by kind appear in an open responsive rail; source location and raw frontmatter have a Source tab. Markdown uses a 68ch reading column with 16px prose.
- Use a neutral light and dark Board shell, shared status chips with icons and semantic colours, and a single header settings popover for theme, density and live-update preferences.
- Open Work on a Now board with fixed Fleet stage lanes, tasks only, one Fleet-derived state chip, and holder, PR and time in stage only when known. Disclose authored-status fallback when Fleet is unavailable; keep All work and Table as explicit choices. Queue Fleet-prepared or authored approved waiting tasks, use authored status only without a matching Fleet item, and collapse saved views and filters behind Filter on Now.
- Exclude decision, question, response, result and request receipt records from Work lists. Keep status column order independent of row sorting and virtualize lists over 200 rows in bounded scrolling containers.
- Keep Today, Goals, Now and Search in a bottom phone navigation bar, with Library and System in a More sheet. Use a compact sticky phone header and omit keyboard hints on touch devices.
- Replace the sidebar file tree with counted destinations, pinned documents, active goal status bars and five recent documents. Browse document titles, kind/status filters, lazy folders and modification order in Library; generated Fleet records stay hidden until requested.
- Open on Today with human asks, compact ask rows with option answers in popovers, compact goal progress with next actions clamped to two lines and collapsed criteria, and up to eight Fleet-held items with their stages and PR links. Keep configured home Markdown reachable as Workspace notes.

### Fixed

- Inbox, Overview and navigation badges share the maintainer lane count. Open requests for other labels remain visible under Waiting on agents, including requests without a registered question. Invalid managed requests remain source diagnostics rather than counted asks.
- Share the navigation query between route loaders and the React shell instead of requesting the workspace tree again for each selected file. Document navigation shows the new document or a loading message as the URL changes, and returning before a read completes cannot display that late result over the returned page or overwrite its saved reading details.
- Opening unchanged indexed documents reuses their parsed metadata and workspace model. Backlinks are resolved once per model instead of scanning every document's links on each open; the selected source is still read to detect edits before watcher notification.
- Inbox and navigation counts reuse revision-scoped question, response and receipt indexes, instead of validating every response again for every question and document request. Source changes refresh those indexes and counts while preserving ambiguous and malformed history outcomes.
- Goal criteria and linked-work tables include every identified implementing item, including results, decisions, questions and responses. The goals query returns these items alongside its counts, including links to closed projects.
- Completed and closed project pages show query-derived progress bars and criterion counts. The goals query adds `closedGoals` with the same fields as active `goals`; active-goal navigation remains filtered to open projects.
- Keep managed asks for closed or deferred target work in collapsed Inbox groups, group repeated active managed or registered asks by target item, and count only main-list rows in the Inbox badges without editing sources.
- Add `resolved` and `parked` arrays and per-row `earlierAsks` to the Inbox query projection.
- Criterion and recorded-evidence passage links leave their targets visible below the sticky item header.
- Item backlinks show source titles and status, with file locations in tooltips. Criteria use one recorded-evidence count instead of repeating missing-evidence notices.
- Source diagnostics recognize Fleet-owned frontmatter fields while continuing to report unowned fields.
- Item links open the same document with or without a trailing slash on direct loads and in-app navigation, including IDs ending in `.md` and IDs that collide with a Markdown file path. Item URLs select identities rather than colliding files; unknown IDs show an explicit missing-item message.
- Keep Files and Inbox controls named for assistive technology when their visible labels are hidden on narrow screens.
- Print documents at full width when the Files sidebar is open.
- Recognize planned, active and received statuses with neutral, working and recorded-response icons.
- Restore the theme before the first paint and apply its background to the page root as well as the body.
- Let every available Fleet stage decide the task lane despite inactive authored statuses, including prepared and human-waiting work. Keep Done limited to known completions in the last seven days.
- Keep approved waiting tasks queued when Fleet addon fields are recognized without diagnostics.
- Missing authored values stay blank across reading and work views, including PR links in System’s Fleet work. Provenance explanations use tooltips or Source records in the React views. Attention-request passage links reveal the Source tab before scrolling and focusing the record, including direct, search, same-document and Back navigation. Repeated source titles expand from one counted line, and each backlink source appears under its most specific kind.
- Managed answer cards use the Inbox’s active request eligibility. Answer cards and needs-you summary chips stay hidden on closed work, even when a question retains an explicit open attention request.
- Sidebar goal bars name their done count for assistive technology and hover; only Today and Now show navigation counts. Now lanes keep equal widths and single-line headers. Today’s in-progress work follows its human asks without a gap from the goals column, and one open ask uses the singular.
- Track Today health through its Inbox, Goals and Fleet queries, and retry failed reads when reopening Today.
- Search ranks items before headings and passages, open work before closed and deferred work, then title and ID matches before body matches and recently changed sources before older ones. Fleet records, including `fleet/status.md` and `responses/fleet-report.*`, require `records:`. Snippets omit structured metadata, each anchor appears once, and rows without a recorded status omit the status chip.
- With `records:`, Fleet and ordinary item results share the same status, relevance and recency ordering before every heading and passage hit, including when only the item's body matches. Matching go-to commands replace item results with the same destination.

### Breaking

- Removed the browser-local comparison API: `workContract.queries.history`, `workContract.queries.overview`, `HistoryInput`, `HistoryOutput`, `OverviewProjection` and the `history/` entry points. The `page/board.ts` and `page/document.ts` server HTML entry points are removed.
- `page/shell.ts` now exports `shell(title, workspace)` for the React bootstrap only. Removed the superseded server rendering and style exports listed below:
  - `history/schema.ts`: `Baseline`, `HistoryInput`, `HistoryComparison`, `HistoryOutput`.
  - `server/attention/inboxHtml.ts`: `inboxHtml`, `inboxStyle`.
  - `server/attention/overviewHtml.ts`: `overviewHtml`.
  - `server/attention/style.ts`: `attentionStyle`.
  - `server/diagnostics/style.ts`: `diagnosticsStyle`.
  - `server/document/answerCardsHtml.ts`: `answerCardsHtml`.
  - `server/history/baseline.ts`: `readBaseline`, `observeBaseline`.
  - `server/history/compare.ts`: `SourceChange`, `compareHistory`.
  - `server/history/documents.ts`: `HistoryDocument`, `historyDocuments`, `historyIdentities`.
  - `server/history/fields.ts`: `historyFields`.
  - `server/history/html.ts`: `historyHtml`.
  - `server/history/limits.ts`: `MAX_BYTES`, `MAX_AGE`.
  - `server/history/response.ts`: `historyResponse`.
  - `server/http/inbox.ts`: `inbox`.
  - `server/http/overview.ts`: `overview`.
  - `server/http/work.ts`: `work`.
  - `server/page/attentionDetails.ts`: `attentionDetails`.
  - `server/page/backlinksHtml.ts`: `backlinksHtml`.
  - `server/page/boardHtml.ts`: `boardHtml`.
  - `server/page/criteriaEvidence.ts`: `criteriaEvidence`.
  - `server/page/documentHtml.ts`: `documentHtml`.
  - `server/page/itemIntroduction.ts`: `itemIntroduction`.
  - `server/page/itemStyles.ts`: `itemStyles`.
  - `server/page/metadata.ts`: `metadataHtml`, `metadataStyles`.
  - `server/page/metadataDetails.ts`: `metadataDetails`.
  - `server/page/metadataLinks.ts`: `referenceHtml`, `sourceHtml`, `documentReference`, `valueHtml`.
  - `server/page/nav.ts`: `navHtml`, `inboxCount`.
  - `server/page/readingStyles.ts`: `readingStyles`.
  - `server/page/readingTools.ts`: `readingTools`.
  - `server/page/recordedEvidence.ts`: `recordedEvidence`.
  - `server/page/searchDialog.ts`: `searchDialog`, `searchStyles`.
  - `server/page/style.ts`: `style`.
  - `server/page/updated.ts`: `updated`.
  - `server/page/visualDialog.ts`: `visualDialog`, `visualStyles`.
  - `server/page/workspaceStyles.ts`: `layout`, `theme`.
  - `server/responses/authoredQuestionHtml.ts`: `authoredQuestionHtml`.
  - `server/responses/composerHtml.ts`: `composerHtml`.
  - `server/responses/optionControls.ts`: `optionControls`.
  - `server/responses/templateHtml.ts`: `templateHtml`.
  - `server/views/tools.ts`: `viewTools`.
  - `server/views/workCards.ts`: `workCards`.
  - `server/views/workControls.ts`: `workControls`.
  - `server/views/workDetail.ts`: `workDetail`.
  - `server/views/workHtml.ts`: `workHtml`.
  - `server/views/workListStyle.ts`: `workListStyle`.
  - `server/views/workStyle.ts`: `workStyle`.
  - `server/views/workTable.ts`: `workTable`.
  - `browser/navigation/html.ts`: `navigationHtml`.
  - `server/responses/historyHtml.ts`: `historyHtml`.
- The navigation query returns destination counts instead of `tree` and `records`; `NavigationFile` and `NavigationFolder` schemas are removed. The `Navigation` import at `browser/navigation/schema.ts` remains available. The Library query provides filtered documents and immediate folder children on demand.

## 0.13.0 - 2026-10-13

### Added

- Native `workContract` projection queries: `board` and `work` take `{ url }`; `overview` and `inbox` take no payload. Their typed results carry source data, validated membership and explicit unavailable states, without page HTML.
- Portable `BoardProjection`, `WorkProjection`, `OverviewProjection` and `InboxProjection` schemas and types in `browser/views/schema.ts`, with shared `State`, `stateOf`, `viewUrl` and `fieldFilter` exports in `browser/views/state.ts`. The existing server URL-state exports remain compatible.
- `DocumentView` accepts optional `board` section counts to render source Markdown as a heading board with the shared reading plugins.

### Changed

- Draw `mermaid` diagrams with Mermaid 12. Flowchart, state, class, entity-relationship and requirement diagrams that set no `layout` now lay out with ELK in Mermaid's `neo` look, so existing diagrams can change shape and gain shadows.
- Drawing diagrams now needs an ES2024 browser, such as Safari 17.4 or later.
- Navigation chrome, search, reading preferences, favorites, recents and reading history run in the React client with the shared native query registry.
- Changes, Diagnostics, Start, Respond, Handoff and Result render typed Board queries in React. Their URLs load the React shell and require JavaScript; live updates and contextual forms retain their shared native client.
- Board RPC adds `start`, `diagnostics`, `respond`, `handoff` and `result` queries. History responses add a typed `comparison` with source changes and identity limitations.
- The configured home board, Work board/table with filters and selected detail, Overview and Inbox render in React from projection queries. Existing URLs, saved local views, inline answers and live updates use the shared query registry. Home reads retain targeted invalidation and change highlighting; visual previews refresh and diagram drawings return with Back navigation.

### Fixed

- Response drafts use effect-form persistence and retain input across reloads and source revisions. Questionnaire recovery keeps one snapshot per prior context, so repeated remounts retain answers without growing the draft. Response and handoff drafts now expire after seven days with a 256 KiB limit per draft; Clear draft restores only the current form.
- Retain response and handoff draft text, source-change notices and caret selection through query refresh and reload in React-owned forms.
- Back navigation and reload report a missing saved passage after restoring reading state, without changing the restored scroll or focus.
- Search retains its query across dismissal and reopening, and keyboard dismissal restores the original control's focus and text selection.
- Search passages that share a heading URL remain distinct when refreshed results remove or reorder entries.
- Search keeps a valid keyboard selection when refreshed results shrink, so Enter opens the remaining selected result.
- Editing a search query immediately clears previous options, so Enter before the debounce completes cannot open an old result or command.
- A successful document refresh clears the previous navigation failure without resetting the current reading position or focus.
- Opening the current projection URL uses its typed query, including when retrying a failed view. Overview and Inbox keep their payload-free calls.

### Breaking

- Requires stable Effect 4.0.4 in place of 4.0.0-rc.112. Effect 4.0.4 moves the former `effect/unstable/*` modules to `effect/*` and renames constructors such as `Config.string` to `Config.String`. Install `@effect/platform-node` and `@effect/platform-node-shared` 4.0.4 alongside it.
- Removed `listenOn` from `@shivaedev/work-board/serve.ts` and the `server` and `ServerOptions` exports from `@shivaedev/work-board/rpc/server.ts`. Use `serveBoard` from `@shivaedev/work-board/serve.ts` to run the loopback Board HTTP and RPC server through Platform's `appHost`; the port, routes and CLI flags stay the same.
- Remove the legacy string-script browser runtime and its HTTP asset routes. Remove these package exports and their modules: `diagnostics/script.ts`, `history/script.ts`, `page/sidebarScript.ts`, `page/searchResultsScript.ts`, `page/swap.ts`, `page/visualViewport.ts`, `page/stateScript.ts`, `page/searchScript.ts`, `page/visualScript.ts`, `page/itemContextScript.ts`, `page/libraryScript.ts`, `page/ageScript.ts`, `page/navigationScript.ts`, `page/readingStateScript.ts`, `page/formReadingScript.ts`, `page/diagrams.ts`, `page/client.ts`, `views/savedScript.ts`. Use the Board React client and native browser client instead.
- Remove the Board HTML `page` RPC and the superseded server renderers for these views. Read documents with `document` and returned-result data with `result`.

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
