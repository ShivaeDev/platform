# Workspace browser acceptance

Use the production page with the shared 50-document, 100-item fixture. Happy DOM
regressions cover preference handling and live rendering with a Mermaid stub;
these checks cover layout, keyboard interaction, and the actual Mermaid package.
Run them when shell, styling, navigation, or diagram rendering changes.

From the repository root, after installing dependencies and building packages:

```sh
node --conditions=source --input-type=module <<'JS'
import { folder, startBoard } from './packages/work-board/src/test-support/board.ts';
import { workspaceFixture } from './packages/work-board/src/test-support/workspaceFixture.ts';
const notes = folder(workspaceFixture());
const board = await startBoard(notes.root, 'board.md');
console.log(`Open ${board.url}\nEdit files in ${notes.root}`);
process.on('SIGINT', async () => {
  await board.stop();
  notes.remove();
  process.exit(0);
});
await new Promise(() => {});
JS
```

Open the printed URL in a real browser. Record the browser/version, viewport,
actual results, and any limitations in the PR. Stop with Ctrl-C after review.

1. At 1440 × 1000, verify the board has multiple columns. Expand `notes/` and
   scroll its 49 entries independently of the board. The document content stays
   reachable; the navigation does not become a wall above it.
2. Reload, press Tab, then Enter on **Skip to content**. Focus moves to the main
   content. Tab through Files, Theme, Density, folder summaries, and file links;
   focus must be visible. Open a nested document and check its file location.
3. Select Dark and Compact, collapse Files, then reload and open another file.
   All three choices persist. Select Light with the operating system in dark
   mode; code colors and diagrams follow Light. Return to System and switch the
   system scheme; diagrams redraw. Changing density alone must not redraw them.
4. Open `notes/flow & details.md`. Wait for the real diagram and open Review
   notes. Append a paragraph to that file in the printed fixture folder. The
   paragraph appears, details stay open, and the unchanged diagram stays drawn.
5. In a fresh browser context at 390 × 844, verify Files starts collapsed,
   the board uses one column, and the page does not scroll horizontally. Open
   Files: its height stays bounded and its list scrolls. Close it and open a
   document. Also check at 200% zoom.
6. Disable JavaScript and reload. Content and navigation remain readable. With
   browser storage blocked, enable JavaScript and change appearance: controls
   work and explain that choices apply only to the current page.

The fixture includes duplicate headings, a missing link, long prose, an encoded
filename, a diagram, details, and malformed example metadata. The additional
`identityFixture()` supplies richer items, explicit references, and recorded claims.
Performance timings from this fixture are observations, not established budgets
or proof of the north star's usability targets.

## Document navigation acceptance — step 02

1. In a document, open **On this page** and follow the second Evidence heading.
   Its hash and focused heading differ from the first. Copy a heading passage
   link, open it in a new tab, and verify the target. Check a Unicode heading too.
2. Designate a home file in a nested folder. Serve it at `/` and follow a relative
   Markdown link to a sibling or parent folder. Repeat with encoded `#`, `?`,
   spaces, and `&` in a filename. Ctrl/Cmd-click should open a separate tab.
3. Select text, open a content details block, and scroll down. Open another
   document, then use Back and Forward. Selection, details, and scroll restore.
   Reload the returned document and check tab-scoped reading state. Repeat after
   changing the theme on the other page; a cached diagram uses the current theme.
4. Save a favorite, visit several documents, reload, and use the sidebar lists.
   Recents are unique and bounded. A second workspace must not inherit the first
   one's favorites. Block browser storage: controls work and display the notice.
5. Delete a favorite's source file while another page is open. Its sidebar link
   remains visible with a missing label; following it explains the missing file.
   Remove a heading after copying its URL and check the missing-passage notice.
6. Hold a page response in the browser's network tools, navigate elsewhere, then
   release it. The old response must not replace the new page. Simulate a failed
   navigation, restore network access, and retry the same link. Recheck desktop,
   mobile, keyboard, no-JavaScript rendering, and live updates of the active title.

## Workspace search acceptance — step 03

1. Open Search with Ctrl/Cmd+K. Search `project note`, a document filename,
   `Evidence`, and a phrase from a card. Check the result types, snippets, count,
   and 40-result limit. A nonexistent phrase must show an empty state.
2. Search the text under a second duplicate heading in an encoded filename.
   Use arrows then Enter; the result opens the correct heading. Escape restores
   focus to the control that opened the dialog. Check the focus trap, dark theme,
   and dialog/results scrolling at 390 × 844 without horizontal overflow.
3. With the dialog open, edit/add/delete a Markdown file in the fixture folder.
   Results must update. Drop and reconnect the event stream; results reconcile.
4. Hold an earlier search response, type a different query, then release it.
   The older results must not replace the newer query. Fail a request and use
   Search to retry. Unreadable files must disclose incomplete results.
