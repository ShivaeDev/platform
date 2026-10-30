import { Deferred, Effect, Schema, Stream } from "effect";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { bind } from "@shivaedev/contract/bind.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { query } from "@shivaedev/contract/operation.ts";

export class NotFound extends Schema.TaggedError<NotFound>()("NotFound", { id: Schema.String }) {}
export class NoteMissing extends Schema.TaggedError<NoteMissing>()("NoteMissing", { id: Schema.String }) {}
const Get = query("get", {
	payload: { id: Schema.String, page: Schema.Number },
	readPolicy: () => Effect.succeed(true),
	reads: () => [],
	rejections: { NoteMissing, NotFound },
	success: Schema.Struct({ id: Schema.String, title: Schema.String }),
});
const Notes = contract("routerNotes", { queries: [Get] });

export function routerClient() {
	const frames: string[] = [];
	const calls: { readonly id: string; readonly page: number }[] = [];
	const waiting = new Set<{ readonly count: number; readonly arrived: () => void }>();
	function requestArrives(count: number) {
		return new Promise<void>((arrived) => {
			const waiter = { arrived, count };
			waiting.add(waiter);
			if (calls.length >= count) {
				waiting.delete(waiter);
				arrived();
			}
		});
	}
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
					for (const waiter of [...waiting]) {
						if (calls.length >= waiter.count) {
							waiting.delete(waiter);
							waiter.arrived();
						}
					}
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
	return {
		api: bind(Notes, Client, { live: false }),
		builds: () => builds,
		calls,
		frames,
		gate,
		next: (id: string, page = 1) => gates.delete(`${id}:${page}`),
		requestArrives,
	};
}
