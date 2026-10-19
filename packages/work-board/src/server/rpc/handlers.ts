import { Clock, Effect, Layer, Ref, Stream } from "effect";
import { InternalServerError, ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { rpcBoundary } from "@shivaedev/platform/server/rpc-server/boundary.ts";
import { requestTracingLayer } from "@shivaedev/platform/server/rpc-server/tracing.ts";
import { laneRows, openLaneCount } from "#browser/views/nowLanes.ts";
import { workRpcs } from "#rpc/contract.ts";
import { DocumentRejection, ResponseRejection } from "#rpc/rejections.ts";
import { HandoffsService } from "#server/handoffs/Service.ts";
import { libraryData } from "#server/navigation/libraryData.ts";
import { navigationData } from "#server/navigation/model.ts";
import { Responses } from "#server/Responses.ts";
import { searchMatch } from "#server/search/match.ts";
import { fleetItems } from "#server/views/fleetItems.ts";
import { goals } from "#server/views/goals.ts";
import { projectionQueries } from "#server/views/projectionQueries.ts";
import { remainingQueries } from "#server/views/remainingQueries.ts";
import { Workspace } from "#server/workspace.ts";
import type { HandlerOptions } from "./HandlerOptions.ts";
import { hints } from "./hints.ts";

const readBoundary = rpcBoundary(InternalServerError, { unexpected: (message) => new InternalServerError({ message }) });
const documentBoundary = rpcBoundary(DocumentRejection, { unexpected: (message) => new InternalServerError({ message }) });
const responseBoundary = rpcBoundary(ResponseRejection, { unexpected: (message) => new InternalServerError({ message }) });

export const handlers = Effect.fn("WorkBoard.handlers")(function* (options: HandlerOptions = {}) {
	const workspace = yield* Workspace;
	const { changes, home } = yield* workspace.settings();
	const index = workspace.index();
	const document = workspace.document;
	const projections = yield* projectionQueries;
	const handoffs = yield* HandoffsService;
	const responses = yield* Responses;
	const remaining = yield* remainingQueries;
	return workRpcs
		.toLayer({
			"work-board.awaitResponse": (input) => Effect.suspend(() => responses.awaitResponse(input)).pipe(responseBoundary),
			"work-board.board": ({ url }) => Effect.suspend(() => projections.board(url)).pipe(documentBoundary),
			"work-board.diagnostics": () => remaining.diagnostics().pipe(readBoundary),
			"work-board.document": ({ url }) => Effect.suspend(() => document(url)).pipe(documentBoundary),
			"work-board.fleetItems": () => fleetItems(options.fleetPort).pipe(readBoundary),
			"work-board.goals": () =>
				Effect.gen(function* () {
					const snapshot = yield* index;
					return goals(
						snapshot,
						yield* fleetItems(options.fleetPort).pipe(Effect.provideService(Workspace, { ...workspace, index: () => Effect.succeed(snapshot) })),
					);
				}).pipe(readBoundary),
			"work-board.handoff": ({ url }) => remaining.handoff(url).pipe(documentBoundary),
			"work-board.handoffSource": ({ item }) => Effect.suspend(() => handoffs.locate(item)).pipe(responseBoundary),
			"work-board.handoffs": ({ item }) => Effect.suspend(() => handoffs.read(item)).pipe(responseBoundary),
			"work-board.inbox": () => Effect.suspend(() => projections.inbox()).pipe(readBoundary),
			"work-board.library": (input) =>
				Effect.gen(function* () {
					return libraryData(yield* changes.files, yield* index, input);
				}).pipe(readBoundary),
			"work-board.navigation": () =>
				Effect.gen(function* () {
					const snapshot = yield* index;
					const [work, fleet] = yield* Effect.all(
						[
							projections.work("/_board/work"),
							fleetItems(options.fleetPort).pipe(Effect.provideService(Workspace, { ...workspace, index: () => Effect.succeed(snapshot) })),
						],
						{ concurrency: "unbounded" },
					);
					const now = openLaneCount(laneRows(work.rows, fleet, yield* Clock.currentTimeMillis).lanes);
					return navigationData(yield* changes.files, home, snapshot, now);
				}).pipe(readBoundary),
			"work-board.prepareHandoff": (input) => Effect.suspend(() => handoffs.prepare(input)).pipe(responseBoundary),
			"work-board.question": ({ item, request }) => Effect.suspend(() => responses.locate(item, request)).pipe(responseBoundary),
			"work-board.recordResponse": (input) => Effect.suspend(() => responses.record(input)).pipe(responseBoundary),
			"work-board.registerQuestion": (input) => Effect.suspend(() => responses.register(input)).pipe(responseBoundary),
			"work-board.responses": ({ question }) => Effect.suspend(() => responses.read(question)).pipe(responseBoundary),
			"work-board.result": ({ url }) => remaining.result(url).pipe(documentBoundary),
			"work-board.search": ({ query, records }) =>
				Effect.map(index, (snapshot) => ({
					...searchMatch(snapshot.entries, query, snapshot.modified, records),
					unavailable: snapshot.unavailable,
				})).pipe(readBoundary),
			"work-board.server": () => options.server ?? Effect.fail(new ServiceUnavailable({ message: "The board server address is unavailable." })),
			"work-board.start": () => remaining.start().pipe(readBoundary),
			"work-board.subscribe": () => hints().pipe(Stream.catchCause((cause) => Stream.fromEffect(Effect.failCause(cause).pipe(readBoundary)))),
			"work-board.watcher": () => Effect.map(Ref.get(changes.watching), (watching) => ({ watching })).pipe(readBoundary),
			"work-board.work": ({ url }) => Effect.suspend(() => projections.work(url)).pipe(documentBoundary),
		})
		.pipe(Layer.provideMerge(requestTracingLayer()));
});
