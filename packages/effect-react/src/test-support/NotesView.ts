import { Effect, Option, Ref, Schema } from "effect";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { createElement } from "react";
import { bind } from "@shivaedev/effect-contract/bind.ts";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { collection } from "@shivaedev/effect-contract/keys.ts";
import { command, query } from "@shivaedev/effect-contract/operation.ts";
import { useAction, useQuery } from "#result-state.ts";

const notes = collection("notes", Schema.Number);
const List = query("list", { reads: () => [notes.list], success: Schema.Array(Schema.String) });
const Add = command("add", { invalidates: () => [notes.list], payload: { title: Schema.String } });
const Notes = contract("notes", { commands: [Add], queries: [List] });
const handlers = Notes.toLayer(
	Effect.gen(function* () {
		const stored = yield* Ref.make<readonly string[]>([]);
		return Notes.of({
			"notes.add": ({ title }) => Ref.update(stored, (all) => [...all, title]),
			"notes.list": () => Ref.get(stored).pipe(Effect.delay("20 millis")),
		});
	}),
);
class Client extends AtomRpc.Service<Client>()("test/Notes", {
	group: Notes,
	makeEffect: RpcTest.makeClient(Notes, { flatten: true }),
	protocol: handlers,
}) {}
const api = bind(Notes, Client);
const add = Client.runtime.fn(api.add.run);
export function NotesView() {
	const list = useQuery(api.list.query());
	const action = useAction(add);
	return createElement(
		"section",
		null,
		createElement("output", null, Option.getOrElse(list.data, () => []).join(", ")),
		createElement(
			"button",
			{
				disabled: list.pending || action.pending,
				onClick: () => action.dispatch({ title: "Morning walk" }),
				type: "button",
			},
			"Add",
		),
	);
}
