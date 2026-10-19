import { Effect, Queue, Stream } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { makeHintPolicy } from "#internal/makeHintPolicy.ts";
import { type Key, readKeys } from "./keys.ts";
import type { LiveHint } from "./live.ts";

export const makeLiveServer = Effect.gen(function* () {
	const reactivity = yield* Reactivity.Reactivity;
	const resyncKey = `@shivaedev/effect-contract/resync/${crypto.randomUUID()}`;
	function stream(keys: readonly Key[]) {
		return Stream.unwrap(
			Effect.gen(function* () {
				const queue = yield* Queue.unbounded<LiveHint>();
				const allowedKeys = yield* makeHintPolicy(keys.length, (retryKeys) =>
					Queue.offer(queue, { _tag: "Changed", keys: retryKeys }).pipe(Effect.asVoid),
				);
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
					const own = readKeys([key]);
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
				yield* Effect.addFinalizer(() =>
					Effect.sync(() => {
						active = false;
						for (const stop of cancel) {
							stop();
						}
					}),
				);
				yield* Queue.offer(queue, { _tag: "Resync" });
				return Stream.fromQueue(queue).pipe(
					Stream.mapEffect((hint) =>
						hint._tag === "Resync"
							? Effect.succeed(hint)
							: Effect.map(allowedKeys(hint.keys), (allowed): LiveHint => ({ _tag: "Changed", keys: allowed })),
					),
					Stream.filter((hint) => hint._tag === "Resync" || hint.keys.length > 0),
				);
			}),
		);
	}
	const resync = Effect.sync(() => {
		reactivity.invalidateUnsafe([resyncKey]);
	});
	return { resync, stream };
});
