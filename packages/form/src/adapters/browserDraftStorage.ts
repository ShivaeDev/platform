import { Effect, Layer } from "effect";
import { DraftStorageProvider } from "#persistence.ts";

function mutate(key: string, run: () => void) {
	const locks = globalThis.navigator?.locks;
	return locks ? Effect.promise(() => locks.request(`@shivaedev/form/${key}`, run)) : run();
}

export const browserDraftStorage = Layer.succeed(DraftStorageProvider, () => ({
	getItem: (key) => globalThis.localStorage.getItem(key),
	removeItem: (key, expected) =>
		mutate(key, () => {
			if (globalThis.localStorage.getItem(key) === expected) {
				globalThis.localStorage.removeItem(key);
			}
		}),
	setItem: (key, value, expected) =>
		mutate(key, () => {
			if (expected === undefined || globalThis.localStorage.getItem(key) === expected) {
				globalThis.localStorage.setItem(key, value);
			}
		}),
	subscribe: (key, listener) => {
		function changed(event: StorageEvent) {
			if (event.storageArea === globalThis.localStorage && (event.key === key || event.key === null)) {
				listener(event.newValue);
			}
		}
		globalThis.addEventListener("storage", changed);
		return () => globalThis.removeEventListener("storage", changed);
	},
}));
