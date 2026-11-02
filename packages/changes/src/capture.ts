import { type Context, Effect, Layer, Ref } from "effect";
import type { Observation, Observer } from "./observe.ts";

export interface Capture<A> {
	readonly attempted: Effect.Effect<readonly (readonly A[])[]>;
	readonly discarded: Effect.Effect<readonly (readonly A[])[]>;
	readonly layer: (observer: Context.Reference<Observer<A>>) => Layer.Layer<never>;
	readonly recorded: Effect.Effect<readonly (readonly A[])[]>;
}

export const makeCapture = Effect.fn("Changes.makeCapture")(function* <A>() {
	const observations = yield* Ref.make<readonly Observation<A>[]>([]);
	function layer(observer: Context.Reference<Observer<A>>): Layer.Layer<never> {
		return Layer.effect(
			observer,
			Effect.map(
				observer,
				(parent): Observer<A> =>
					(event) =>
						Effect.andThen(
							Ref.update(observations, (events) => [...events, { ...event, changes: [...event.changes] }]),
							Effect.suspend(() => parent(event)),
						),
			),
		);
	}
	function read(tag: Observation<A>["_tag"]) {
		return Effect.map(Ref.get(observations), (events) => events.filter((event) => event._tag === tag).map((event) => [...event.changes]));
	}
	return { attempted: read("Published"), discarded: read("Discarded"), layer, recorded: read("Recorded") } satisfies Capture<A>;
});
