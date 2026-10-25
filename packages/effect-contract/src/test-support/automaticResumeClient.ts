import { Deferred, Effect, Layer, Stream } from "effect";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { bind } from "#bind.ts";
import type { ResumeSource } from "#resume.ts";
import { Notes } from "./notes.ts";
import type { notesServer } from "./notesServer.ts";

export function automaticResumeClient(server: Effect.Success<typeof notesServer>, resume?: ResumeSource) {
	let connections = 0;
	let active = 0;
	let ended = Effect.runSync(Deferred.make<void>());
	const handlers = Notes.toLayer({
		...server.implementation,
		"notes.$changes": () =>
			Stream.unwrap(
				Effect.gen(function* () {
					connections += 1;
					active += 1;
					yield* Effect.addFinalizer(() =>
						Effect.sync(() => {
							active -= 1;
						}),
					);
					return Stream.concat(Stream.succeed({ _tag: "Resync" } as const), Stream.drain(Stream.fromEffect(Deferred.await(ended))));
				}),
			),
	});
	class Client extends AtomRpc.Service<Client>()("test/AutomaticResume", {
		group: Notes,
		makeEffect: RpcTest.makeClient(Notes, { flatten: true }),
		protocol: Layer.merge(handlers, server.guard),
	}) {}
	return {
		active: () => active,
		api: bind(Notes, Client, resume === undefined ? {} : { resume }),
		connections: () => connections,
		disconnect: () => {
			const previous = ended;
			ended = Effect.runSync(Deferred.make<void>());
			return Deferred.succeed(previous, undefined);
		},
	};
}
