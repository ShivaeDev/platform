import { Cause, Effect, Exit } from "effect";
import { expect, it } from "vitest";
import type { ChannelOptions } from "#channel.ts";
import { type Change, Current, change, harness, makeDatabase } from "#test/support/fake-database.ts";

const setup = (options: Partial<ChannelOptions<Change, Current>> = {}) => ({
	...harness(options),
	main: makeDatabase("main"),
	other: makeDatabase("other"),
});

it("a frame on another owner inside a frame is a root for that owner and publishes at its own commit", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const { published, inTransaction, write, main, other } = setup();
			const failed = yield* Effect.gen(function* () {
				yield* write(main, "main row", change("ada"));
				yield* write(other, "other row", change("bob")).pipe(inTransaction(other));
				expect(published).toEqual([["bob:orders"]]);
				return yield* Effect.fail("rejected");
			}).pipe(inTransaction(main), Effect.flip);
			expect(failed).toBe("rejected");
			expect(published).toEqual([["bob:orders"]]);
			expect(main.committed).toEqual([]);
			expect(other.committed).toEqual(["other row"]);
		}),
	));

it("re-entering an owner inside another owner's frame joins the first owner's frame", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const { published, inTransaction, write, main, other } = setup();
			const failed = yield* Effect.gen(function* () {
				yield* write(other, "other outer", change("cyd"));
				yield* Effect.gen(function* () {
					yield* write(main, "main row", change("ada"));
					yield* write(other, "other inner", change("bob")).pipe(inTransaction(other));
				}).pipe(inTransaction(main));
				expect(published).toEqual([["ada:orders"]]);
				return yield* Effect.fail("rejected");
			}).pipe(inTransaction(other), Effect.flip);
			expect(failed).toBe("rejected");
			expect(published).toEqual([["ada:orders"]]);
			expect(main.committed).toEqual(["main row"]);
			expect(other.committed).toEqual([]);
		}),
	));

it("changes follow the owner that recorded them, not the innermost frame", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const { published, inTransaction, write, main, other } = setup();
			const failed = yield* Effect.gen(function* () {
				yield* Effect.gen(function* () {
					yield* write(main, "main row", change("ada"));
					yield* write(other, "other row", change("bob"));
				}).pipe(inTransaction(main));
				expect(published).toEqual([["ada:orders"]]);
				return yield* Effect.fail("rejected");
			}).pipe(inTransaction(other), Effect.flip);
			expect(failed).toBe("rejected");
			expect(published).toEqual([["ada:orders"]]);
			expect(main.committed).toEqual(["main row"]);
			expect(other.committed).toEqual([]);
		}),
	));

it("the unowned guard runs for a record or a root frame without an enclosing transaction frame, never inside one", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const guarded: string[] = [];
			const unowned = Effect.map(Effect.service(Current), (database) => {
				guarded.push(database.name);
			});
			const { published, inTransaction, write, main } = setup({ unowned });
			yield* write(main, "bare row", change("ada"));
			expect(guarded).toEqual(["main"]);
			expect(published).toEqual([["ada:orders"]]);
			yield* Effect.gen(function* () {
				yield* write(main, "outer", change("bob"));
				yield* write(main, "inner", change("cyd")).pipe(inTransaction(main));
			}).pipe(inTransaction(main));
			expect(guarded).toEqual(["main", "main"]);
			expect(published).toEqual([["ada:orders"], ["bob:orders", "cyd:orders"]]);

			const refusing = setup({ unowned: Effect.die(new Error("a native transaction the channel does not own is open")) });
			const recorded = yield* refusing.write(refusing.main, "refused row", change("dan")).pipe(Effect.exit);
			const opened = yield* refusing.write(refusing.main, "never written", change("eve")).pipe(refusing.inTransaction(refusing.main), Effect.exit);
			expect(Exit.isFailure(recorded) && Cause.hasDies(recorded.cause)).toBe(true);
			expect(Exit.isFailure(opened) && Cause.hasDies(opened.cause)).toBe(true);
			expect(refusing.main.committed).toEqual(["refused row"]);
			expect(refusing.published).toEqual([]);
		}),
	));
