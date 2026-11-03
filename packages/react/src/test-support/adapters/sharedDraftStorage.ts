import { Deferred, Effect } from "effect";
import type { DraftStorage } from "@shivaedev/form/persistence.ts";

export function sharedDraftStorage() {
	let heldRead: { readonly release: Deferred.Deferred<void>; readonly finished: Deferred.Deferred<void> } | undefined;
	let heldWrite:
		| { readonly release: Deferred.Deferred<void>; readonly written: Deferred.Deferred<void>; readonly cleared: Deferred.Deferred<void> }
		| undefined;
	const saved = new Map<string, string>();
	const listeners = new Map<string, Set<(raw: string | null) => void>>();
	function changed(key: string, raw: string | null) {
		for (const listener of listeners.get(key) ?? []) {
			listener(raw);
		}
	}
	const storage: DraftStorage = {
		getItem: (key) =>
			Effect.gen(function* () {
				const raw = yield* Effect.promise(() => Promise.resolve(saved.get(key) ?? null));
				const held = heldRead;
				if (held) {
					yield* Deferred.await(held.release);
					yield* Deferred.succeed(held.finished, undefined);
				}
				return raw;
			}),
		removeItem: (key, expected) =>
			Effect.promise(async () => {
				await Promise.resolve();
				if (saved.get(key) === expected) {
					saved.delete(key);
					changed(key, null);
				}
				if (heldWrite) {
					Effect.runSync(Deferred.succeed(heldWrite.cleared, undefined));
				}
			}),
		setItem: (key, raw, expected) =>
			Effect.gen(function* () {
				const held = heldWrite;
				if (held) {
					yield* Deferred.await(held.release);
				}
				yield* Effect.promise(async () => {
					await Promise.resolve();
					if (expected === undefined || saved.get(key) === expected) {
						saved.set(key, raw);
						changed(key, raw);
					}
				});
				if (held) {
					yield* Deferred.succeed(held.written, undefined);
				}
			}),
		subscribe: (key, listener) => {
			const subscribers = listeners.get(key) ?? new Set();
			listeners.set(key, subscribers);
			subscribers.add(listener);
			return () => subscribers.delete(listener);
		},
	};
	return {
		finishRead: () =>
			Effect.suspend(() => {
				const held = heldRead;
				if (!held) {
					return Effect.die(new Error("No draft read is held"));
				}
				heldRead = undefined;
				return Deferred.succeed(held.release, undefined).pipe(Effect.andThen(Deferred.await(held.finished)));
			}),
		finishWrite: () =>
			Effect.suspend(() => {
				const held = heldWrite;
				if (!held) {
					return Effect.die(new Error("No draft write is held"));
				}
				return Deferred.succeed(held.release, undefined).pipe(
					Effect.andThen(Deferred.await(held.written)),
					Effect.andThen(Deferred.await(held.cleared)),
				);
			}),
		holdRead: () => {
			heldRead = { finished: Deferred.makeUnsafe(), release: Deferred.makeUnsafe() };
		},
		holdWrite: () => {
			heldWrite = { cleared: Deferred.makeUnsafe(), release: Deferred.makeUnsafe(), written: Deferred.makeUnsafe() };
		},
		storage,
	};
}
