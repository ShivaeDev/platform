import { Effect, Layer, PubSub, Stream } from "effect";
import * as AtomRpc from "effect/unstable/reactivity/AtomRpc";
import { RpcTest } from "effect/unstable/rpc";
import { bind } from "@shivaedev/effect-contract/bind.ts";
import { type LiveHint, live } from "@shivaedev/effect-contract/live.ts";
import { Unauthorized } from "@shivaedev/platform/errors/taxonomy.ts";
import { Identity } from "@shivaedev/platform/rpc/identity.ts";
import { Authenticated } from "@shivaedev/platform/rpc/middleware.ts";
import { Create, Notes, Subscribe } from "#notes.ts";

export function notesClient() {
	const rows: { id: number; title: string; wordCount: number | null }[] = [];
	const calls: string[] = [];
	const hints = Effect.runSync(PubSub.unbounded<LiveHint>());
	const session = { signedIn: true };
	const authentication = Layer.succeed(Authenticated, (effect) =>
		session.signedIn
			? Effect.provideService(effect, Identity, { id: "alice" })
			: Effect.fail(new Unauthorized({ message: "Authentication required" })),
	);
	const handlers = Notes.toLayer({
		"notes.create": ({ title }) =>
			title.trim() === "reserved"
				? Create.reject.Invalid({ field: "title", message: "Choose another title" })
				: Effect.sync(() => {
						calls.push("create");
						const row = { id: rows.length + 1, title: title.trim(), wordCount: null };
						rows.unshift(row);
						return row;
					}),
		"notes.list": () =>
			Effect.sync(() => {
				calls.push("list");
				return [...rows];
			}),
		"notes.subscribe": () => Stream.fromPubSub(hints),
	});
	class Client extends AtomRpc.Service<Client>()("starter/NotesClient", {
		group: Notes,
		makeEffect: RpcTest.makeClient(Notes, { flatten: true }),
		protocol: handlers.pipe(Layer.provideMerge(authentication)),
	}) {}
	const api = bind(Notes, Client);
	const subscription = live(Client.runtime, { resyncKeys: Subscribe.reads(undefined), stream: api.subscribe.run(undefined) });
	function finishNote(id: number, wordCount: number) {
		const row = rows.find((note) => note.id === id);
		if (row !== undefined) {
			row.wordCount = wordCount;
		}
		return Effect.runPromise(PubSub.publish(hints, { _tag: "Changed", keys: Subscribe.reads(undefined) }));
	}
	return { api, calls, finishNote, runtime: Client.runtime, session, ...subscription };
}
