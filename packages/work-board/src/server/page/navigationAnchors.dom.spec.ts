import { Effect, Schema } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { folder, startBoard } from "#test/board.ts";
import { openPage } from "#test/browser.ts";
import { settle, waitFor } from "#test/live.ts";

const ReadingEntry = Schema.Struct({ workBoard: Schema.Struct({ id: Schema.String }) });
type ReadingEntry = typeof ReadingEntry.Type;

it.live.each([
	["heading", "/plan.md", "#heading-evidence"],
	["criterion", "/_board/item/work.anchors/", "#criterion-evidence"],
] as const)("retains the main node and expanded details through a same-document %s anchor and reading history", function* ([_kind, path, hash]) {
	const notes = folder({
		"plan.md":
			"---\nid: work.anchors\nkind: task\ncriteria:\n  - id: evidence\n    text: Review the supporting evidence\n---\n# Plan\n\n[Read evidence](#heading-evidence)\n\n[Review criterion](#criterion-evidence)\n\n<details><summary>Context</summary>Expanded context.</details>\n\n## Evidence\n\nThe supporting evidence.\n",
	});
	yield* Effect.addFinalizer(() => Effect.sync(notes.remove));
	const board = yield* startBoard(notes.root);
	const page = yield* openPage(board, path);
	yield* Effect.promise(() => waitFor(() => expect(page.pageRequests.answered).toBeGreaterThanOrEqual(1)));
	yield* Effect.promise(() => settle());
	const main = page.document.getElementById("doc");
	const details = main?.querySelector("article details");
	const link = main?.querySelector(`a[href$="${hash}"]`);
	const passage = main?.querySelector(hash);
	if (!(details instanceof page.window.HTMLDetailsElement && link && passage)) {
		throw new Error("Missing anchor fixture");
	}
	details.open = true;
	function readingId(): ReadingEntry["workBoard"]["id"] {
		return Schema.decodeUnknownSync(ReadingEntry)(page.window.history.state).workBoard.id;
	}
	const originalId = readingId();
	const requests = page.pageRequests.count;
	link.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, button: 0, cancelable: true }));
	yield* Effect.promise(() => waitFor(() => expect(page.window.location.hash).toBe(hash)));
	yield* Effect.promise(() => settle());
	expect(page.document.getElementById("doc")).toBe(main);
	expect(page.document.querySelector("article details")).toBe(details);
	expect(details.open).toBe(true);
	expect(page.document.activeElement).toBe(passage);
	const anchorId = readingId();
	expect(anchorId).not.toBe(originalId);
	page.window.history.back();
	yield* Effect.promise(() => waitFor(() => expect(readingId()).toBe(originalId)));
	yield* Effect.promise(() => settle());
	expect(page.window.location.hash).toBe("");
	expect(page.document.getElementById("doc")).toBe(main);
	expect(details.open).toBe(true);
	page.window.history.forward();
	yield* Effect.promise(() => waitFor(() => expect(readingId()).toBe(anchorId)));
	yield* Effect.promise(() => settle());
	expect(page.window.location.hash).toBe(hash);
	expect(page.document.getElementById("doc")).toBe(main);
	expect(details.open).toBe(true);
	expect(page.pageRequests.count).toBe(requests);
});
