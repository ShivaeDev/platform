import { expect } from "@effect/vitest";
import { Effect, PubSub, Stream } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { type Snapshot, snapshotStream } from "#host/snapshotStream.ts";

it.effect("a change during the initial snapshot reaches the already subscribed reader", function* () {
	const events = yield* PubSub.sliding<Snapshot>(1);
	const initial = Effect.gen(function* () {
		yield* PubSub.publish(events, Effect.succeed([{ stage: "released", workId: "one" }]));
		return [{ stage: "executing", workId: "one" }];
	});
	const states = yield* snapshotStream(events, initial, ["one"]).pipe(Stream.take(2), Stream.runCollect);
	expect(states).toEqual([[{ stage: "executing", workId: "one" }], [{ stage: "released", workId: "one" }]]);
	expect(yield* PubSub.size(events)).toBe(0);
});
