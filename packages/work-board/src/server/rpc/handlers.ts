import { Clock, Effect, Layer, Ref } from "effect";
import { rpcBoundary } from "@shivaedev/errors/boundary.ts";
import { InternalServerError, ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { requestTracingLayer } from "@shivaedev/identity/server/tracing.ts";
import { laneRows, openLaneCount } from "#browser/views/nowLanes.ts";
import { workApplication } from "#rpc/contract.ts";
import { DocumentRejection, ResponseRejection } from "#rpc/rejections.ts";
import { HandoffsService } from "#server/handoffs/Service.ts";
import { libraryData } from "#server/navigation/libraryData.ts";
import { navigationData } from "#server/navigation/model.ts";
import { Responses } from "#server/Responses.ts";
import type { HandlerOptions } from "#server/rpc/HandlerOptions.ts";
import { searchMatch } from "#server/search/match.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { fleetItems } from "#server/views/fleetItems.ts";
import { overview } from "#server/views/overview.ts";
import { projectionQueries } from "#server/views/projectionQueries.ts";
import { remainingQueries } from "#server/views/remainingQueries.ts";
import { Workspace } from "#server/workspace.ts";

const readBoundary = rpcBoundary(InternalServerError, { unexpected: (message) => new InternalServerError({ message }) });
const documentBoundary = rpcBoundary(DocumentRejection, { unexpected: (message) => new InternalServerError({ message }) });
const responseBoundary = rpcBoundary(ResponseRejection, { unexpected: (message) => new InternalServerError({ message }) });

export const handlers = Effect.fn("WorkBoard.handlers")(function* (options: HandlerOptions = {}) {
	const workspace = yield* Workspace;
	const { changes, home, root, indexing } = yield* workspace.settings();
	const fleetFolder = options.fleetFolder ?? root;
	function fleetOver(snapshot: Snapshot) {
		return fleetItems(fleetFolder, options.fleetPort).pipe(Effect.provideService(Workspace, { ...workspace, index: () => Effect.succeed(snapshot) }));
	}
	const index = workspace.index();
	const document = workspace.document;
	const projections = yield* projectionQueries;
	const handoffs = yield* HandoffsService;
	const responses = yield* Responses;
	const remaining = yield* remainingQueries;
	return workApplication
		.toLayer({
			"work-board-handoffs.handoffSource": ({ item }) => Effect.suspend(() => handoffs.locate(item)).pipe(responseBoundary),
			"work-board-handoffs.handoffs": ({ item }) => Effect.suspend(() => handoffs.read(item)).pipe(responseBoundary),
			"work-board-handoffs.prepareHandoff": (input) => Effect.suspend(() => handoffs.prepare(input)).pipe(responseBoundary),
			"work-board-responses.answerQuestion": (input) => Effect.suspend(() => responses.answer(input)).pipe(responseBoundary),
			"work-board-responses.awaitResponse": (input) => Effect.suspend(() => responses.awaitResponse(input)).pipe(responseBoundary),
			"work-board-responses.question": ({ item, request }) => Effect.suspend(() => responses.locate(item, request)).pipe(responseBoundary),
			"work-board-responses.recordResponse": (input) => Effect.suspend(() => responses.record(input)).pipe(responseBoundary),
			"work-board-responses.registerQuestion": (input) => Effect.suspend(() => responses.register(input)).pipe(responseBoundary),
			"work-board-responses.responses": ({ question }) => Effect.suspend(() => responses.read(question)).pipe(responseBoundary),
			"work-board.board": ({ url }) => Effect.suspend(() => projections.board(url)).pipe(documentBoundary),
			"work-board.diagnostics": () => remaining.diagnostics().pipe(readBoundary),
			"work-board.document": ({ url }) => Effect.suspend(() => document(url)).pipe(documentBoundary),
			"work-board.fleetItems": () => fleetItems(fleetFolder, options.fleetPort).pipe(readBoundary),
			"work-board.goals": () =>
				overview(fleetFolder, options.fleetPort).pipe(
					Effect.map((data) => data.goals),
					readBoundary,
				),
			"work-board.handoff": ({ url }) => remaining.handoff(url).pipe(documentBoundary),
			"work-board.inbox": () => Effect.suspend(() => projections.inbox()).pipe(readBoundary),
			"work-board.index": () =>
				Effect.map(index, (snapshot) => ({
					diagnostics: [...snapshot.model.diagnostics].map(([file, diagnostics]) => ({ diagnostics, file })),
					documents: snapshot.documents,
					files: [...snapshot.modified].map(([path, modified]) => ({ modified, path })),
					revision: snapshot.revision,
					unavailable: snapshot.unavailable,
				})).pipe(readBoundary),
			"work-board.indexing": () => (indexing ?? Effect.succeed(undefined)).pipe(readBoundary),
			"work-board.library": (input) =>
				Effect.gen(function* () {
					return libraryData(yield* changes.files, yield* index, input);
				}).pipe(readBoundary),
			"work-board.navigation": () =>
				Effect.gen(function* () {
					const snapshot = yield* index;
					const [work, fleet] = yield* Effect.all([projections.work("/_board/work"), fleetOver(snapshot)], { concurrency: "unbounded" });
					const now = openLaneCount(laneRows(work.rows, fleet, yield* Clock.currentTimeMillis).lanes);
					return navigationData(yield* changes.files, home, snapshot, now);
				}).pipe(readBoundary),
			"work-board.overview": () => overview(fleetFolder, options.fleetPort).pipe(readBoundary),
			"work-board.result": ({ url }) => remaining.result(url).pipe(documentBoundary),
			"work-board.search": ({ query, records }) =>
				Effect.map(index, (snapshot) => ({
					...searchMatch(snapshot.entries, query, snapshot.modified, records),
					unavailable: snapshot.unavailable,
				})).pipe(readBoundary),
			"work-board.server": () => options.server ?? Effect.fail(new ServiceUnavailable({ message: "The board server address is unavailable." })),
			"work-board.start": () => remaining.start().pipe(readBoundary),
			"work-board.watcher": () => Effect.map(Ref.get(changes.watching), (watching) => ({ watching })).pipe(readBoundary),
			"work-board.work": ({ url }) => Effect.suspend(() => projections.work(url)).pipe(documentBoundary),
		})
		.pipe(Layer.provideMerge(requestTracingLayer()));
});
