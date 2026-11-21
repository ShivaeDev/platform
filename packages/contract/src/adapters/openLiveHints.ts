import { Effect, Queue, Ref, Stream } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { type Key, readKeys } from "@shivaedev/changes/keys.ts";
import { LiveDispatcher } from "#LiveDispatcher.ts";
import type { initialize } from "#live-server/initialize.ts";
import { liveHintQueue } from "#liveHintQueue.ts";

export const openLiveHints = Effect.fn("LiveServer.openLiveHints")(function* (
	state: Effect.Success<typeof initialize>,
	keys: readonly Key[],
	syncClient?: string,
) {
	const reactivity = yield* Reactivity.Reactivity;
	const { openStreams, resyncKey, syncClients } = state;
	const { dispatcher } = yield* LiveDispatcher;
	const { offer, queue } = yield* liveHintQueue;
	const pending = new Map<string, Key>();
	const synced = new Set<number>();
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
				const tokens = synced.size === 0 ? {} : { synced: [...synced] };
				offer(resync ? { _tag: "Resync", ...tokens } : { _tag: "Changed", keys: [...pending.values()], ...tokens });
			}
			pending.clear();
			synced.clear();
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
	// The token joins the keys already waiting for the flush, so it stays behind every rerun they cause.
	function sync(id: number) {
		synced.add(id);
		flush();
	}
	if (syncClient !== undefined) {
		syncClients.set(syncClient, (syncClients.get(syncClient) ?? new Set()).add(sync));
		cancel.push(() => {
			const subscriptions = syncClients.get(syncClient);
			subscriptions?.delete(sync);
			if (subscriptions?.size === 0) {
				syncClients.delete(syncClient);
			}
		});
	}
	yield* Ref.update(openStreams, (count) => count + 1);
	yield* Effect.addFinalizer(() =>
		Effect.sync(() => {
			active = false;
			for (const stop of [...cancelKeys, ...cancel]) {
				stop();
			}
		}).pipe(Effect.andThen(Ref.update(openStreams, (count) => count - 1))),
	);
	yield* Queue.offer(queue, { _tag: "Resync" });
	return { replaceKeys, stream: Stream.fromQueue(queue) };
});
