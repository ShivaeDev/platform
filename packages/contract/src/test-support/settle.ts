import { Effect, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";

// A signal that never arrives ends the wait at this deadline, so the story's expectation shows what the engine did instead of a test timeout.
const DEADLINE = "5 seconds";

export function signal<A>(changes: Stream.Stream<A>, arrived: (value: A) => boolean): Effect.Effect<void> {
	return changes.pipe(Stream.filter(arrived), Stream.runHead, Effect.asVoid, Effect.timeoutOrElse({ duration: DEADLINE, orElse: () => Effect.void }));
}

function idle<A, E>(result: AsyncResult.AsyncResult<A, E>) {
	return !(AsyncResult.isInitial(result) || result.waiting);
}

export function settled<A, E>(registry: AtomRegistry.AtomRegistry, atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>) {
	// An idle value can be followed at once by a queued refresh, so the result counts as settled only if it is still idle when read.
	const stillIdle = AtomRegistry.toStream(registry, atom).pipe(
		Stream.filter(idle),
		Stream.mapEffect(() => Effect.sync(() => registry.get(atom))),
	);
	return signal(stillIdle, idle).pipe(Effect.andThen(Effect.sync(() => registry.get(atom))));
}

export function waited<A>(effect: Effect.Effect<A>, fallback: () => A): Effect.Effect<A> {
	return Effect.timeoutOrElse(effect, { duration: DEADLINE, orElse: () => Effect.sync(fallback) });
}
