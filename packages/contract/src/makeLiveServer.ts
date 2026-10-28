import { Effect, Queue, Stream } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { type Key, type KeyContext, readKeys } from "@shivaedev/changes/keys.ts";
import { changedHint } from "#internal/queryHints.ts";
import type { LiveHint } from "#live.ts";
import type { QuerySubscription } from "#querySubscription.ts";

export const makeLiveServer = Effect.gen(function* () {
	const reactivity = yield* Reactivity.Reactivity;
	let openStreams = 0;
	const resyncKey = `@shivaedev/contract/resync/${crypto.randomUUID()}`;
	function open(keys: readonly Key[], context?: KeyContext, subscription?: QuerySubscription) {
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
				function authorizeHint(hint: LiveHint) {
					if (hint._tag === "Resync") {
						return Effect.succeed(hint);
					}
					return Effect.map(subscription?.authorized ?? Effect.succeed(true), (allowed) =>
						changedHint(allowed ? hint.keys : [], subscription?.scopes),
					);
				}
				return Stream.fromQueue(queue).pipe(
					Stream.mapEffect(authorizeHint),
					Stream.filter((hint) => hint._tag === "Resync" || hint.keys.length > 0),
				);
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
		subscribe: (subscription: QuerySubscription, context?: KeyContext) => open(subscription.keys, context, subscription),
	};
});
