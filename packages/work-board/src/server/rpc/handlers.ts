import { Clock, Effect, Layer, Ref, Stream } from "effect";
import { InternalServerError, NotFound } from "@shivaedev/platform/errors/taxonomy.ts";
import { rpcBoundary } from "@shivaedev/platform/rpc-server/boundary.ts";
import { requestTracingLayer } from "@shivaedev/platform/rpc-server/tracing.ts";
import { Diagnostics } from "#diagnostics/source.ts";
import { workRpcs } from "#rpc/contract.ts";
import { DocumentRejection, ResponseRejection } from "#rpc/rejections.ts";
import { HandoffsService } from "#server/handoffs/Service.ts";
import { historyResponse } from "#server/history/response.ts";
import { navigationData } from "#server/navigation/model.ts";
import { Responses } from "#server/responses/service.ts";
import { searchMatch } from "#server/search/match.ts";
import { projectionQueries } from "#server/views/projectionQueries.ts";
import { remainingQueries } from "#server/views/remainingQueries.ts";
import { hints } from "./hints.ts";
import type { ServerOptions } from "./transport.ts";

const readBoundary = rpcBoundary(InternalServerError, { unexpected: (message) => new InternalServerError({ message }) });
const documentBoundary = rpcBoundary(DocumentRejection, { unexpected: (message) => new InternalServerError({ message }) });
const responseBoundary = rpcBoundary(ResponseRejection, { unexpected: (message) => new InternalServerError({ message }) });

export const handlers = Effect.fn("WorkBoard.handlers")(function* (options: ServerOptions) {
	const { changes, document, home, index } = options;
	const projections = projectionQueries({ document, index });
	const handoffs = yield* HandoffsService;
	const responses = yield* Responses;
	const diagnostics = yield* Diagnostics;
	const remaining = remainingQueries(options, { diagnostics, handoffs, responses });
	return workRpcs
		.toLayer({
			"work-board.awaitResponse": (input) => Effect.suspend(() => responses.awaitResponse(input)).pipe(responseBoundary),
			"work-board.board": ({ url }) => Effect.suspend(() => projections.board(url)).pipe(documentBoundary),
			"work-board.diagnostics": () => remaining.diagnostics().pipe(readBoundary),
			"work-board.document": ({ url }) =>
				Effect.suspend(() => (document ? document(url) : Effect.fail(new NotFound({ message: "The document is missing." })))).pipe(documentBoundary),
			"work-board.handoff": ({ url }) => remaining.handoff(url).pipe(documentBoundary),
			"work-board.handoffSource": ({ item }) => Effect.suspend(() => handoffs.locate(item)).pipe(responseBoundary),
			"work-board.handoffs": ({ item }) => Effect.suspend(() => handoffs.read(item)).pipe(responseBoundary),
			"work-board.history": ({ action, baseline }) =>
				Effect.gen(function* () {
					const now = yield* Clock.currentTimeMillis;
					const snapshot = action === "check" ? undefined : yield* index;
					return historyResponse(baseline, now, snapshot);
				}).pipe(readBoundary),
			"work-board.inbox": () => Effect.suspend(() => projections.inbox()).pipe(readBoundary),
			"work-board.navigation": ({ current }) =>
				Effect.gen(function* () {
					return navigationData(yield* changes.files, current, home, yield* index);
				}).pipe(readBoundary),
			"work-board.overview": () => Effect.suspend(() => projections.overview()).pipe(readBoundary),
			"work-board.prepareHandoff": (input) => Effect.suspend(() => handoffs.prepare(input)).pipe(responseBoundary),
			"work-board.question": ({ item, request }) => Effect.suspend(() => responses.locate(item, request)).pipe(responseBoundary),
			"work-board.recordResponse": (input) => Effect.suspend(() => responses.record(input)).pipe(responseBoundary),
			"work-board.registerQuestion": (input) => Effect.suspend(() => responses.register(input)).pipe(responseBoundary),
			"work-board.respond": ({ url }) => remaining.respond(url).pipe(documentBoundary),
			"work-board.responses": ({ question }) => Effect.suspend(() => responses.read(question)).pipe(responseBoundary),
			"work-board.result": ({ url }) => remaining.result(url).pipe(documentBoundary),
			"work-board.search": ({ query }) =>
				Effect.map(index, (snapshot) => ({ ...searchMatch(snapshot.entries, query), unavailable: snapshot.unavailable })).pipe(readBoundary),
			"work-board.start": () => remaining.start().pipe(readBoundary),
			"work-board.subscribe": () =>
				hints(changes, index).pipe(Stream.catchCause((cause) => Stream.fromEffect(Effect.failCause(cause).pipe(readBoundary)))),
			"work-board.watcher": () => Effect.map(Ref.get(changes.watching), (watching) => ({ watching })).pipe(readBoundary),
			"work-board.work": ({ url }) => Effect.suspend(() => projections.work(url)).pipe(documentBoundary),
		})
		.pipe(Layer.provideMerge(requestTracingLayer()));
});
