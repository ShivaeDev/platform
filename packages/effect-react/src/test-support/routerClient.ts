import { Deferred, Effect, Schema } from "effect";
import * as AtomRpc from "effect/unstable/reactivity/AtomRpc";
import { RpcTest } from "effect/unstable/rpc";
import { bind } from "@shivaedev/effect-contract/bind.ts";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { query } from "@shivaedev/effect-contract/operation.ts";

export class NoteMissing extends Schema.TaggedError<NoteMissing>()("NoteMissing", { id: Schema.String }) {}
const Get = query("get", {
	payload: { id: Schema.String },
	reads: () => [],
	rejections: { NoteMissing },
	success: Schema.Struct({ id: Schema.String, title: Schema.String }),
});
const Notes = contract("routerNotes", { queries: [Get] });

export function routerClient() {
	const calls: string[] = [];
	let builds = 0;
	const gates = new Map<string, Deferred.Deferred<{ readonly id: string; readonly title: string }, NoteMissing>>();
	function gate(id: string) {
		let value = gates.get(id);
		if (value === undefined) {
			value = Effect.runSync(Deferred.make<{ readonly id: string; readonly title: string }, NoteMissing>());
			gates.set(id, value);
		}
		return value;
	}
	const handlers = Notes.toLayer(
		Effect.sync(() => {
			builds += 1;
			return Notes.of({
				"routerNotes.get": ({ id }) => {
					calls.push(id);
					return Deferred.await(gate(id));
				},
			});
		}),
	);
	class Client extends AtomRpc.Service<Client>()("test/RouterNotes", {
		group: Notes,
		makeEffect: RpcTest.makeClient(Notes, { flatten: true }),
		protocol: handlers,
	}) {}
	return { api: bind(Notes, Client), builds: () => builds, calls, gate };
}
