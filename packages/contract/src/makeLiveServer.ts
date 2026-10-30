import { Effect, Queue, Stream } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { type Key, type KeyContext, readKeys } from "@shivaedev/changes/keys.ts";
import { changedHint } from "#internal/queryHints.ts";
import type { LiveHint } from "#live.ts";
import type { QuerySubscription } from "#querySubscription.ts";
import { QueryReadDenied } from "#readPolicyErrors.ts";

export const makeLiveServer = Effect.gen(function* () {
	const reactivity = yield* Reactivity.Reactivity;
	let openStreams = 0;
	const resyncKey = `@shivaedev/contract/resync/${crypto.randomUUID()}`;
	function open(keys: readonly Key[], context?: KeyContext) {
		return Stream.unwrap(
			Effect.gen(function* () {
				const queue = yield* Queue.unbounded<LiveHint>();
				const pending = new Map<string, Key>();
				let scheduled = false;
				let resync = false;
				let active = true;
				function flush() {
					if (scheduled) {
						return;
					}
					scheduled = true;
					queueMicrotask(() => {
						scheduled = false;
						if (active) {
							Queue.offerUnsafe(queue, resync ? { _tag: "Resync" } : { _tag: "Changed", keys: [...pending.values()] });
						}
						pending.clear();
						resync = false;
					});
				}
				const cancel = keys.map((key) => {
					const own = readKeys([key], context);
					return reactivity.registerUnsafe(own, () => {
						pending.set(own[0] ?? "", key);
						flush();
					});
				});
				cancel.push(
					reactivity.registerUnsafe([resyncKey], () => {
						resync = true;
						flush();
					}),
				);
				openStreams += 1;
				yield* Effect.addFinalizer(() =>
					Effect.sync(() => {
						active = false;
						openStreams -= 1;
						for (const stop of cancel) {
							stop();
						}
					}),
				);
				yield* Queue.offer(queue, { _tag: "Resync" });
				return Stream.fromQueue(queue);
			}),
		);
	}
	const resync = Effect.sync(() => {
		reactivity.invalidateUnsafe([resyncKey]);
		return openStreams;
	});
	return {
		resync,
		stream: (keys: readonly Key[], context?: KeyContext) => open(keys, context),
		subscribe: (subscription: QuerySubscription, context?: KeyContext) =>
			open(subscription.keys, context).pipe(
				Stream.mapEffect((hint) =>
					Effect.flatMap(subscription.authorized, (allowed) =>
						allowed
							? Effect.succeed(hint._tag === "Resync" ? hint : changedHint(hint.keys, subscription.scopes))
							: Effect.fail(new QueryReadDenied({ message: "Read no longer allowed for subscribed queries" })),
					),
				),
				Stream.filter((hint) => hint._tag === "Resync" || hint.keys.length > 0),
			),
	};
});
