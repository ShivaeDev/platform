import { Clock, Effect, Ref } from "effect";
import { HttpIncomingMessage, HttpServerResponse } from "effect/unstable/http";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";
import { localRpcGuard } from "@shivaedev/platform/rpc-server/local.ts";
import type { Changes } from "#files/changes.ts";
import { HandoffsService } from "#handoffs/Service.ts";
import { MAX_BYTES } from "#history/limits.ts";
import { historyResponse } from "#history/response.ts";
import { HEADERS } from "#http/respond.ts";
import { navHtml } from "#page/nav.ts";
import { Responses } from "#responses/service.ts";
import { searchMatch } from "#search/match.ts";
import type { Snapshot } from "#search/snapshot.ts";
import { ReadFailed, workRpcs } from "./contract.ts";
import { hints } from "./hints.ts";

export interface ServerOptions {
	readonly changes: Changes;
	readonly home: string | undefined;
	readonly index: Effect.Effect<Snapshot, unknown>;
	readonly page: (url: string) => Effect.Effect<HttpServerResponse.HttpServerResponse, unknown>;
}

export const server = Effect.fn("WorkBoard.server")(function* ({ changes, home, index, page }: ServerOptions) {
	const handoffs = yield* HandoffsService;
	const responses = yield* Responses;
	const handlers = workRpcs.toLayer({
		"work-board.awaitResponse": responses.awaitResponse,
		"work-board.handoffSource": ({ item }) => handoffs.locate(item),
		"work-board.handoffs": ({ item }) => handoffs.read(item),
		"work-board.history": ({ action, baseline }) =>
			Effect.gen(function* () {
				const now = yield* Clock.currentTimeMillis;
				const snapshot = action === "check" ? undefined : yield* index;
				return historyResponse(baseline, now, snapshot);
			}).pipe(Effect.catch(() => Effect.fail(new ReadFailed({ operation: "history", status: 500 })))),
		"work-board.navigation": () =>
			Effect.gen(function* () {
				return navHtml(yield* changes.files, "", home, yield* index);
			}).pipe(Effect.catch(() => Effect.fail(new ReadFailed({ operation: "navigation", status: 500 })))),
		"work-board.page": ({ url }) =>
			page(url).pipe(
				Effect.flatMap((response) => {
					if (response.status >= 500 || response.body._tag !== "Uint8Array") {
						return Effect.fail(new ReadFailed({ operation: "page", status: response.status }));
					}
					return Effect.succeed({ html: new TextDecoder().decode(response.body.body), status: response.status });
				}),
				Effect.catch((error) => Effect.fail(error instanceof ReadFailed ? error : new ReadFailed({ operation: "page", status: 500 }))),
			),
		"work-board.prepareHandoff": handoffs.prepare,
		"work-board.question": ({ item, request }) => responses.locate(item, request),
		"work-board.recordResponse": responses.record,
		"work-board.registerQuestion": responses.register,
		"work-board.responses": ({ question }) => responses.read(question),
		"work-board.search": ({ query }) =>
			Effect.map(index, (snapshot) => ({ ...searchMatch(snapshot.entries, query), unavailable: snapshot.unavailable })).pipe(
				Effect.catch(() => Effect.fail(new ReadFailed({ operation: "search", status: 500 }))),
			),
		"work-board.subscribe": () => hints(changes, index),
		"work-board.watcher": () => Effect.map(Ref.get(changes.watching), (watching) => ({ watching })),
	});
	const wire = RpcSerialization.ndjson;
	const handler = yield* RpcServer.toHttpEffect(workRpcs).pipe(
		Effect.provide(handlers),
		Effect.provideService(RpcSerialization.RpcSerialization, wire),
	);
	return handler.pipe(
		localRpcGuard,
		Effect.provideService(RpcSerialization.RpcSerialization, wire),
		Effect.provideService(HttpIncomingMessage.MaxBodySize, BigInt(4 * MAX_BYTES + 4096)),
		Effect.map((response) => HttpServerResponse.setHeaders(response, HEADERS)),
	);
});
