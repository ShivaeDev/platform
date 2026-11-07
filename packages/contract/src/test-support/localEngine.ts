import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import type * as Reactivity from "effect/reactivity/Reactivity";
import { RpcTest } from "effect/rpc";
import { bind } from "#bind.ts";
import { Notes } from "#test/notes.ts";
import { notesServer } from "#test/notesServer.ts";
import { storyRuntime } from "#test/storyRuntime.ts";

export const localEngine = Effect.gen(function* () {
	const server = yield* notesServer;
	const runtime = yield* storyRuntime;
	class Client extends AtomRpc.Service<Client>()("test/NotesClient", {
		group: Notes,
		makeEffect: RpcTest.makeClient(Notes, { flatten: true }),
		protocol: server.layer,
		runtime,
	}) {}
	const api = bind(Notes, Client);
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(current) => Effect.sync(() => current.dispose()),
	);
	function run<A, E>(effect: Effect.Effect<A, E, Client | Reactivity.Reactivity>) {
		return AtomRegistry.getResult(registry, Client.runtime.atom(effect));
	}
	return { api, registry, run, runtime, server };
});

export type LocalEngine = Effect.Success<typeof localEngine>;
