import { Schema } from "effect";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { LiveHint } from "@shivaedev/effect-contract/live.ts";
import { query, stream } from "@shivaedev/effect-contract/operation.ts";
import { InternalServerError } from "@shivaedev/platform/errors/taxonomy.ts";
import { RequestTracing } from "@shivaedev/platform/rpc/middleware.ts";
import { Document } from "#browser/document/schema.ts";
import { Navigation } from "#browser/navigation/schema.ts";
import { BoardProjection, InboxProjection, OverviewProjection, WorkProjection } from "#browser/views/schema.ts";
import { HistoryInput, HistoryOutput } from "#history/schema.ts";
import { handoffContract } from "#rpc/handoffContract.ts";
import { responseContract } from "#rpc/responseContract.ts";
import { index, navigation, watcher, workspace } from "./keys.ts";
import { pageKeys } from "./pageKeys.ts";
import { documentRejections } from "./rejections.ts";

const PageUrl = Schema.String.check(
	Schema.isMaxLength(8192),
	Schema.makeFilter((value) => {
		if (!value.startsWith("/") || value.startsWith("//")) {
			return "Expected a local reading URL";
		}
		try {
			const path = new URL(value, "http://127.0.0.1").pathname;
			return (
				path === "/"
				|| [
					"/_board/inbox",
					"/_board/diagnostics",
					"/_board/work",
					"/_board/overview",
					"/_board/changes",
					"/_board/start",
					"/_board/respond",
					"/_board/handoff",
					"/_board/result",
				].includes(path)
				|| /^\/_board\/item\/[^/]+\/$/u.exec(path) !== null
				|| /\.md$/iu.exec(path) !== null
				|| "Expected a local reading URL"
			);
		} catch {
			return "Expected a local reading URL";
		}
	}),
);
const Page = Schema.Struct({ html: Schema.String, status: Schema.Number });
const Entry = Schema.Struct({
	file: Schema.String,
	href: Schema.String,
	kind: Schema.Literals(["document", "heading", "passage"]),
	line: Schema.optional(Schema.Number),
	snippet: Schema.String,
	text: Schema.String,
	title: Schema.String,
});
const ReadPage = query("page", { payload: { url: PageUrl }, reads: ({ url }) => pageKeys(url), rejections: { InternalServerError }, success: Page });
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
	queries: [ReadPage, ReadDocument, ReadBoard, ReadWork, ReadOverview, ReadInbox, ReadNavigation, ReadSearch, ReadHistory, ReadWatcher],
	streams: [Subscribe],
}).middleware(RequestTracing);
export const workRpcs = workContract.merge(responseContract).merge(handoffContract);
