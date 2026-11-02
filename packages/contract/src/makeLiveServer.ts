import { Effect, Queue, Random, Stream } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { type Key, type KeyContext, readKeys } from "@shivaedev/changes/keys.ts";
import { compareQueries } from "#internal/compareQueries.ts";
import { liveHintQueue } from "#internal/liveHintQueue.ts";
import type { LiveHint } from "#live.ts";
import type { QueryRerun, QuerySubscription } from "#querySubscription.ts";
import type { QueryUpdate, SubscriptionHint } from "#queryUpdate.ts";
import { QueryReadDenied } from "#readPolicyErrors.ts";

export const makeLiveServer = Effect.gen(function* () {
	const reactivity = yield* Reactivity.Reactivity;
	let openStreams = 0;
	const resyncKey = `@shivaedev/contract/resync/${yield* Random.nextInt}`;
	function open(keys: readonly Key[], context?: KeyContext, globalKeys: readonly Key[] = []): Stream.Stream<LiveHint> {
		return Stream.unwrap(
			Effect.gen(function* () {
				const { offer, queue } = yield* liveHintQueue;
				const pending = new Map<string, Key>();
				let scheduled = false;
				let resync = false;
				let active = true;
				const global = new Set(readKeys(globalKeys));
				function flush() {
					if (scheduled) {
						return;
					}
					scheduled = true;
					queueMicrotask(() => {
						scheduled = false;
						if (active) {
							offer(resync ? { _tag: "Resync" } : { _tag: "Changed", keys: [...pending.values()] });
						}
						pending.clear();
						resync = false;
					});
				}
				const cancel = keys.map((key) => {
					const bare = readKeys([key]);
					const own = global.has(bare[0] ?? "") ? bare : readKeys([key], context);
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
	function subscribe<E, R>(subscription: QuerySubscription<E, R>, context?: KeyContext): Stream.Stream<SubscriptionHint, E | QueryReadDenied, R>;
	function subscribe<E, R>(
		subscription: QuerySubscription<E, R>,
		context: KeyContext | undefined,
		read: QueryRerun<E, R>,
	): Stream.Stream<QueryUpdate, E | QueryReadDenied, R>;
	function subscribe<E, R>(subscription: QuerySubscription<E, R>, context?: KeyContext, read?: QueryRerun<E, R>) {
		return Stream.unwrap(
			Effect.sync(() => {
				let compare = compareQueries(subscription, read);
				const next = Effect.fnUntraced(function* (hint: LiveHint) {
					if (!(yield* subscription.authorized)) {
						compare = compareQueries(subscription, read);
						return [new QueryReadDenied({ message: "Read no longer allowed for subscribed queries" })];
					}
					return yield* compare(hint);
				});
				return open(subscription.keys, context, subscription.globalKeys).pipe(
					Stream.mapEffect((hint) =>
						Effect.flatMap(subscription.refresh ?? Effect.context<never>(), (current) => Effect.provideContext(next(hint), current)),
					),
					Stream.flatMap(Stream.fromIterable),
				);
			}),
		);
	}
	return { resync, stream: open, subscribe };
});
