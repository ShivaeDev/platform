import { Clock, Effect, Ref } from "effect";
import { HandoffsService } from "#handoffs/Service.ts";
import { historyResponse } from "#history/response.ts";
import { navigationData } from "#navigation/model.ts";
import { Responses } from "#responses/service.ts";
import { searchMatch } from "#search/match.ts";
import { ReadFailed, workRpcs } from "./contract.ts";
import { hints } from "./hints.ts";
import type { ServerOptions } from "./server.ts";

export const handlers = Effect.fn("WorkBoard.handlers")(function* ({ changes, document, home, index, page }: ServerOptions) {
	const handoffs = yield* HandoffsService;
	const responses = yield* Responses;
	return workRpcs.toLayer({
		"work-board.awaitResponse": responses.awaitResponse,
		"work-board.document": ({ url }) =>
			(document ? document(url) : Effect.fail(new ReadFailed({ operation: "document", status: 404 }))).pipe(
				Effect.catch((error) => Effect.fail(error instanceof ReadFailed ? error : new ReadFailed({ operation: "document", status: 500 }))),
			),
		"work-board.handoffSource": ({ item }) => handoffs.locate(item),
		"work-board.handoffs": ({ item }) => handoffs.read(item),
		"work-board.history": ({ action, baseline }) =>
			Effect.gen(function* () {
				const now = yield* Clock.currentTimeMillis;
				const snapshot = action === "check" ? undefined : yield* index;
				return historyResponse(baseline, now, snapshot);
			}).pipe(Effect.catch(() => Effect.fail(new ReadFailed({ operation: "history", status: 500 })))),
		"work-board.navigation": ({ current }) =>
			Effect.gen(function* () {
				return navigationData(yield* changes.files, current, home, yield* index);
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
});
