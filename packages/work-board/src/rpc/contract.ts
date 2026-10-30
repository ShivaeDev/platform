import { Effect, Schema } from "effect";
import { contract } from "@shivaedev/contract/contract.ts";
import { query } from "@shivaedev/contract/operation.ts";
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
import { ReadIndex } from "#rpc/BoardIndex.ts";
import { handoffContract } from "#rpc/handoffContract.ts";
import { Indexing } from "#rpc/Indexing.ts";
import { index, navigation, watcher, workspace } from "#rpc/keys.ts";
import { PageUrl } from "#rpc/PageUrl.ts";
import { pageKeys } from "#rpc/pageKeys.ts";
import { ReadSearch } from "#rpc/ReadSearch.ts";
import { documentRejections } from "#rpc/rejections.ts";
import { responseContract } from "#rpc/responseContract.ts";
import { Server } from "#rpc/Server.ts";

const ReadDocument = query("document", {
	payload: { url: PageUrl },
	readPolicy: () => Effect.succeed(true),
	reads: ({ url }) => pageKeys(url),
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
	reads: () => [workspace.list, index.bucket.workspace("local")],
	rejections: documentRejections,
	success: WorkProjection,
});
const ReadInbox = query("inbox", {
	readPolicy: () => Effect.succeed(true),
	reads: () => [workspace.list, index.bucket.workspace("local")],
	rejections: { InternalServerError },
	success: InboxProjection,
});
const ReadServer = query("server", { readPolicy: () => Effect.succeed(true), reads: () => [], rejections: { ServiceUnavailable }, success: Server });
const ReadDiagnostics = query("diagnostics", {
	readPolicy: () => Effect.succeed(true),
	reads: () => [workspace.list, index.bucket.workspace("local")],
	rejections: { InternalServerError },
	success: DiagnosticsProjection,
});
const ReadFleetItems = query("fleetItems", {
	readPolicy: () => Effect.succeed(true),
	reads: () => [workspace.list, index.bucket.workspace("local")],
	rejections: { InternalServerError },
	success: FleetItemsProjection,
});
const ReadGoals = query("goals", {
	readPolicy: () => Effect.succeed(true),
	reads: () => [workspace.list, index.bucket.workspace("local")],
	rejections: { InternalServerError },
	success: GoalsProjection,
});
const ReadOverview = query("overview", {
	readPolicy: () => Effect.succeed(true),
	reads: () => [workspace.list, index.bucket.workspace("local")],
	rejections: { InternalServerError },
	success: OverviewProjection,
});
const ReadStart = query("start", {
	readPolicy: () => Effect.succeed(true),
	reads: () => [workspace.list, index.bucket.workspace("local")],
	rejections: { InternalServerError },
	success: StartProjection,
});
const ReadHandoff = query("handoff", {
	payload: { url: PageUrl },
	readPolicy: () => Effect.succeed(true),
	reads: () => [workspace.list, index.bucket.workspace("local")],
	rejections: documentRejections,
	success: HandoffProjection,
});
const ReadResult = query("result", {
	payload: { url: PageUrl },
	readPolicy: () => Effect.succeed(true),
	reads: () => [workspace.list, index.bucket.workspace("local")],
	rejections: documentRejections,
	success: ResultProjection,
});
const ReadLibrary = query("library", {
	payload: LibraryInput,
	readPolicy: () => Effect.succeed(true),
	reads: () => [workspace.list, index.bucket.workspace("local")],
	rejections: { InternalServerError },
	success: Library,
});
const ReadNavigation = query("navigation", {
	payload: { current: Schema.String.check(Schema.isMaxLength(8192)) },
	readPolicy: () => Effect.succeed(true),
	reads: () => [workspace.list, navigation.list, index.bucket.workspace("local")],
	rejections: { InternalServerError },
	success: Navigation,
});
const ReadWatcher = query("watcher", {
	readPolicy: () => Effect.succeed(true),
	reads: () => [workspace.list, watcher.list],
	rejections: { InternalServerError },
	success: Schema.Struct({ watching: Schema.Boolean }),
});
const ReadIndexing = query("indexing", {
	readPolicy: () => Effect.succeed(true),
	reads: () => [index.item("progress")],
	rejections: { InternalServerError },
	success: Schema.UndefinedOr(Indexing),
});
export const workContract = contract("work-board", {
	queries: [
		ReadIndex,
		ReadServer,
		ReadIndexing,
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
}).middleware(RequestTracing);
export const workRpcs = workContract.merge(responseContract).merge(handoffContract);

export const workApplication = workContract.application.merge(responseContract.application).merge(handoffContract.application);
