import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcTest } from "effect/rpc";
import { bind } from "#bind.ts";
import { Notes } from "./notes.ts";
import { notesServer } from "./notesServer.ts";

export const localEngine = Effect.gen(function* () {
	const server = yield* notesServer;
	class Client extends AtomRpc.Service<Client>()("test/NotesClient", {
		group: Notes,
		makeEffect: RpcTest.makeClient(Notes, { flatten: true }),
		protocol: server.layer,
	}) {}
	const api = bind(Notes, Client);
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(current) => Effect.sync(() => current.dispose()),
	);
	const invalidations: Parameters<typeof Reactivity.invalidate>[0][] = [];
	function run<A, E>(effect: Effect.Effect<A, E, Client | Reactivity.Reactivity>) {
		const observed = Effect.updateService(effect, Reactivity.Reactivity, (reactivity) => ({
			...reactivity,
			invalidate: (keys) =>
				Effect.andThen(
					Effect.sync(() => {
						invalidations.push(keys);
					}),
					reactivity.invalidate(keys),
				),
		}));
		return AtomRegistry.getResult(registry, Client.runtime.atom(observed));
	}
	return { api, invalidations, registry, run, server };
});

export type LocalEngine = Effect.Success<typeof localEngine>;
