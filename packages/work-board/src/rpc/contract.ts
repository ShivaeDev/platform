import { Schema } from "effect";
import { Rpc } from "effect/unstable/rpc";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { LiveHint } from "@shivaedev/effect-contract/live.ts";
import { query } from "@shivaedev/effect-contract/operation.ts";
import { HistoryInput, HistoryOutput } from "#history/schema.ts";
import { index, navigation, watcher, workspace } from "./keys.ts";
import { pageKeys } from "./pageKeys.ts";

export class ReadFailed extends Schema.TaggedError<ReadFailed>()("ReadFailed", { operation: Schema.String, status: Schema.Number }) {}
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
				|| ["/_board/work", "/_board/overview", "/_board/changes", "/_board/start"].includes(path)
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
const ReadPage = query("page", { payload: { url: PageUrl }, reads: ({ url }) => pageKeys(url), rejections: { ReadFailed }, success: Page });
const ReadNavigation = query("navigation", { reads: () => [workspace.list, navigation.list], rejections: { ReadFailed }, success: Schema.String });
const ReadSearch = query("search", {
	payload: { query: Schema.String.check(Schema.isMaxLength(8192)) },
	reads: () => [workspace.list, index.list],
	rejections: { ReadFailed },
	success: Schema.Struct({ results: Schema.Array(Entry), total: Schema.Number, unavailable: Schema.Array(Schema.String) }),
});
const ReadHistory = query("history", {
	payload: HistoryInput,
	reads: () => [workspace.list, index.list],
	rejections: { ReadFailed },
	success: HistoryOutput,
});
const ReadWatcher = query("watcher", {
	reads: () => [workspace.list, watcher.list],
	rejections: { ReadFailed },
	success: Schema.Struct({ watching: Schema.Boolean }),
});
export const workContract = contract("work-board", { queries: [ReadPage, ReadNavigation, ReadSearch, ReadHistory, ReadWatcher] });
export const Subscribe = Rpc.make("work-board.subscribe", { error: ReadFailed, stream: true, success: LiveHint });
export const workRpcs = workContract.add(Subscribe);