5. Clear the query and use workspace/sidebar/density/theme commands. Confirm
   native modified clicks on file results still open another tab. With JavaScript
   disabled, Search is disabled and documents remain readable.

Search observations from a named machine may be recorded as a baseline; they are
not an agreed performance budget or usability proof. Source-in-editor links
remain deferred until a local editor mechanism is agreed.

## Optional identity acceptance — step 04

Add `identityFixture()` from `src/test-support/identityFixture.ts` to the large fixture.

1. Open the legacy board: its 100 cards remain unchanged. Search an explicit ID,
   owner, and criterion phrase. Check source line labels, then use Enter to open
   an item/criterion. Criteria expand work details and receive keyboard focus,
   including when searching within the already active item.
2. Inspect work details, relationship/source links, and original frontmatter.
   Missing fields say Not recorded. Evidence shows recorded revision/time/method
   and outcome with an explicit notice that the claim is not independently verified.
3. Open content details and select prose. Rename the source file while its stable
   item URL is open; details, selection, and location remain. Edit the heading;
   its title updates. Navigate to its decision and use Back to restore details.
4. Add a duplicate ID; the active item must become a conflict explanation with
   source choices. Remove the duplicate and recover. Delete the remaining source;
   its stable URL must show an explicit missing-item page.
5. Read a malformed/unknown field and an unresolved reference. Prose and original
   metadata remain readable. Repeat item/criterion navigation at 390 × 844, in
   dark mode, and with JavaScript disabled. Check narrow overflow and page errors.

## Work board/detail acceptance — step 05 first checkpoint

Add `viewsFixture()` from `src/test-support/viewsFixture.ts` to the large fixture.

1. Confirm the legacy home still has 100 cards. Open Work and select Review work
   then Shared investigation. The same work.search ID appears in both with the
   source's recorded fields; counts exclude duplicates and undeclared members.
2. Apply owner/status/text filters and sorting. Missing fields remain distinct
   from literal text. Open a card, follow its source/evidence link, then use Back.
   Reload its URL; board, filters, selected ID, and source pane must agree.
3. Edit the selected item's status. Applied filters remain, even with no matching
   status; the detail explains it is outside the projection. Keep unsent text
   focused through that update. Delete its source; explain the missing selection.
   Duplicate an ID or membership and inspect source diagnostics, without silently
   selecting a winner or inflating counts. An unreadable index refuses counts.
4. Repeat at 390 × 844, with dark theme and reduced motion. Real Mermaid in the
   pane must render; check overflow and errors. Disable JavaScript and submit GET
   filters/open detail through native links. Table/saved-view acceptance follows
   in the next checkpoint; do not check step 05 complete yet.

## Table and saved-view acceptance — step 05 completion

1. Use the same richer fixture. Switch Board/Table with an item selected and
   filters/sorting applied. IDs, counts, source fields, and selected detail agree.
   Use Back and reload the table URL; selected context remains. Missing sort fields
   stay last and missing cells remain explicit.
2. Save a named table view, reload, choose it, and Open. Applied board/filters/sort/
   layout return without retaining item selection or unsent filter edits. Save
   the same name in a different layout and confirm it updates rather than doubles.
   Remove one or Clear all. Another workspace must not inherit these names.
3. Save 10 views. An eleventh name must request removal/update instead of silently
   evicting one. Malformed stored JSON recovers on a successful save; external or
   executable saved URLs are ignored and names render as text. Block browser
   storage: in-memory saving/opening/removal still works with an explicit notice.
4. Edit a selected item's status, then delete it. The table/counts update while
   applied filters, focused unsent input, and selection explanations remain.
   Verify real Mermaid, compact density, 390 × 844/dark/reduced motion without page
   overflow, and readable no-JavaScript table/filter/detail navigation. Saved-view
   controls remain disabled without JavaScript.

## Reasoning and evidence acceptance — step 06

Add `reasoningFixture()` from `src/test-support/reasoningFixture.ts` to the large fixture.

1. Open Search reasoning in Table with result.search selected. Follow its
   Implements link to plan.search and that plan's link to decision.search. The
   options comparison and rationale are readable in two navigation steps. Use
   the rationale heading anchor and Back to restore the selected view context.
2. Open work.search#keyboard. It lists claims from both its own source and the
   result file; passage has no recorded evidence. Open the result's record link:
   its source details expand and the exact evidence record receives focus.
   Origin file/line, old revision/time, method and recorded outcome are visible;
   no claim says independently verified or human accepted.
3. Follow its evidence source to the plain evidence file and inspect Referenced
   by. Metadata/Markdown backlinks reach their explicit sources, including the
   encoded review filename. Follow that file's rationale link. The missing local
   Markdown record remains visible and leads to an explanatory missing page.
4. Edit the result's criterion reference, delete the evidence source, then remove
   the result. Claim associations/backlinks reconcile; missing sources/claims
   remain explicit. Duplicate IDs or unreadable files must prevent validated
   criterion association and disclose partial references.
