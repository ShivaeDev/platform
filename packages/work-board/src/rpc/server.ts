import { Effect } from "effect";
import { HttpIncomingMessage, HttpServerResponse } from "effect/unstable/http";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";
import { localRpcGuard } from "@shivaedev/platform/rpc-server/local.ts";
import type { Document } from "#browser/document/schema.ts";
import type { Changes } from "#files/changes.ts";
import type { handoffService } from "#handoffs/service.ts";
import { MAX_BYTES } from "#history/limits.ts";
import { HEADERS } from "#http/respond.ts";
import type { responseService } from "#responses/service.ts";
import type { Snapshot } from "#search/snapshot.ts";
import { workRpcs } from "./contract.ts";
import { handlers } from "./handlers.ts";

export interface ServerOptions {
	readonly changes: Changes;
	readonly document?: (url: string) => Effect.Effect<Document, unknown>;
	readonly handoffs: Effect.Success<ReturnType<typeof handoffService>>;
	readonly home: string | undefined;
	readonly index: Effect.Effect<Snapshot, unknown>;
	readonly page: (url: string) => Effect.Effect<HttpServerResponse.HttpServerResponse, unknown>;
	readonly responses: Effect.Success<ReturnType<typeof responseService>>;
}

export const server = Effect.fn("WorkBoard.server")(function* (options: ServerOptions) {
	const wire = RpcSerialization.ndjson;
	const handler = yield* RpcServer.toHttpEffect(workRpcs).pipe(
		Effect.provide(handlers(options)),
		Effect.provideService(RpcSerialization.RpcSerialization, wire),
	);
	return handler.pipe(
		localRpcGuard,
		Effect.provideService(RpcSerialization.RpcSerialization, wire),
		Effect.provideService(HttpIncomingMessage.MaxBodySize, BigInt(4 * MAX_BYTES + 4096)),
		Effect.map((response) => HttpServerResponse.setHeaders(response, HEADERS)),
	);
});
