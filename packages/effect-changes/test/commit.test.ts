import { Cause, Deferred, Effect, Exit, Fiber } from "effect";
import { expect, it } from "vitest";
import { change, harness, makeDatabase } from "./support/fake-database.ts";

it("a committed root frame publishes its distinct changes once, after the body, in first-seen order", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const { channel, published, inTransaction, write } = harness();
			const database = makeDatabase("main");
			const trail: Array<string> = [];
			yield* Effect.gen(function* () {
				yield* write(database, "order 1", change("ada"), change("bob"));
				yield* channel.record([change("ada"), change("ada", "invoices")]);
				trail.push(`body finished after ${published.length} publishes`);
			}).pipe(inTransaction(database));
			expect(trail).toEqual(["body finished after 0 publishes"]);
			expect(published).toEqual([["ada:orders", "bob:orders", "ada:invoices"]]);
			expect(database.committed).toEqual(["order 1"]);
		}),
	));

it("a typed failure, a defect, an interruption or a failed commit discards the frame", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const { published, inTransaction, write } = harness();
			const database = makeDatabase("main");
			const failing = makeDatabase("failing commit", Effect.die(new Error("deferred constraint violated")));

			const failed = yield* Effect.andThen(write(database, "row", change("ada")), Effect.fail("rejected")).pipe(inTransaction(database), Effect.flip);
			expect(failed).toBe("rejected");
			const died = yield* Effect.andThen(write(database, "row", change("ada")), Effect.die("boom")).pipe(inTransaction(database), Effect.exit);
			expect(Exit.isFailure(died) && Cause.hasDies(died.cause)).toBe(true);

			const entered = yield* Deferred.make<void>();
			const fiber = yield* Effect.andThen(
				write(database, "row", change("ada")),
				Effect.andThen(Deferred.succeed(entered, undefined), Effect.never),
			).pipe(inTransaction(database), Effect.forkChild);
			yield* Deferred.await(entered);
			yield* Fiber.interrupt(fiber);
			const interrupted = yield* Fiber.await(fiber);
			expect(Exit.isFailure(interrupted) && Cause.hasInterrupts(interrupted.cause)).toBe(true);

			const commitFailed = yield* write(failing, "row", change("ada")).pipe(inTransaction(failing), Effect.exit);
			expect(Exit.isFailure(commitFailed) && Cause.hasDies(commitFailed.cause)).toBe(true);

			expect(published).toEqual([]);
			expect(database.committed).toEqual([]);
			expect(failing.committed).toEqual([]);
		}),
	));

it("a nested frame merges into its parent on commit and is discarded on rollback while the parent keeps its own", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const { channel, published, inTransaction, write } = harness();
			const database = makeDatabase("main");
			const nested = inTransaction(database);
			yield* Effect.gen(function* () {
				yield* write(database, "outer", change("ada"));
				yield* write(database, "committed savepoint", change("bob")).pipe(nested);
				expect(published).toEqual([]);
				yield* Effect.andThen(write(database, "rolled-back savepoint", change("cyd")), Effect.fail("rejected")).pipe(nested, Effect.ignore);
				yield* channel.record([change("bob"), change("dan")]);
			}).pipe(nested);
			expect(published).toEqual([["ada:orders", "bob:orders", "dan:orders"]]);
			expect(database.committed).toEqual(["outer", "committed savepoint"]);
		}),
	));

it("concurrent records from Effect.all land in the same frame and publish once", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const { channel, published, inTransaction } = harness();
			const database = makeDatabase("main");
			const subjects = Array.from({ length: 40 }, (_, index) => `subject ${index % 10}`);
			yield* Effect.forEach(subjects, (subject) => Effect.andThen(Effect.yieldNow, channel.record([change(subject)])), {
				concurrency: "unbounded",
				discard: true,
			}).pipe(inTransaction(database));
			expect(published).toHaveLength(1);
			expect([...(published[0] ?? [])].sort()).toEqual(Array.from({ length: 10 }, (_, index) => `subject ${index}:orders`));
		}),
	));

it("one write can record events for several subjects, and each subject and domain publishes once per commit", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const { channel, published, inTransaction, write } = harness();
			const database = makeDatabase("main");
			yield* Effect.gen(function* () {
				yield* write(database, "membership grant", change("owner", "memberships"), change("member", "memberships"));
				yield* write(database, "member order", change("member"), change("member", "memberships")).pipe(inTransaction(database));
				yield* channel.record([change("owner", "memberships")]);
			}).pipe(inTransaction(database));
			expect(published).toEqual([["owner:memberships", "member:memberships", "member:orders"]]);

			yield* write(
				database,
				"bare membership grant",
				change("owner", "memberships"),
				change("member", "memberships"),
				change("owner", "memberships"),
			);
			expect(published[1]).toEqual(["owner:memberships", "member:memberships"]);
		}),
	));

it("an interruption that arrives while the commit is in flight publishes exactly when the database committed", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const { published, inTransaction, write } = harness();
			const committing = yield* Deferred.make<void>();
			const release = yield* Deferred.make<void>();
			const database = makeDatabase("slow commit", Effect.andThen(Deferred.succeed(committing, undefined), Deferred.await(release)));
			const fiber = yield* write(database, "row", change("ada")).pipe(inTransaction(database), Effect.forkChild);
			yield* Deferred.await(committing);
			const interruption = yield* Effect.forkChild(Fiber.interrupt(fiber), { startImmediately: true });
			expect(published).toEqual([]);
			yield* Deferred.succeed(release, undefined);
			yield* Fiber.join(interruption);
			const exit = yield* Fiber.await(fiber);
			expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
			expect(database.committed).toEqual(["row"]);
			expect(published).toEqual([["ada:orders"]]);
		}),
	));
