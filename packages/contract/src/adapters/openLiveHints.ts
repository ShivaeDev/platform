import { Effect, Queue, Ref, Stream } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { type Key, readKeys } from "@shivaedev/changes/keys.ts";
import { LiveDispatcher } from "#adapters/LiveDispatcher.ts";
import type { initialize } from "#live-server/initialize.ts";
import { liveHintQueue } from "#liveHintQueue.ts";

export const openLiveHints = Effect.fn("LiveServer.openLiveHints")(function* (state: Effect.Success<typeof initialize>, keys: readonly Key[]) {
	const reactivity = yield* Reactivity.Reactivity;
	const { openStreams, resyncKey } = state;
	const { dispatcher } = yield* LiveDispatcher;
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
