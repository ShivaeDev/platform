# Workspace browser acceptance

Use the production page with the shared 50-document, 100-item fixture. Happy DOM
regressions cover preference handling and live rendering with a Mermaid stub;
these checks cover layout, keyboard interaction, and the actual Mermaid package.
Run them when shell, styling, navigation, or diagram rendering changes.

From the repository root, after installing dependencies and building packages:

```sh
node --conditions=source --input-type=module <<'JS'
import { folder, startBoard } from './packages/work-board/test/support/board.ts';
import { workspaceFixture } from './packages/work-board/test/support/workspaceFixture.ts';
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
filename, a diagram, details, and malformed example metadata. Missing references
and metadata are reading samples here; schema validation belongs to later steps.
Performance timings from this fixture are observations, not established budgets
or proof of the north star's usability targets.
