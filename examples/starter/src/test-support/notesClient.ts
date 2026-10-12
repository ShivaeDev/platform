import { Effect } from "effect";
import * as AtomRpc from "effect/unstable/reactivity/AtomRpc";
import { RpcTest } from "effect/unstable/rpc";
import { bind } from "@shivaedev/effect-contract/bind.ts";
import { Create, Notes } from "#notes.ts";

export function notesClient() {
	const rows: { id: number; title: string }[] = [];
	const calls: string[] = [];
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
		protocol: handlers,
	}) {}
	return { api: bind(Notes, Client), calls, runtime: Client.runtime };
}
