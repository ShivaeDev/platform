import { Effect, Queue, Random, Scheduler, Stream } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { type Key, readKeys } from "@shivaedev/changes/keys.ts";
import { compareQueries } from "#compareQueries.ts";
import type { LiveHint } from "#live.ts";
import { liveHintQueue } from "#liveHintQueue.ts";
import type { QueryRerun, QuerySubscription } from "#querySubscription.ts";
import type { QueryUpdate, SubscriptionHint } from "#queryUpdate.ts";
import { QueryReadDenied } from "#readPolicyErrors.ts";

export const makeLiveServer = Effect.gen(function* () {
	const reactivity = yield* Reactivity.Reactivity;
	const dispatcher = (yield* Scheduler.Scheduler).makeDispatcher();
	let openStreams = 0;
	const resyncKey = `@shivaedev/contract/resync/${yield* Random.nextInt}`;
	function open(keys: readonly Key[]) {
		return Effect.gen(function* () {
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
				dispatcher.scheduleTask(() => {
					scheduled = false;
					if (active) {
						offer(resync ? { _tag: "Resync" } : { _tag: "Changed", keys: [...pending.values()] });
					}
					pending.clear();
					resync = false;
				}, 0);
			}
			let cancelKeys: (() => void)[] = [];
			function replaceKeys(current: readonly Key[]) {
				for (const stop of cancelKeys) {
					stop();
				}
				cancelKeys = current.map((key) => {
					const own = readKeys([key]);
					return reactivity.registerUnsafe(own, () => {
						pending.set(own[0] ?? "", key);
						flush();
					});
				});
			}
			replaceKeys(keys);
			const cancel = [
				reactivity.registerUnsafe([resyncKey], () => {
					resync = true;
					flush();
				}),
			];
			openStreams += 1;
			yield* Effect.addFinalizer(() =>
				Effect.sync(() => {
					active = false;
					openStreams -= 1;
					for (const stop of [...cancelKeys, ...cancel]) {
						stop();
					}
				}),
			);
			yield* Queue.offer(queue, { _tag: "Resync" });
			return { replaceKeys, stream: Stream.fromQueue(queue) };
		});
	}
	const resync = Effect.sync(() => {
		reactivity.invalidateUnsafe([resyncKey]);
		return openStreams;
	});
	function subscribe<E, R>(subscription: QuerySubscription<E, R>): Stream.Stream<SubscriptionHint, E | QueryReadDenied, R>;
	function subscribe<E, R>(subscription: QuerySubscription<E, R>, read: QueryRerun<E, R>): Stream.Stream<QueryUpdate, E | QueryReadDenied, R>;
	function subscribe<E, R>(subscription: QuerySubscription<E, R>, read?: QueryRerun<E, R>) {
		return Stream.unwrap(
			Effect.gen(function* () {
				const registration = yield* open(subscription.keys);
				let scopes = subscription.scopes;
				let compare = compareQueries(subscription, read);
				const next = Effect.fnUntraced(function* (hint: LiveHint) {
					if (!(yield* subscription.authorized)) {
						compare = compareQueries(subscription, read);
						return [new QueryReadDenied({ message: "Read no longer allowed for subscribed queries" })];
					}
					const updates = yield* compare(hint, scopes);
					if (subscription.readScopes !== undefined) {
						scopes = yield* subscription.readScopes;
						registration.replaceKeys(scopes.flat());
					}
					return updates;
				});
				return registration.stream.pipe(
					Stream.mapEffect((hint) =>
						Effect.flatMap(subscription.refresh ?? Effect.context<never>(), (current) => Effect.provideContext(next(hint), current)),
					),
					Stream.flatMap(Stream.fromIterable),
				);
			}),
		);
	}
	return { resync, stream: (keys: readonly Key[]) => Stream.unwrap(Effect.map(open(keys), ({ stream }) => stream)), subscribe };
});