5. Repeat record navigation at 390 × 844/dark/reduced motion and verify overflow,
   errors, and real Mermaid. Disable JavaScript and follow result → plan →
   decision natively. Existing legacy home cards remain unchanged.

## Explicit attention acceptance — step 07

Use `attentionFixture()` alongside `workspaceFixture()` with the 100-card legacy
home; add a Mermaid diagram to the keyboard task. Open Overview from the legacy
home and verify three requests: the review and decision on `request.search`, and
the fixture blocker. `ordinary.review` has status/owner/action but no request;
`prior-review` is explicitly closed and must not enter the queue.

1. Read why each request appears, its response labels and target links. Open the
   keyboard review: focus the exact record and expand its source context. Reload,
   follow its criterion claims and real Mermaid, then Back twice. The overview's
   issue disclosure remains open. Follow the decision into options/rationale.
2. Repeat at 1440 × 1000 and 390 × 844, dark theme and reduced motion. Verify no
   page overflow and native request/criterion navigation with JavaScript disabled.
   Chromium opens the ancestor details for a fragment target natively.
3. Close the review/decision in their source; only the blocker remains. Rename
   the blocker file with spaces and `&`; its identity and encoded source link
   survive. Delete the criterion's item; the remaining request leaves the queue
   with an unresolved source issue. No source issue becomes a quiet workspace.
4. HTTP regressions cover invalid/duplicate/missing identities and requests,
   unreadable source files, malformed YAML, stable restart and genuine quiet
   states. Unreadable indexes return 503 and withhold counts/classification.

For the proposed 30-second orientation target, ask a representative reader to
identify the judgment requested from them and what it would unblock before
opening the details, recording elapsed time and feedback. Then ask them to follow
its rationale/evidence. Automated fixture behavior cannot establish this user
acceptance; record the exercise separately in the roadmap.

## Explicit change baseline acceptance — step 08

Use the same 100-card legacy home plus attention/reasoning fixture.

1. Open Changes: first visit has no history. Start remembering, then edit recorded
   status, an attention state and decision Markdown; add a file, move a unique-ID
   item, and rename a plain file. The view explains changes with current links and
   escaped remembered/current text. A plain rename is removal/addition; identity
   moves match only a unique ID. No edit implies authorship or accepted evidence.
2. Keep the baseline unchanged through live updates, source navigation, Back and
   reload. Open a remembered-source disclosure and retain it through live edits
   and Back. Mark seen replaces the baseline; Clear removes it and reload stays
   off. Touching unchanged source must not create a content change.
3. Inject an expired record, then open ordinary Markdown: the record is removed
   without silently rebaselining. Invalid/future/unsupported records establish no
   comparison. Another workspace key stays untouched. Block storage: explicitly
   marked history works for this page with a visible persistence limitation.
4. Repeat at 1440 × 1000 and 390 × 844 with dark theme/reduced motion and check
   page overflow/errors. Old source containing script/image Markdown is plain
   text. Disable JavaScript: retention controls are disabled with an explanation,
   and native Work/source navigation remains available.
5. HTTP regressions refuse an incomplete observation and a complete oversized
   workspace without deletion counts or partial snapshots. Schema regressions
   exercise exact UTF-8 limits, corrupt/unsupported records and unsafe/duplicate
   paths. Source-comparison fixtures cover ambiguous IDs and unknown frontmatter.

These checks establish comparison behavior, not the separate representative-user
orientation target for step 07.

## Linked reference directory acceptance — 0.4.0 follow-up

1. Symlink the main checkout's `docs` directory into the workspace as `repo-docs`.
   Open `/repo-docs/framework/README.md`, follow its relative roadmap link and
   return with Back. Read the same files with JavaScript disabled.
2. Include a temporary external reference directory containing nested Markdown.
   Choose its nested file as `--home`: `/` retains the requested logical alias and
   resolves relative links. Open a source disclosure, edit the physical reference
   file and retain the disclosure through live refresh and navigation/Back.
   Search must find the edited source through its workspace-relative URL.
3. Add another directory link while the server runs, then retarget it to a
   different reference folder. Its navigation and reads catch up, obsolete paths
   disappear, and later edits of the new target refresh the active page.
4. Repeat at 1440 × 1000 and 390 × 844, including dark theme/reduced motion.
   Check overflow and browser errors. Native HTTP regressions separately cover
   cycles/ancestor traversal, broken links, hidden/dependency entries, escaping
   file links, internal aliases, external add/rename/delete and watcher recovery.

Links explicitly include trusted reference directories; the server never writes
those sources. A target missing when the watch was built needs a server restart
once restored. Multiple aliases remain separate paths and existing duplicate-ID
rules apply. These checks do not establish step 09's selective invalidation,
pause/resume or representative-reader orientation timing.
