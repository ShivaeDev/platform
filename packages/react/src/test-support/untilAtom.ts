import { Effect, Queue, Stream } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { type UntilOptions, until } from "@shivaedev/test-story/server/until.ts";

export function untilAtom<A>(
	registry: AtomRegistry.AtomRegistry,
	atom: Atom.Atom<A>,
	predicate: (value: A) => boolean,
	options: UntilOptions = { name: "atom value" },
) {
	const values = Stream.callback<A>((queue) =>
		Effect.gen(function* () {
			yield* Effect.acquireRelease(
				Effect.sync(() => registry.subscribe(atom, (value) => Queue.offerUnsafe(queue, value))),
				(unsubscribe) => Effect.sync(unsubscribe),
			);
			yield* Queue.offer(queue, registry.get(atom));
		}),
	);
	return until(values, predicate, options);
}
