import { Effect } from "effect";
import { HttpIncomingMessage, HttpServerResponse } from "effect/unstable/http";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";
import { localRpcGuard } from "@shivaedev/platform/rpc-server/local.ts";
import type { Document } from "#browser/document/schema.ts";
import { workRpcs } from "#rpc/contract.ts";
import type { Changes } from "#server/files/changes.ts";
import { MAX_BYTES } from "#server/history/limits.ts";
import { HEADERS } from "#server/http/respond.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { handlers } from "./handlers.ts";

export interface ServerOptions {
	readonly changes: Changes;
	readonly document?: (url: string) => Effect.Effect<Document, unknown>;
	readonly home: string | undefined;
	readonly index: Effect.Effect<Snapshot, unknown>;
	readonly page: (url: string) => Effect.Effect<HttpServerResponse.HttpServerResponse, unknown>;
}

export const server = Effect.fn("WorkBoard.server")(function* (options: ServerOptions) {
	const rpcHandlers = yield* handlers(options);
	const wire = RpcSerialization.ndjson;
	const handler = yield* RpcServer.toHttpEffect(workRpcs).pipe(
		Effect.provide(rpcHandlers),
		Effect.provideService(RpcSerialization.RpcSerialization, wire),
	);
	return handler.pipe(
		localRpcGuard,
		Effect.provideService(RpcSerialization.RpcSerialization, wire),
		Effect.provideService(HttpIncomingMessage.MaxBodySize, BigInt(4 * MAX_BYTES + 4096)),
		Effect.map((response) => HttpServerResponse.setHeaders(response, HEADERS)),
	);
});
