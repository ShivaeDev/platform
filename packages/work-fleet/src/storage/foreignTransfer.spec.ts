import { Effect, Exit } from "effect";
import { expect } from "vitest";
import { record } from "#test/storage.ts";
import { isolatedStorage } from "#test/storageStory.ts";

const test = isolatedStorage;
test.it("concurrent foreign transfers of one PR occupy a single backlog slot", [], function* ({ store }) {
	yield* Effect.all(
		[store.reserveForeign("pr-one", { backlog: true, executing: false }), store.reserveForeign("pr-one", { backlog: true, executing: false })],
		{ concurrency: 2 },
	);
	expect(yield* store.foreignReservations()).toEqual([{ areas: [], backlog: true, executing: false, owner: "pr-one" }]);
	expect(Exit.isFailure(yield* store.insert({ ...record("board-a"), step: "terminal" }, { maxBacklog: 1 }).pipe(Effect.exit))).toBe(true);
	yield* store.insert({ ...record("board-a"), step: "terminal" }, { maxBacklog: 2 });
});
