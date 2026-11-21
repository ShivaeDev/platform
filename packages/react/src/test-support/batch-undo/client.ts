import { Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";
import { clientActivity } from "@shivaedev/contract/clientActivity.ts";
import { makeClient as makeRpcClient } from "@shivaedev/contract/makeClient.ts";
import { layerLiveMemoryProtocol } from "@shivaedev/test-kits/contract/liveMemoryProtocol.ts";
import { BatchRows, Change, List, Rows } from "#test/batch-undo/contract.ts";
import { makeStore } from "#test/batch-undo/makeStore.ts";
import { storyRuntime } from "#test/storyRuntime.ts";

export const makeClient = Effect.gen(function* () {
	const database = yield* SqlClient.SqlClient;
	// The store is built on the live host's Reactivity, so its repository's commits reach the host's change channel.
	const store = Layer.effect(BatchRows, makeStore).pipe(Layer.provide(Layer.succeed(SqlClient.SqlClient, database)));
	const handlers = Rows.application
		.toLayer({
			"batchUndo.change": Change.run,
			"batchUndo.list": List.run,
		})
		.pipe(Layer.provide(store));
	const connection = makeRpcClient(
		{ rows: Rows },
		{
			protocol: layerLiveMemoryProtocol(Rows, handlers),
			runtime: yield* storyRuntime,
			url: "memory://batch-undo",
		},
	);
	return { activity: clientActivity(connection), api: connection.api.rows, runtime: connection.runtime };
});
export type Client = Effect.Success<typeof makeClient>;
