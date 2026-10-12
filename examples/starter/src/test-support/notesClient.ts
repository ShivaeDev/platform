import { Effect, Layer } from "effect";
import * as AtomRpc from "effect/unstable/reactivity/AtomRpc";
import { RpcTest } from "effect/unstable/rpc";
import { bind } from "@shivaedev/effect-contract/bind.ts";
import { Unauthorized } from "@shivaedev/platform/errors/taxonomy.ts";
import { Identity } from "@shivaedev/platform/rpc/identity.ts";
import { Authenticated } from "@shivaedev/platform/rpc/middleware.ts";
import { Create, Notes } from "#notes.ts";

export function notesClient() {
	const rows: { id: number; title: string }[] = [];
	const calls: string[] = [];
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
						const row = { id: rows.length + 1, title: title.trim() };
						rows.unshift(row);
						return row;
					}),
		"notes.list": () =>
			Effect.sync(() => {
				calls.push("list");
				return [...rows];
			}),
	});
	class Client extends AtomRpc.Service<Client>()("starter/NotesClient", {
		group: Notes,
		makeEffect: RpcTest.makeClient(Notes, { flatten: true }),
		protocol: handlers.pipe(Layer.provideMerge(authentication)),
	}) {}
	return { api: bind(Notes, Client), calls, runtime: Client.runtime, session };
}
