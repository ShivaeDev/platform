import { Effect, Layer } from "effect";
import { RpcClient } from "effect/rpc";
import { SqlClient } from "effect/sql";
import { layerMemoryProtocol } from "@shivaedev/test-kits/contract/testing.ts";
import { moduleHandlers } from "#moduleHandlers.ts";
import { makeNotes, Notes, StaleNotes } from "#test/stale-writes/fixture.ts";

export type Writer = "alice" | "bob";

export const engine = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const handlers = moduleHandlers(Notes).pipe(Layer.provide(Layer.succeed(StaleNotes, yield* makeNotes)));
	const connect = Effect.flatMap(Layer.build(layerMemoryProtocol(Notes.application).pipe(Layer.provide(handlers))), (context) =>
		RpcClient.make(Notes.application, { flatten: true }).pipe(Effect.provideContext(context)),
	);
	const clients = { alice: yield* connect, bob: yield* connect };
	const read: Record<Writer, number> = { alice: -1, bob: -1 };
	const stored = Effect.orDie(sql<{ title: string; version: number }>`select title, version from stale_notes where id = 1`);
	return { clients, read, stored };
});
