import { Context, Effect, Queue, Stream } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { type Key, type KeyContext, readKeys } from "@shivaedev/changes/keys.ts";
import { compareQueries } from "#internal/compareQueries.ts";
import { liveHintQueue } from "#internal/liveHintQueue.ts";
import type { LiveHint } from "#live.ts";
import type { QueryRerun, QuerySubscription } from "#querySubscription.ts";
import type { QueryUpdate } from "#queryUpdate.ts";
import { QueryReadDenied } from "#readPolicyErrors.ts";

export const makeLiveServer = Effect.gen(function* () {
	const reactivity = yield* Reactivity.Reactivity;
	let openStreams = 0;
	const resyncKey = `@shivaedev/contract/resync/${crypto.randomUUID()}`;
	function open(keys: readonly Key[], context?: KeyContext): Stream.Stream<LiveHint> {
		return Stream.unwrap(
			Effect.gen(function* () {
				const { offer, queue } = yield* liveHintQueue;
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
							offer(resync ? { _tag: "Resync" } : { _tag: "Changed", keys: [...pending.values()] });
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
	function subscribe(subscription: QuerySubscription, context?: KeyContext): Stream.Stream<LiveHint, QueryReadDenied>;
	function subscribe(subscription: QuerySubscription, context: KeyContext | undefined, read: QueryRerun): Stream.Stream<QueryUpdate, unknown>;
	function subscribe(subscription: QuerySubscription, context?: KeyContext, read?: QueryRerun) {
		return Stream.unwrap(
			Effect.gen(function* () {
				const services = Context.makeUnsafe<unknown>((yield* Effect.context<never>()).mapUnsafe);
				const compare = compareQueries(subscription, read);
				const next = Effect.fnUntraced(function* (hint: LiveHint) {
					if (!(yield* subscription.authorized)) {
						return yield* new QueryReadDenied({ message: "Read no longer allowed for subscribed queries" });
					}
					return yield* Effect.provideContext(compare(hint), services);
				});
				return open(subscription.keys, context).pipe(Stream.mapEffect(next), Stream.flatMap(Stream.fromIterable));
			}),
		);
	}
	return { resync, stream: open, subscribe };
});
