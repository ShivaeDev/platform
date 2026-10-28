import { Effect, Schema } from "effect";
import { contract } from "@shivaedev/contract/contract.ts";
import { LiveHint } from "@shivaedev/contract/live.ts";
import { query, stream } from "@shivaedev/contract/operation.ts";
import { InternalServerError, ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { RequestTracing } from "@shivaedev/identity/middleware.ts";
import { Document } from "#browser/document/schema.ts";
import { Navigation } from "#browser/Navigation.ts";
import { Library, LibraryInput } from "#browser/navigation/library.ts";
import { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import { GoalsProjection } from "#browser/views/GoalsProjection.ts";
import { OverviewProjection } from "#browser/views/OverviewProjection.ts";
import { ResultProjection } from "#browser/views/ResultProjection.ts";
import { DiagnosticsProjection, HandoffProjection, StartProjection } from "#browser/views/remaining.ts";
import { BoardProjection, InboxProjection, WorkProjection } from "#browser/views/schema.ts";
import { handoffContract } from "#rpc/handoffContract.ts";
import { Indexing } from "#rpc/Indexing.ts";
import { responseContract } from "#rpc/responseContract.ts";
import { index, navigation, watcher, workspace } from "./keys.ts";
import { PageUrl } from "./PageUrl.ts";
import { pageKeys } from "./pageKeys.ts";
import { ReadSearch } from "./ReadSearch.ts";
import { documentRejections } from "./rejections.ts";
import { Server } from "./Server.ts";

const ReadDocument = query("document", {
	payload: { url: PageUrl },
	readPolicy: () => Effect.succeed(true),
	reads: ({ url }) => [...pageKeys(url), index.list],
	rejections: documentRejections,
	success: Document,
});
const ReadBoard = query("board", {
	payload: { url: PageUrl },
	readPolicy: () => Effect.succeed(true),
	reads: ({ url }) => pageKeys(url),
	rejections: documentRejections,
	success: BoardProjection,
});
const ReadWork = query("work", {
	payload: { url: PageUrl },
	readPolicy: () => Effect.succeed(true),
	reads: () => [workspace.list, index.list],
	rejections: documentRejections,
	success: WorkProjection,
});
const ReadInbox = query("inbox", {
	readPolicy: () => Effect.succeed(true),
	reads: () => [workspace.list, index.list],
	rejections: { InternalServerError },
	success: InboxProjection,
});
const ReadServer = query("server", { readPolicy: () => Effect.succeed(true), reads: () => [], rejections: { ServiceUnavailable }, success: Server });
const ReadDiagnostics = query("diagnostics", {
	readPolicy: () => Effect.succeed(true),
	reads: () => [workspace.list],
	rejections: { InternalServerError },
	success: DiagnosticsProjection,
});
const ReadFleetItems = query("fleetItems", {
	readPolicy: () => Effect.succeed(true),
	reads: () => [workspace.list, index.list],
	rejections: { InternalServerError },
	success: FleetItemsProjection,
});
const ReadGoals = query("goals", {
	readPolicy: () => Effect.succeed(true),
	reads: () => [workspace.list, index.list],
	rejections: { InternalServerError },
	success: GoalsProjection,
});
const ReadOverview = query("overview", {
	readPolicy: () => Effect.succeed(true),
	reads: () => [workspace.list, index.list],
	rejections: { InternalServerError },
	success: OverviewProjection,
});
const ReadStart = query("start", {
	readPolicy: () => Effect.succeed(true),
	reads: () => [workspace.list, index.list],
	rejections: { InternalServerError },
	success: StartProjection,
});
const ReadHandoff = query("handoff", {
	payload: { url: PageUrl },
	readPolicy: () => Effect.succeed(true),
	reads: () => [workspace.list, index.list],
	rejections: documentRejections,
	success: HandoffProjection,
});
const ReadResult = query("result", {
	payload: { url: PageUrl },
	readPolicy: () => Effect.succeed(true),
	reads: () => [workspace.list, index.list],
	rejections: documentRejections,
	success: ResultProjection,
});
const ReadLibrary = query("library", {
	payload: LibraryInput,
	readPolicy: () => Effect.succeed(true),
	reads: () => [workspace.list, index.list],
	rejections: { InternalServerError },
	success: Library,
});
const ReadNavigation = query("navigation", {
	payload: { current: Schema.String.check(Schema.isMaxLength(8192)) },
	readPolicy: () => Effect.succeed(true),
	reads: () => [workspace.list, navigation.list, index.list],
	rejections: { InternalServerError },
	success: Navigation,
});
const ReadWatcher = query("watcher", {
	readPolicy: () => Effect.succeed(true),
	reads: () => [workspace.list, watcher.list],
	rejections: { InternalServerError },
	success: Schema.Struct({ watching: Schema.Boolean }),
});
export const Subscribe = stream("subscribe", {
	reads: () => [workspace.list],
	rejections: { InternalServerError },
	success: Schema.Union([LiveHint, Indexing]),
});
export const workContract = contract("work-board", {
	queries: [
		ReadServer,
		ReadDocument,
		ReadBoard,
		ReadWork,
		ReadInbox,
		ReadDiagnostics,
		ReadFleetItems,
		ReadGoals,
		ReadOverview,
		ReadStart,
		ReadHandoff,
		ReadResult,
		ReadNavigation,
		ReadLibrary,
		ReadSearch,
		ReadWatcher,
	],
	streams: [Subscribe],
}).middleware(RequestTracing);
export const workRpcs = workContract.merge(responseContract).merge(handoffContract);
