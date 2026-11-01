import { Deferred, Effect, Layer, Option, Schema, Stream } from "effect";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcMiddleware, RpcTest } from "effect/rpc";
import { bind } from "@shivaedev/contract/bind.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { authorizeReads } from "@shivaedev/contract/readPolicy.ts";
import { MissingReadPolicy, QueryReadDenied } from "@shivaedev/contract/readPolicyErrors.ts";
import { Forbidden, NotFound, Unauthorized } from "@shivaedev/errors/taxonomy.ts";

export class NoteMissing extends Schema.TaggedError<NoteMissing>()("NoteMissing", { id: Schema.String }) {}
const Get = query("get", {
	payload: { id: Schema.String, page: Schema.Number },
	readPolicy: ({ id }) => Effect.succeed(id !== "refused"),
	reads: () => [],
	rejections: { Forbidden, NoteMissing, NotFound, Unauthorized },
	success: Schema.Struct({ id: Schema.String, title: Schema.String }),
});
class Guard extends RpcMiddleware.Service<Guard>()("test/RouterReadGuard", { error: Schema.Union([MissingReadPolicy, QueryReadDenied]) }) {}
const Notes = contract("routerNotes", { queries: [Get] }).middleware(Guard);
export type NoteFailure = Forbidden | NoteMissing | NotFound | Unauthorized;

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
	const gates = new Map<string, Deferred.Deferred<{ readonly id: string; readonly title: string }, NoteFailure>>();
	function gate(id: string, page = 1) {
		let value = gates.get(`${id}:${page}`);
		if (value === undefined) {
			value = Effect.runSync(Deferred.make<{ readonly id: string; readonly title: string }, NoteFailure>());
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
		protocol: Layer.merge(
			handlers,
			Layer.succeed(Guard, (effect, request) => authorizeReads(effect, request, Option.none())),
		),
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
