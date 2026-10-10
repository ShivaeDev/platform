import { Effect } from "effect";
import { expect, it } from "vitest";
import { makeChannel } from "#channel.ts";
import type { Observation } from "#observe.ts";

it("an empty change list does not call observers or subscribers inside or outside a batch", () => {
	const published: Array<readonly string[]> = [];
	const observed: Array<Observation<string>> = [];
	const channel = makeChannel<string>({
		name: "EmptyChanges",
		owner: Effect.succeed("request"),
		publish: (changes) =>
			Effect.sync(() => {
				published.push(changes);
			}),
	});
	return Effect.runPromise(
		Effect.gen(function* () {
			yield* channel.record([]);
			yield* channel.batch(channel.record([]));
			expect(observed).toEqual([]);
			expect(published).toEqual([]);
		}).pipe(
			Effect.provideService(channel.Observer, (observation) =>
				Effect.sync(() => {
					observed.push(observation);
				}),
			),
		),
	);
});
