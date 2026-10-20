import { expect } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { withBoardReadPass } from "#board/readPass.ts";
import { boardReadStory, hasBoardItems } from "#test/boardReadStory.ts";

const JOINING_READERS = 50;
const ONE_PASS = 1;
const TWO_PASSES = 2;

boardReadStory.it("independent passes and unscoped callers join the same in-flight scan", [hasBoardItems(2)], function* ({ board, fixture }) {
	const pause = yield* fixture.pauseReads();
	const first = yield* withBoardReadPass(board.get("item.0")).pipe(Effect.forkScoped);
	yield* pause.entered;
	const readers = yield* Effect.all(
		Array.from({ length: JOINING_READERS }, (_, index) => (index % 2 === 0 ? withBoardReadPass(board.get("item.1")) : board.get("item.1"))),
		{ concurrency: "unbounded" },
	).pipe(Effect.forkScoped);
	yield* Effect.yieldNow;
	yield* pause.release;
	expect((yield* Fiber.join(first)).workId).toBe("item.0");
	expect(yield* Fiber.join(readers)).toHaveLength(JOINING_READERS);
	expect(fixture.scans()).toBe(ONE_PASS);
	expect([...fixture.reads.values()]).toEqual([1, 1]);
});

boardReadStory.it("fresh passes wait for the in-flight scan and share its successor", [hasBoardItems(1)], function* ({ board, fixture }) {
	const pause = yield* fixture.pauseReads();
	const first = yield* board.get("item.0").pipe(Effect.forkScoped);
	yield* pause.entered;
	yield* fixture.write("0.md", fixture.source("item.0", false));
	const readers = yield* Effect.all(
		Array.from({ length: JOINING_READERS }, () => withBoardReadPass(board.get("item.0"), { fresh: true })),
		{ concurrency: "unbounded" },
	).pipe(Effect.forkScoped);
	yield* Effect.yieldNow;
	expect(fixture.scans()).toBe(ONE_PASS);
	yield* pause.release;
	expect((yield* Fiber.join(first)).approved).toBe(true);
	for (const work of yield* Fiber.join(readers)) {
		expect(work.approved).toBe(false);
	}
	expect(fixture.scans()).toBe(TWO_PASSES);
	expect([...fixture.reads.values()]).toEqual([2]);
});
