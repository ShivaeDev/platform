import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { boardHtml } from "#page/board.ts";
import { boardOf, countsOf } from "#render/board.ts";
import { Highlighter } from "#render/highlighter.ts";

const notes = `# Project notes

What is open this week.

## In review

### \`docs #12\` [Refresh the install guide](https://example.com/pull/12)

Checks are green.

## To do

### \`ops\` Rotate the deploy key

<details>
<summary>Steps</summary>

1. Create the key.
2. Replace the old one.

</details>

### Update the screenshots

## Later

Nothing planned yet.

---

Finished work moves to the changelog.
`;

const html = (source: string) => Effect.runPromise(boardHtml(boardOf(source), "plan.md", 0).pipe(Effect.provide(Highlighter.layer)));

describe("the board", () => {
	it("keeps each item's body, including a details block, with its heading", () => {
		const [, todo] = boardOf(notes).sections;
		expect(todo?.items[0]).toBe(
			"### `ops` Rotate the deploy key\n\n<details>\n<summary>Steps</summary>\n\n1. Create the key.\n2. Replace the old one.\n\n</details>",
		);
	});

	it("renders the counts, items, notes and footer", async () => {
		const rendered = await html(notes);
		expect(rendered).toContain("<h1>Project notes</h1>");
		expect(rendered).toContain('<p class="counts"><span><b>1</b> in review</span> · <span><b>2</b> to do</span></p>');
		expect(rendered).toContain(
			'<article class="item"><h3><code>docs #12</code> <a href="https://example.com/pull/12">Refresh the install guide</a></h3>',
		);
		expect(rendered).toContain('<h2>Later</h2>\n<div class="notes"><p>Nothing planned yet.</p>');
		expect(rendered).toContain("<footer><p>Finished work moves to the changelog.</p>");
	});

	it("keeps a --- inside a card in the card when a later section follows", () => {
		const divided = notes.replace("Checks are green.", "Checks are green.\n\n---\n\nWaiting for a second review.");
		const board = boardOf(divided);
		expect(board.sections[0]?.items[0]).toContain("Waiting for a second review.");
		expect(board.sections.map((section) => section.title)).toEqual(["In review", "To do", "Later"]);
		expect(board.footer).toBe("Finished work moves to the changelog.");
	});

	it("keeps a --- inside a card of the last section in the card", () => {
		const board = boardOf("# Plan\n\n## Later\n\n### Three\n\nA\n\n---\n\nB\n\n### Four\n\nC\n\n---\n\nThe end.\n");
		expect(countsOf(board)).toEqual([{ count: 2, title: "Later" }]);
		expect(board.sections[0]?.items[0]).toBe("### Three\n\nA\n\n---\n\nB");
		expect(board.footer).toBe("The end.");
	});

	it("resolves reference links and footnotes inside cards", async () => {
		const referenced = notes
			.replace("Checks are green.", "Checks are green, see [the run][run] and the note[^flaky].")
			.concat("\n[run]: https://example.com/runs/7\n\n[^flaky]: One check was retried.\n");
		const rendered = await html(referenced);
		expect(rendered).toContain('<a href="https://example.com/runs/7">the run</a>');
		expect(rendered).toContain("One check was retried.");
		expect(rendered).not.toContain("[run]");
		expect(rendered).not.toContain("[^flaky]");
	});

	it("gives each card's footnotes their own ids", async () => {
		const shared = notes
			.replace("Checks are green.", "Checks are green[^flaky].")
			.replace("### Update the screenshots", "### Update the screenshots\n\nAfter the retry[^flaky].")
			.concat("\n[^flaky]: One check was retried.\n");
		const rendered = await html(shared);
		const ids = [...rendered.matchAll(/ id="([^"]+)"/gu)].map(([, id]) => id);
		const targets = [...rendered.matchAll(/ href="#([^"]+)"/gu)].map(([, id]) => id);
		expect(ids.filter((id) => id?.includes("user-content-fn"))).toHaveLength(4);
		expect(new Set(ids).size).toBe(ids.length);
		expect(targets.every((target) => ids.includes(target))).toBe(true);
	});
});
