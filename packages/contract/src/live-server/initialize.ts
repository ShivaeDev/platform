import { Effect, Random, Ref } from "effect";

export const initialize = Effect.gen(function* () {
	const openStreams = yield* Ref.make(0);
	const resyncKey = `@shivaedev/contract/resync/${yield* Random.nextInt}`;
	const syncClients = new Map<string, Set<(id: number) => void>>();
	return { openStreams, resyncKey, syncClients };
});
