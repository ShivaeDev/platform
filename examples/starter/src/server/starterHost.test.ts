import { Effect, Layer, Result } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import { SqlClient } from "effect/unstable/sql";
import { expect } from "vitest";
import { Notes } from "#notes.ts";
import { effectApp } from "#test-support/postgres.ts";

effectApp("migrates PostgreSQL and creates and queries a persisted note over HTTP/NDJSON", function* ({ url }) {
	const protocol = RpcClient.layerProtocolHttp({ url }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]));
	const client = yield* RpcClient.make(Notes).pipe(Effect.provide(protocol));
	expect(yield* client["notes.list"]()).toEqual([]);
	const created = yield* client["notes.create"]({ title: "  First note  " });
	expect(created.title).toBe("First note");
	expect(yield* client["notes.list"]()).toEqual([created]);
	const sql = yield* SqlClient.SqlClient;
	expect(yield* sql`select id, title from starter_notes`).toEqual([created]);
	const invalid = yield* client["notes.create"]({ title: "   " }).pipe(Effect.result);
	expect(Result.isFailure(invalid) && invalid.failure._tag).toBe("Invalid");
	expect(yield* client["notes.list"]()).toEqual([created]);
});
