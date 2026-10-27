import { Cause, Effect, Exit } from "effect";
import { expect } from "vitest";
import { change } from "#test/fakeDatabase.ts";
import { changes, guardsUnowned, hasOwner } from "#test/kit.ts";

changes.it(
	"a frame on another owner inside a frame is a root for that owner and publishes at its own commit",
	[hasOwner("other")],
	function* ({ published, inTransaction, write, main, owner, rollback }) {
		const other = owner("other");
		const failed = yield* Effect.gen(function* () {
			yield* write(main, "main row", change("ada"));
			yield* write(other, "other row", change("bob")).pipe(inTransaction(other));
			expect(published).toEqual([["bob:orders"]]);
			return yield* rollback();
		}).pipe(inTransaction(main), Effect.flip);
		expect(failed).toBe("rejected");
		expect(published).toEqual([["bob:orders"]]);
		expect(main.committed).toEqual([]);
		expect(other.committed).toEqual(["other row"]);
	},
);

changes.it(
	"re-entering an owner inside another owner's frame joins the first owner's frame",
	[hasOwner("other")],
	function* ({ published, inTransaction, write, main, owner, rollback }) {
		const other = owner("other");
		const failed = yield* Effect.gen(function* () {
			yield* write(other, "other outer", change("cyd"));
			yield* Effect.gen(function* () {
				yield* write(main, "main row", change("ada"));
				yield* write(other, "other inner", change("bob")).pipe(inTransaction(other));
			}).pipe(inTransaction(main));
			expect(published).toEqual([["ada:orders"]]);
			return yield* rollback();
		}).pipe(inTransaction(other), Effect.flip);
		expect(failed).toBe("rejected");
		expect(published).toEqual([["ada:orders"]]);
		expect(main.committed).toEqual(["main row"]);
		expect(other.committed).toEqual([]);
	},
);

changes.it(
	"changes follow the owner that recorded them, not the innermost frame",
	[hasOwner("other")],
	function* ({ published, inTransaction, write, main, owner, rollback }) {
		const other = owner("other");
		const failed = yield* Effect.gen(function* () {
			yield* Effect.gen(function* () {
				yield* write(main, "main row", change("ada"));
				yield* write(other, "other row", change("bob"));
			}).pipe(inTransaction(main));
			expect(published).toEqual([["ada:orders"]]);
			return yield* rollback();
		}).pipe(inTransaction(other), Effect.flip);
		expect(failed).toBe("rejected");
		expect(published).toEqual([["ada:orders"]]);
		expect(main.committed).toEqual(["main row"]);
		expect(other.committed).toEqual([]);
	},
);

changes.it(
	"the unowned guard runs for a record or a root frame without an enclosing transaction frame, never inside one",
	[guardsUnowned()],
	function* ({ guarded, published, inTransaction, write, main }) {
		yield* write(main, "bare row", change("ada"));
		expect(guarded).toEqual(["main"]);
		expect(published).toEqual([["ada:orders"]]);
		yield* Effect.gen(function* () {
			yield* write(main, "outer", change("bob"));
			yield* write(main, "inner", change("cyd")).pipe(inTransaction(main));
		}).pipe(inTransaction(main));
		expect(guarded).toEqual(["main", "main"]);
		expect(published).toEqual([["ada:orders"], ["bob:orders", "cyd:orders"]]);
	},
);

changes.it(
	"the unowned guard refuses an unobservable native transaction",
	[guardsUnowned(true)],
	function* ({ write, database, inTransaction, published }) {
		const recorded = yield* write(database, "refused row", change("dan")).pipe(Effect.exit);
		const opened = yield* write(database, "never written", change("eve")).pipe(inTransaction(database), Effect.exit);
		expect(Exit.isFailure(recorded) && Cause.hasDies(recorded.cause)).toBe(true);
		expect(Exit.isFailure(opened) && Cause.hasDies(opened.cause)).toBe(true);
		expect(database.committed).toEqual(["refused row"]);
		expect(published).toEqual([]);
	},
);
