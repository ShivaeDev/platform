import { Effect, Stream } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { type Key, readKeys } from "./keys.ts";
import type { LiveHint } from "./live.ts";

export const makeLiveServer = Effect.gen(function* () {
	const reactivity = yield* Reactivity.Reactivity;
	const resyncKey = `@shivaedev/effect-contract/resync/${crypto.randomUUID()}`;
	let generation = 0;
	function stream(keys: readonly Key[]) {
		return Stream.unwrap(
			Effect.sync(() => {
				let seen = -1;
				return reactivity.stream(
					[...readKeys(keys), resyncKey],
					Effect.sync((): LiveHint => {
						if (seen !== generation) {
							seen = generation;
							return { _tag: "Resync" };
						}
						return { _tag: "Changed", keys };
					}),
				);
			}),
		);
	}
	const resync = Effect.sync(() => {
		generation += 1;
		reactivity.invalidateUnsafe([resyncKey]);
	});
	return { resync, stream };
});
