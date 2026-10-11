import { Clock, Effect, Layer, Ref } from "effect";
import { HttpIncomingMessage, HttpServerResponse } from "effect/unstable/http";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";
import { InternalServerError } from "@shivaedev/platform/errors/taxonomy.ts";
import { rpcBoundary } from "@shivaedev/platform/rpc-server/boundary.ts";
import { requestTracingLayer } from "@shivaedev/platform/rpc-server/tracing.ts";
import type { Changes } from "#files/changes.ts";
import type { handoffService } from "#handoffs/service.ts";
import { MAX_BYTES } from "#history/limits.ts";
import { historyResponse } from "#history/response.ts";
import { HEADERS } from "#http/respond.ts";
import { navHtml } from "#page/nav.ts";
import type { responseService } from "#responses/service.ts";
import { searchMatch } from "#search/match.ts";
import type { Snapshot } from "#search/snapshot.ts";
import { workRpcs } from "./contract.ts";
import { hints } from "./hints.ts";
import { ResponseRejection } from "./rejections.ts";

export interface ServerOptions {
	readonly changes: Changes;
	readonly handoffs: Effect.Success<ReturnType<typeof handoffService>>;
	readonly home: string | undefined;
	readonly index: Effect.Effect<Snapshot, unknown>;
	readonly page: (url: string) => Effect.Effect<HttpServerResponse.HttpServerResponse, unknown>;
	readonly responses: Effect.Success<ReturnType<typeof responseService>>;
}

const readBoundary = rpcBoundary(InternalServerError, { unexpected: (message) => new InternalServerError({ message }) });
const responseBoundary = rpcBoundary(ResponseRejection, { unexpected: (message) => new InternalServerError({ message }) });

export const server = Effect.fn("WorkBoard.server")(function* ({ changes, handoffs, home, index, page, responses }: ServerOptions) {
	const handlers = workRpcs.toLayer({
		"work-board.awaitResponse": (input) => Effect.suspend(() => responses.awaitResponse(input)).pipe(responseBoundary),
		"work-board.handoffSource": ({ item }) => Effect.suspend(() => handoffs.locate(item)).pipe(responseBoundary),
		"work-board.handoffs": ({ item }) => Effect.suspend(() => handoffs.read(item)).pipe(responseBoundary),
		"work-board.history": ({ action, baseline }) =>
			Effect.gen(function* () {
				const now = yield* Clock.currentTimeMillis;
				const snapshot = action === "check" ? undefined : yield* index;
				return historyResponse(baseline, now, snapshot);
			}).pipe(readBoundary),
		"work-board.navigation": () =>
			Effect.gen(function* () {
				return navHtml(yield* changes.files, "", home, yield* index);
			}).pipe(readBoundary),
		"work-board.page": ({ url }) =>
			Effect.suspend(() => page(url)).pipe(
				Effect.flatMap((response) => {
					if (response.status >= 500 || response.body._tag !== "Uint8Array") {
						return Effect.fail(new Error(`Page response is unreadable (status ${response.status}, body ${response.body._tag})`));
					}
					return Effect.succeed({ html: new TextDecoder().decode(response.body.body), status: response.status });
				}),
				readBoundary,
			),
		"work-board.prepareHandoff": (input) => Effect.suspend(() => handoffs.prepare(input)).pipe(responseBoundary),
		"work-board.question": ({ item, request }) => Effect.suspend(() => responses.locate(item, request)).pipe(responseBoundary),
		"work-board.recordResponse": (input) => Effect.suspend(() => responses.record(input)).pipe(responseBoundary),
		"work-board.registerQuestion": (input) => Effect.suspend(() => responses.register(input)).pipe(responseBoundary),
		"work-board.responses": ({ question }) => Effect.suspend(() => responses.read(question)).pipe(responseBoundary),
		"work-board.search": ({ query }) =>
			Effect.map(index, (snapshot) => ({ ...searchMatch(snapshot.entries, query), unavailable: snapshot.unavailable })).pipe(readBoundary),
		"work-board.subscribe": () => hints(changes, index),
		"work-board.watcher": () => Effect.map(Ref.get(changes.watching), (watching) => ({ watching })).pipe(readBoundary),
	});
	const handler = yield* RpcServer.toHttpEffect(workRpcs).pipe(
		Effect.provide(Layer.mergeAll(handlers, RpcSerialization.layerNdjson, requestTracingLayer())),
	);
	return handler.pipe(
		Effect.provideService(HttpIncomingMessage.MaxBodySize, BigInt(4 * MAX_BYTES + 4096)),
		Effect.map((response) => HttpServerResponse.setHeaders(response, HEADERS)),
	);
});
