import { Deferred, Effect, Schema, Stream } from "effect";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { bind } from "@shivaedev/effect-contract/bind.ts";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { collection } from "@shivaedev/effect-contract/keys.ts";
import { query } from "@shivaedev/effect-contract/operation.ts";
import type { ResumeSource } from "#resumeSignal.ts";

const notes = collection("resumeNotes", Schema.Number);
const Notes = contract("resumeNotes", {
	queries: [query("get", { payload: { id: Schema.Number }, reads: ({ id }) => [notes.item(id)], success: Schema.String })],
});

export function resumeLiveClient(resume?: ResumeSource) {
	const titles = new Map([
		[1, "One"],
		[2, "Two"],
	]);
	let connections = 0;
	let active = 0;
	let ended = Effect.runSync(Deferred.make<void>());
	const handlers = Notes.toLayer({
		"resumeNotes.$changes": () =>
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
		"resumeNotes.get": ({ id }) => Effect.sync(() => titles.get(id) ?? "Missing"),
	});
	class Client extends AtomRpc.Service<Client>()("test/ResumeNotes", {
		group: Notes,
		makeEffect: RpcTest.makeClient(Notes, { flatten: true }),
		protocol: handlers,
	}) {}
	return {
		active: () => active,
		api: bind(Notes, Client, resume === undefined ? {} : { resume }),
		connections: () => connections,
		disconnect: () => {
			const previous = ended;
			ended = Effect.runSync(Deferred.make<void>());
			return Effect.runPromise(Deferred.succeed(previous, undefined));
		},
		rename: (id: number, title: string) => titles.set(id, title),
	};
}
