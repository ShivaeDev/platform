import { Clock, Effect, Schema } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { type FakeHttpReply, type FakeHttpRequest, fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";
import { artifactFixture } from "./artifactFixture.ts";
import { type Budget, budgetHeaders } from "./budgetHeaders.ts";
import { pullRequestWrites } from "./pullRequestWrites.ts";

export const DIFF = "diff --git a/README.md b/README.md\n+Widgets\n";
export const LOGO = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
export const SECONDARY_LIMIT = "You have exceeded a secondary rate limit. Please wait a few minutes before you try again.";
const PAGE_SIZE = 2;
const IssueTitle = Schema.fromJsonString(Schema.Struct({ title: Schema.String }));

export const fakeRepository = Effect.gen(function* () {
	const clock = yield* Clock.Clock;
	const writes = pullRequestWrites();
	const state: { budgets: { core: Budget; search: Budget }; pageReplies: Map<number, FakeHttpReply>; pullRequests: number } = {
		budgets: { core: { limit: 5000, remaining: 4990, reset: 3600 }, search: { limit: 30, remaining: 30, reset: 60 } },
		pageReplies: new Map(),
		pullRequests: 5,
	};
	function now() {
		return clock.currentTimeMillisUnsafe() / 1000;
	}
	function core(reply: FakeHttpReply): FakeHttpReply {
		return { ...reply, headers: { ...budgetHeaders("core", state.budgets.core), ...reply.headers } };
	}
	function pullRequest(number: number) {
		return { number, state: "open", title: `Pull request ${number}` };
	}
	function pull(request: FakeHttpRequest): FakeHttpReply {
		const number = Number(request.params.number);
		if (request.headers.accept === "application/vnd.github.diff") {
			return core({ chunks: [DIFF.slice(0, 20), DIFF.slice(20)], headers: { "content-type": "text/x-diff" } });
		}
		const etag = `"pull-${number}"`;
		return request.headers["if-none-match"] === etag
			? core({ headers: { "ETag": etag }, status: HttpStatus.fromLiteral("NotModified") })
			: core({ body: pullRequest(number), headers: { "ETag": etag } });
	}
	function pulls(request: FakeHttpRequest): FakeHttpReply {
		const page = Number(request.query.get("page") ?? 1);
		const scripted = state.pageReplies.get(page);
		if (scripted !== undefined) {
			return scripted;
		}
		const numbers = Array.from({ length: state.pullRequests }, (_, index) => index + 1).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
		const next = page * PAGE_SIZE < state.pullRequests ? { Link: `</repos/acme/widgets/pulls?page=${page + 1}>; rel="next"` } : {};
		return core({ body: numbers.map(pullRequest), headers: next });
	}
	function search(): FakeHttpReply {
		const budget = state.budgets.search;
		if (budget.remaining === 0 && now() >= budget.reset) {
			state.budgets.search = { ...budget, remaining: budget.limit, reset: now() + 60 };
		}
		const headers = budgetHeaders("search", state.budgets.search);
		return state.budgets.search.remaining === 0
			? { body: { message: "API rate limit exceeded for user ID 1." }, headers, status: HttpStatus.fromLiteral("Forbidden") }
			: { body: { "total_count": 3 }, headers };
	}
	const archive = artifactFixture(() => server.url);
	const server = yield* fakeHttpService({
		routes: {
			...writes.routes,
			...archive.routes,
			codeSearch: {
				path: "/search/code",
				reply: () => ({ body: { "total_count": 1 }, headers: budgetHeaders("code_search", { limit: 10, remaining: 9, reset: 60 }) }),
			},
			contents: {
				path: "/repos/acme/widgets/contents/:file",
				reply: (request) =>
					request.headers.accept === "application/vnd.github.raw"
						? core({ chunks: [LOGO], headers: { "content-type": "application/vnd.github.raw" } })
						: core({ body: { name: request.params.file, type: "file" } }),
			},
			editIssue: {
				method: "PATCH",
				path: "/repos/acme/widgets/issues/:number",
				reply: (request) =>
					core({
						body: { number: Number(request.params.number), state: "open", ...Schema.decodeUnknownSync(IssueTitle)(request.body.toString()) },
					}),
			},
			openIssue: {
				method: "POST",
				path: "/repos/acme/widgets/issues",
				reply: (request) =>
					core({
						body: { number: state.pullRequests + 1, state: "open", ...Schema.decodeUnknownSync(IssueTitle)(request.body.toString()) },
						status: HttpStatus.fromLiteral("Created"),
					}),
			},
			pull: { path: "/repos/acme/widgets/pulls/:number", reply: pull },
			pulls: { path: "/repos/acme/widgets/pulls", reply: pulls },
			search: { path: "/search/issues", reply: search },
		},
	});
	return { archive: archive.state, server, state, writes: writes.state };
});

export type FakeRepository = Effect.Success<typeof fakeRepository>;
