import { Deferred, type Duration, Effect, Fiber, Stream, SubscriptionRef } from "effect";
import type { Key } from "./keys.ts";
import type { LiveHint } from "./live.ts";

export interface HintViewer<E> {
	readonly finished: Effect.Effect<void, E>;
	readonly hints: SubscriptionRef.SubscriptionRef<readonly LiveHint[]>;
}

export const watchHints = Effect.fn("Live.watchHints")(function* <E, R>(stream: Stream.Stream<LiveHint, E, R>) {
	const hints = yield* SubscriptionRef.make<readonly LiveHint[]>([]);
	const ready = yield* Deferred.make<void>();
	const fiber = yield* stream.pipe(
		Stream.runForEach((hint) =>
			SubscriptionRef.update(hints, (received) => [...received, hint]).pipe(Effect.andThen(Deferred.succeed(ready, undefined))),
		),
		Effect.forkScoped,
	);
	const finished = Fiber.join(fiber);
	yield* Effect.raceFirst(Deferred.await(ready), finished);
	return { finished, hints } satisfies HintViewer<E>;
});

export const heard = Effect.fn("Live.heard")(function* <E>(
	viewer: HintViewer<E>,
	keys: readonly Key[],
	options: { readonly within?: Duration.Input } = {},
) {
	const matching = SubscriptionRef.changes(viewer.hints).pipe(
		Stream.filter((hints) => hints.some((hint) => namesKeys(hint, keys))),
		Stream.runHead,
		Effect.as(true),
	);
	return yield* Effect.raceFirst(matching, Effect.as(viewer.finished, false)).pipe(
		Effect.timeoutOrElse({ duration: options.within ?? "1 second", orElse: () => Effect.succeed(false) }),
	);
});

function namesKeys(hint: LiveHint, keys: readonly Key[]): boolean {
	return (
		hint._tag === "Changed"
		&& keys.every((key) =>
			hint.keys.some(
				(actual) =>
					actual._tag === key._tag
					&& actual.collection === key.collection
					&& (key._tag === "List" || (actual._tag === "Item" && actual.id === key.id)),
			),
		)
	);
}
