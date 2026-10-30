import { Effect, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { LiveHint } from "#live.ts";
import type { QueryUpdate } from "#queryUpdate.ts";

export function queryDelivery<A, E>(
	atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
	decode: ((value: unknown) => A) | undefined,
	paused: Atom.Atom<boolean>,
) {
	const pushed = Atom.make<AsyncResult.AsyncResult<A, E>>(AsyncResult.initial());
	const deliver = Effect.fnUntraced(function* (update: QueryUpdate): Effect.fn.Return<LiveHint, never, AtomRegistry.AtomRegistry> {
		if (update._tag !== "Result") {
			return update;
		}
		const registry = yield* AtomRegistry.AtomRegistry;
		if (decode !== undefined && !registry.get(paused)) {
			registry.set(pushed, AsyncResult.success(decode(update.value)));
		}
		return { _tag: "Changed", keys: [], queryIndexes: [] };
	});
	return {
		atom: decode === undefined ? atom : pushed,
		stream: <TError, R>(stream: Stream.Stream<QueryUpdate, TError, R>) => Stream.mapEffect(stream, deliver),
	};
}
