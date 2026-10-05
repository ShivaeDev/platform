import { afterEach, expect, it } from "vitest";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";

let notes: Folder;
let board: RunningBoard;
afterEach(async () => {
	await board?.stop();
	notes?.remove();
});

it("serves a nested home with source-relative links, a duplicate-heading outline, and readable missing targets", async () => {
	notes = folder({
		"evidence/c# & more?.md": "# Proof\n",
		"plans/home & review.md":
			"# Project review\n\n[Evidence](../evidence/c%23%20%26%20more%3F.md#heading-proof)\n\n## Review\n\n### Evidence\n\n### Evidence\n",
	});
	board = await startBoard(notes.root, "plans/home & review.md");
	const html = await (await fetch(board.url)).text();
	expect(html).toContain('data-file="plans/home &amp; review.md"');
	expect(html).toContain('data-url="/plans/home%20%26%20review.md"');
	expect(html).toContain('href="/evidence/c%23%20%26%20more%3F.md#heading-proof"');
	expect(html).toContain('aria-label="Document outline"');
	expect(html).toContain('id="heading-evidence-2"');
	const evidence = await (await fetch(`${board.url}/evidence/c%23%20%26%20more%3F.md`)).text();
	expect(evidence).toContain('id="heading-proof"');
	const missing = await fetch(`${board.url}/evidence/deleted.md`);
	expect(missing.status).toBe(404);
	expect(await missing.text()).toContain("No markdown file at evidence/deleted.md.");
});
