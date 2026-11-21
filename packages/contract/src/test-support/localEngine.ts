import { Effect, Layer } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as Reactivity from "effect/reactivity/Reactivity";
import { layerMemoryProtocol } from "@shivaedev/test-kits/contract/testing.ts";
import { type ContractsClient, makeClient } from "#makeClient.ts";
import { Notes } from "#test/notes.ts";
import { notesServer } from "#test/notesServer.ts";
import { storyRuntime } from "#test/storyRuntime.ts";

export const localEngine = Effect.gen(function* () {
	const server = yield* notesServer;
	const runtime = yield* storyRuntime;
	const connection = makeClient({ notes: Notes }, { protocol: layerMemoryProtocol(Notes).pipe(Layer.provide(server.layer)), runtime });
	const api = connection.api.notes;
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(current) => Effect.sync(() => current.dispose()),
	);
	function run<A, E>(effect: Effect.Effect<A, E, ContractsClient | Reactivity.Reactivity>) {
		return AtomRegistry.getResult(registry, connection.runtime.atom(effect));
	}
	return { api, registry, run, runtime, server };
});

export type LocalEngine = Effect.Success<typeof localEngine>;
