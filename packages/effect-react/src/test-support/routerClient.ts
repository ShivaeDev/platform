import { Deferred, Effect, Schema, Stream } from "effect";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { bind } from "@shivaedev/effect-contract/bind.ts";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { query } from "@shivaedev/effect-contract/operation.ts";

export class NotFound extends Schema.TaggedError<NotFound>()("NotFound", { id: Schema.String }) {}
export class NoteMissing extends Schema.TaggedError<NoteMissing>()("NoteMissing", { id: Schema.String }) {}
const Get = query("get", {
	payload: { id: Schema.String, page: Schema.Number },
	reads: () => [],
	rejections: { NoteMissing, NotFound },
	success: Schema.Struct({ id: Schema.String, title: Schema.String }),
});
const Notes = contract("routerNotes", { queries: [Get] });

export function routerClient() {
	const frames: string[] = [];
	const calls: { readonly id: string; readonly page: number }[] = [];
	let builds = 0;
	const gates = new Map<string, Deferred.Deferred<{ readonly id: string; readonly title: string }, NotFound | NoteMissing>>();
	function gate(id: string, page = 1) {
		let value = gates.get(`${id}:${page}`);
		if (value === undefined) {
			value = Effect.runSync(Deferred.make<{ readonly id: string; readonly title: string }, NotFound | NoteMissing>());
			gates.set(`${id}:${page}`, value);
		}
		return value;
	}
	const handlers = Notes.toLayer(
		Effect.sync(() => {
			builds += 1;
			return Notes.of({
				"routerNotes.$changes": () => Stream.never,
				"routerNotes.get": ({ id, page }) => {
					calls.push({ id, page });
					return Deferred.await(gate(id, page));
				},
			});
		}),
	);
	class Client extends AtomRpc.Service<Client>()("test/RouterNotes", {
		group: Notes,
		makeEffect: RpcTest.makeClient(Notes, { flatten: true }),
		protocol: handlers,
	}) {}
	return { api: bind(Notes, Client), builds: () => builds, calls, frames, gate };
}
