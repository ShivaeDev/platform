import { Effect, Layer } from "effect";
import { expect, it } from "vitest";
import type { Observation } from "#observe.ts";
import { type Change, change, harness, makeDatabase, on } from "#test/fake-database.ts";

const label = (event: Change) => `${event.subject}:${event.domain}`;

it("a Layer swaps a channel's sink for its scope; the configured sink is untouched and resumes afterwards", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const { channel, published, inTransaction, write } = harness();
			const database = makeDatabase("main");
			const captured: Array<readonly string[]> = [];
			const sink = Layer.succeed(channel.Sink, (changes: readonly Change[]) => Effect.sync(() => captured.push(changes.map(label))));
			yield* Effect.gen(function* () {
				yield* write(database, "row", change("ada")).pipe(inTransaction(database));
				yield* write(database, "bare row", change("bob"));
				const frame = yield* on(database)(channel.open);
				yield* on(database)(frame.provide(channel.record([change("cyd")])));
				yield* frame.settle("committed");
			}).pipe(Effect.provide(sink));
			expect(captured).toEqual([["ada:orders"], ["bob:orders"], ["cyd:orders"]]);
			expect(published).toEqual([]);

			yield* write(database, "later row", change("dan"));
			expect(published).toEqual([["dan:orders"]]);
		}),
	));

it("an observer sees every recorded change and whether it was published or discarded", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const { channel, published, inTransaction, write } = harness();
			const database = makeDatabase("main");
			const seen: string[] = [];
			const observer = Layer.succeed(channel.Observer, (observation: Observation<Change>) =>
				Effect.sync(() => seen.push(`${observation._tag} ${observation.changes.map(label).join(" ")}`)),
			);
			const rejected = Effect.fail("rejected");
			yield* Effect.gen(function* () {
				yield* Effect.gen(function* () {
					yield* write(database, "a", change("ada"));
					yield* Effect.andThen(write(database, "b", change("bob")), rejected).pipe(inTransaction(database), Effect.ignore);
					yield* write(database, "c", change("cyd")).pipe(inTransaction(database));
				}).pipe(inTransaction(database));
				yield* Effect.gen(function* () {
					yield* write(database, "d", change("dan"));
					yield* write(database, "e", change("eve")).pipe(inTransaction(database));
					return yield* rejected;
				}).pipe(inTransaction(database), Effect.ignore);
				yield* write(database, "f", change("fay"), change("fay"));
			}).pipe(Effect.provide(observer));
			expect(seen).toEqual([
				"Recorded ada:orders",
				"Recorded bob:orders",
				"Discarded bob:orders",
				"Recorded cyd:orders",
				"Published ada:orders cyd:orders",
				"Recorded dan:orders",
				"Recorded eve:orders",
				"Discarded dan:orders eve:orders",
				"Recorded fay:orders",
				"Published fay:orders",
			]);
			expect(published).toEqual([["ada:orders", "cyd:orders"], ["fay:orders"]]);

			yield* write(database, "g", change("gus"));
			expect(seen).toHaveLength(10);
		}),
	));
