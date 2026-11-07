import { Effect, Stream } from "effect";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { bind } from "@shivaedev/contract/bind.ts";
import { Rows } from "#test/batch-undo/contract.ts";
import { makeStore } from "#test/batch-undo/makeStore.ts";

export const makeClient = Effect.gen(function* () {
	const store = yield* makeStore;
	const handlers = Rows.toLayer({
		"batchUndo.$changes": () => Stream.never,
		"batchUndo.change": store.change,
		"batchUndo.list": store.list,
	});
	class Client extends AtomRpc.Service<Client>()("@shivaedev/react/test/BatchUndo", {
		group: Rows,
		makeEffect: RpcTest.makeClient(Rows, { flatten: true }),
		protocol: handlers,
	}) {}
	return { api: bind(Rows, Client, { live: false }), runtime: Client.runtime };
});
export type Client = Effect.Success<typeof makeClient>;
