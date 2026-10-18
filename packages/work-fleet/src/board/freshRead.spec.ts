import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { briefRevision } from "#board/briefRevision.ts";
import { withBoardReadPass, workMetadata } from "#board/readPass.ts";
import { boardReadStory, hasBoardItems } from "#test/boardReadStory.ts";

boardReadStory.it("a fresh lookup rereads only its source and updates the pass metadata", [hasBoardItems(2)], function* ({ board, fixture }) {
	yield* withBoardReadPass(
		Effect.gen(function* () {
			const original = yield* board.get("item.0");
			const other = yield* board.get("item.1");
			yield* fixture.write("0.md", fixture.source("item.0", false, "Changed during the pass."));
			expect(yield* board.get("item.0")).toEqual(original);
			const current = yield* board.get("item.0", { fresh: true });
			expect(current.approved).toBe(false);
			expect(current.revision).not.toBe(original.revision);
			expect(current.revision).toBe(briefRevision(yield* workMetadata(current)));
			expect(yield* board.get("item.0")).toEqual(current);
			expect(fixture.scans()).toBe(1);
			expect(fixture.reads.get(original.sourcePath)).toBe(2);
			expect(fixture.reads.get(other.sourcePath)).toBe(1);
		}),
	);
});
boardReadStory.it("a fresh lookup fails when its cached source becomes unreadable", [hasBoardItems(1)], function* ({ board, fixture }) {
	yield* withBoardReadPass(
		Effect.gen(function* () {
			expect((yield* board.get("item.0")).approved).toBe(true);
			fixture.unreadable.add("0.md");
			expect(yield* Effect.result(board.get("item.0", { fresh: true }))).toMatchObject({
				_tag: "Failure",
				failure: { message: expect.stringContaining("Board source could not be read: 0.md") },
			});
		}),
	);
});
