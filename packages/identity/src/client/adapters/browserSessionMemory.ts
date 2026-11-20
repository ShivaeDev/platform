import { Effect, Layer } from "effect";
import { SessionMemory, SessionMemoryUnavailable } from "#client/SessionMemory.ts";

const STORAGE_KEY = "@shivaedev/identity/session";

function storage<A>(run: (store: Storage) => A) {
	return Effect.try({
		catch: (cause) => new SessionMemoryUnavailable({ cause }),
		try: () => run(globalThis.localStorage),
	});
}

export const browserSessionMemory = Layer.succeed(SessionMemory, {
	clear: storage((store) => store.removeItem(STORAGE_KEY)),
	read: storage((store) => store.getItem(STORAGE_KEY)),
	write: (value) => storage((store) => store.setItem(STORAGE_KEY, value)),
});
