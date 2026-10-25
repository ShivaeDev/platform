import { expect } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { withBoardReadPass } from "#board/readPass.ts";
import { boardReadStory, hasBoardItems } from "#test/boardReadStory.ts";

const JOINING_READERS = 50;

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
	expect((yield* Fiber.join(readers)).map((work) => work.workId)).toEqual(Array.from({ length: JOINING_READERS }, () => "item.1"));
	expect(fixture.scannedFolders()).toEqual(["."]);
	expect(fixture.readFiles()).toEqual(["0.md", "1.md"]);
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
	expect(fixture.scannedFolders()).toEqual(["."]);
	yield* pause.release;
	expect((yield* Fiber.join(first)).approved).toBe(true);
	for (const work of yield* Fiber.join(readers)) {
		expect(work.approved).toBe(false);
	}
	expect(fixture.scannedFolders()).toEqual([".", "."]);
	expect(fixture.readFiles()).toEqual(["0.md", "0.md"]);
});
