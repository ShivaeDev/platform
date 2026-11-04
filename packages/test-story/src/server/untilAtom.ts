import { Cause, Data, Effect, Queue, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { type UntilOptions, until } from "#server/until.ts";

export class AtomFailed extends Data.TaggedError("AtomFailed")<{
	readonly cause: Cause.Cause<unknown>;
	readonly message: string;
	readonly name: string;
}> {}

export function untilAtom<A>(atom: Atom.Atom<A>, predicate: (value: A) => boolean, options: UntilOptions = { name: "atom value" }) {
	const values = Stream.callback<A, never, AtomRegistry.AtomRegistry>((queue) =>
		Effect.gen(function* () {
			const registry = yield* AtomRegistry.AtomRegistry;
			yield* Effect.acquireRelease(
				Effect.sync(() => registry.subscribe(atom, (value) => Queue.offerUnsafe(queue, value))),
				(unsubscribe) => Effect.sync(unsubscribe),
			);
			yield* Queue.offer(queue, registry.get(atom));
		}),
	);
	function check(value: A) {
		if (AsyncResult.isAsyncResult(value) && AsyncResult.isFailure(value)) {
			return Effect.fail(
				new AtomFailed({
					cause: value.cause,
					message: `Atom "${options.name}" failed: ${Cause.pretty(value.cause)}\nhelp: Check the atom's source failure before waiting for its value.`,
					name: options.name,
				}),
			);
		}
		return Effect.succeed(value);
	}
	return until(values.pipe(Stream.mapEffect(check)), predicate, options);
}
