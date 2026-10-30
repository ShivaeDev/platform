import { Effect, type Stream } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { signal } from "./settle.ts";

export interface Mark<A, E> {
	readonly reads: number;
	readonly shown: AsyncResult.AsyncResult<A, E>;
}

// A bound query can move from its old value straight to the re-read one, so a re-read is awaited by the server's read count and the value that follows it.
export function reRead<A, E>(
	registry: AtomRegistry.AtomRegistry,
	atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
	reads: Stream.Stream<number>,
	mark: Mark<A, E> | undefined,
) {
	return signal(reads, (count) => count > (mark?.reads ?? 0)).pipe(
		Effect.andThen(signal(AtomRegistry.toStream(registry, atom), (result) => result !== mark?.shown && !result.waiting)),
	);
}
