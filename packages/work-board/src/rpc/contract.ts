import { Schema } from "effect";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { LiveHint } from "@shivaedev/effect-contract/live.ts";
import { query, stream } from "@shivaedev/effect-contract/operation.ts";
import { InternalServerError } from "@shivaedev/platform/errors/taxonomy.ts";
import { RequestTracing } from "@shivaedev/platform/rpc/middleware.ts";
import { Document } from "#browser/document/schema.ts";
import { Navigation } from "#browser/navigation/schema.ts";
import { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import { GoalsProjection } from "#browser/views/GoalsProjection.ts";
import { ResultProjection } from "#browser/views/ResultProjection.ts";
import { DiagnosticsProjection, HandoffProjection, RespondProjection, StartProjection } from "#browser/views/remaining.ts";
import { BoardProjection, InboxProjection, OverviewProjection, WorkProjection } from "#browser/views/schema.ts";
import { HistoryInput, HistoryOutput } from "#history/schema.ts";
import { handoffContract } from "#rpc/handoffContract.ts";
import { responseContract } from "#rpc/responseContract.ts";
import { index, navigation, watcher, workspace } from "./keys.ts";
import { PageUrl } from "./PageUrl.ts";
import { pageKeys } from "./pageKeys.ts";
import { documentRejections } from "./rejections.ts";

const Entry = Schema.Struct({
	file: Schema.String,
	href: Schema.String,
	kind: Schema.Literals(["document", "heading", "passage"]),
	line: Schema.optional(Schema.Number),
	snippet: Schema.String,
	text: Schema.String,
	title: Schema.String,
});
const ReadDocument = query("document", {
	payload: { url: PageUrl },
	reads: ({ url }) => [...pageKeys(url), index.list],
	rejections: documentRejections,
	success: Document,
});
const ReadBoard = query("board", {
	payload: { url: PageUrl },
	reads: ({ url }) => pageKeys(url),
	rejections: documentRejections,
	success: BoardProjection,
});
const ReadWork = query("work", {
	payload: { url: PageUrl },
	reads: () => [workspace.list, index.list],
	rejections: documentRejections,
	success: WorkProjection,
});
const ReadOverview = query("overview", {
	reads: () => [workspace.list, index.list],
	rejections: { InternalServerError },
	success: OverviewProjection,
});
const ReadInbox = query("inbox", { reads: () => [workspace.list, index.list], rejections: { InternalServerError }, success: InboxProjection });
const ReadDiagnostics = query("diagnostics", { reads: () => [workspace.list], rejections: { InternalServerError }, success: DiagnosticsProjection });
const ReadFleetItems = query("fleetItems", { reads: () => [workspace.list, index.list], success: FleetItemsProjection });
const ReadGoals = query("goals", { reads: () => [workspace.list, index.list], rejections: { InternalServerError }, success: GoalsProjection });
const ReadStart = query("start", { reads: () => [workspace.list, index.list], rejections: { InternalServerError }, success: StartProjection });
const ReadRespond = query("respond", {
	payload: { url: PageUrl },
	reads: ({ url }) => [...pageKeys(url), index.list],
	rejections: documentRejections,
	success: RespondProjection,
});
const ReadHandoff = query("handoff", {
	payload: { url: PageUrl },
	reads: () => [workspace.list, index.list],
	rejections: documentRejections,
	success: HandoffProjection,
});
const ReadResult = query("result", {
	payload: { url: PageUrl },
	reads: () => [workspace.list, index.list],
	rejections: documentRejections,
	success: ResultProjection,
});
const ReadNavigation = query("navigation", {
	payload: { current: Schema.String.check(Schema.isMaxLength(8192)) },
	reads: () => [workspace.list, navigation.list],
	rejections: { InternalServerError },
	success: Navigation,
});
const ReadSearch = query("search", {
	payload: { query: Schema.String.check(Schema.isMaxLength(8192)) },
	reads: () => [workspace.list, index.list],
	rejections: { InternalServerError },
	success: Schema.Struct({ results: Schema.Array(Entry), total: Schema.Number, unavailable: Schema.Array(Schema.String) }),
});
const ReadHistory = query("history", {
	payload: HistoryInput,
	reads: () => [workspace.list, index.list],
	rejections: { InternalServerError },
	success: HistoryOutput,
});
const ReadWatcher = query("watcher", {
	reads: () => [workspace.list, watcher.list],
	rejections: { InternalServerError },
	success: Schema.Struct({ watching: Schema.Boolean }),
});
export const Subscribe = stream("subscribe", { reads: () => [workspace.list], rejections: { InternalServerError }, success: LiveHint });
export const workContract = contract("work-board", {
	queries: [
		ReadDocument,
		ReadBoard,
		ReadWork,
		ReadOverview,
		ReadInbox,
		ReadDiagnostics,
		ReadFleetItems,
		ReadGoals,
		ReadStart,
		ReadRespond,
		ReadHandoff,
		ReadResult,
		ReadNavigation,
		ReadSearch,
		ReadHistory,
		ReadWatcher,
	],
	streams: [Subscribe],
}).middleware(RequestTracing);
export const workRpcs = workContract.merge(responseContract).merge(handoffContract);
