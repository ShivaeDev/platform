import { Cause, Deferred, Effect, Exit, Result } from "effect";
import { expect } from "vitest";
import { database } from "#test/database.ts";

database.it("parallel transactions write the same rows without seeing each other", [], function* ({ inRollback, writeNote, readNotes, inShared }) {
	const a = yield* Deferred.make<void>();
	const b = yield* Deferred.make<void>();
	const rows = yield* Effect.all(
		(
			[
				["a", a, b],
				["b", b, a],
			] as const
		).map(([value, ready, other]) =>
			inRollback(
				Effect.gen(function* () {
					yield* writeNote(value);
					yield* Deferred.succeed(ready, undefined);
					yield* Deferred.await(other);
					return yield* readNotes();
				}),
			),
		),
		{ concurrency: "unbounded" },
	);
	expect(rows).toEqual([[{ id: 1, value: "a" }], [{ id: 1, value: "b" }]]);
	expect(yield* inShared(readNotes())).toEqual([]);
});
database.it(
	"nested transact uses savepoints and the outer rollback suppresses invalidations",
	[],
	function* ({ inShared, watchItemInvalidations, inRollback, writeItem, inSavepoint, invalidateItems, readItems, readSharedItems }) {
		const publications = yield* inShared(watchItemInvalidations());
		yield* inRollback(
			Effect.gen(function* () {
				yield* writeItem("outer");
				yield* inSavepoint(Effect.andThen(writeItem("nested"), invalidateItems()));
				expect(yield* readItems()).toEqual([{ value: "nested" }]);
				const rejected = yield* inSavepoint(Effect.andThen(writeItem("rejected"), Effect.fail("rejected"))).pipe(Effect.flip);
				expect(rejected).toBe("rejected");
				expect(yield* readItems()).toEqual([{ value: "nested" }]);
			}),
		);
		expect(yield* readSharedItems()).toEqual([{ value: "seed" }]);
		expect(publications()).toEqual([]);
	},
);
database.it(
	"typed failures, defects and interruption roll back and preserve their exits",
	[],
	function* ({ inRollback, writeItem, readSharedItems, interruptWrite }) {
		const failure = { reason: "rejected" };
		const defect = new Error("assertion failed");
		for (const ending of [Effect.fail(failure), Effect.die(defect)]) {
			const exit = yield* inRollback(Effect.andThen(writeItem("temporary"), ending)).pipe(Effect.exit);
			expect(Exit.isFailure(exit)).toBe(true);
			if (Exit.isFailure(exit)) {
				const reason = Cause.hasFails(exit.cause) ? Cause.findError(exit.cause) : Cause.findDefect(exit.cause);
				expect(Result.isSuccess(reason) && reason.success).toBe(Cause.hasFails(exit.cause) ? failure : defect);
			}
			expect(yield* readSharedItems()).toEqual([{ value: "seed" }]);
		}
		const exit = yield* interruptWrite();
		expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
		expect(yield* readSharedItems()).toEqual([{ value: "seed" }]);
	},
);
