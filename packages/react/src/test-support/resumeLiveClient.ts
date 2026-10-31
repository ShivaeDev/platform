import { Deferred, Effect, Schema, Stream } from "effect";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { collection } from "@shivaedev/changes/keys.ts";
import { bind } from "@shivaedev/contract/bind.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { query } from "@shivaedev/contract/operation.ts";
import type { ResumeSource } from "@shivaedev/contract/resume.ts";

const notes = collection("resumeNotes", Schema.Number);
const Notes = contract("resumeNotes", {
	queries: [
		query("get", {
			payload: { id: Schema.Number },
			readPolicy: () => Effect.succeed(true),
			reads: ({ id }) => [notes.item(id)],
			success: Schema.String,
		}),
	],
});

export function resumeLiveClient(resume?: ResumeSource) {
	const titles = new Map([
		[1, "One"],
		[2, "Two"],
	]);
	const subscriptions: { active: boolean }[] = [];
	let ended = Effect.runSync(Deferred.make<void>());
	const handlers = Notes.toLayer({
		"resumeNotes.$changes": () =>
			Stream.unwrap(
				Effect.gen(function* () {
					const subscription = { active: true };
					subscriptions.push(subscription);
					yield* Effect.addFinalizer(() =>
						Effect.sync(() => {
							subscription.active = false;
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
		active: () => subscriptions.filter((subscription) => subscription.active).length,
		api: bind(Notes, Client, resume === undefined ? {} : { resume }),
		disconnect: () => {
			const previous = ended;
			ended = Effect.runSync(Deferred.make<void>());
			return Effect.runPromise(Deferred.succeed(previous, undefined));
		},
		rename: (id: number, title: string) => titles.set(id, title),
		subscriptionStates: () => subscriptions.map((subscription) => (subscription.active ? "open" : "closed")),
	};
}
