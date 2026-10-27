import { Context, Effect, Layer, Option, Redacted, type Schema, Stream } from "effect";
import { FetchHttpClient } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { type FakeHttpReply, fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { GitHub, list, listBounded, read, write } from "#GitHub.ts";
import { GitHubConfig } from "#GitHubConfig.ts";
import { GitHubToken } from "#GitHubToken.ts";
import { artifactFixture } from "./artifactFixture.ts";
import { budgetHeaders } from "./budgetHeaders.ts";
import { FIXTURE_TOKEN, PullRequest } from "./fixtures.ts";
import { pullRequestWrites } from "./pullRequestWrites.ts";
import { readWithEnvironment } from "./readWithEnvironment.ts";
import { telemetry } from "./telemetry.ts";
import { writeVerbs } from "./writeVerbs.ts";

export const github = storyKit({
	*create() {
		const writes = pullRequestWrites();
		const state: {
			etag: string;
			headers: Record<string, string>;
			items: Array<{ number: number; title: string }>;
			reply: FakeHttpReply | undefined;
			pageReplies: Map<number, FakeHttpReply>;
		} = {
			etag: '"pull-1"',
			headers: {},
			items: Array.from({ length: 5 }, (_, index) => ({ number: index + 1, title: `Pull request ${index + 1}` })),
			pageReplies: new Map(),
			reply: undefined,
		};
		const archive = artifactFixture(() => server.url);
		const server = yield* fakeHttpService({
			routes: {
				...writes.routes,
				...archive.routes,
				artifact: { path: "/artifact", reply: () => state.reply ?? { chunks: ["patch", " bytes"] } },
				patchIssue: { method: "PATCH", path: "/repos/acme/widgets/issues", reply: () => ({ body: state.items[0] }) },
				postIssue: { method: "POST", path: "/repos/acme/widgets/issues", reply: () => ({ body: state.items[0] }) },
				pull: {
					path: "/repos/acme/widgets/pulls/:number",
					reply: (request) => {
						if (state.reply !== undefined) {
							return state.reply;
						}
						const headers = { ...state.headers, "ETag": state.etag };
						return request.headers["if-none-match"] === state.etag
							? { headers, status: HttpStatus.fromLiteral("NotModified") }
							: { body: state.items[0], headers };
					},
				},
				pulls: {
					path: "/repos/acme/widgets/pulls",
					reply: ({ query }) => {
						const page = Number(query.get("page") ?? 1);
						const scripted = state.pageReplies.get(page);
						if (scripted !== undefined) {
							return scripted;
						}
						const more = page * 2 < state.items.length;
						return {
							body: state.items.slice((page - 1) * 2, page * 2),
							headers: { ...state.headers, ...(more ? { Link: `</repos/acme/widgets/pulls?page=${page + 1}>; rel="next"` } : {}) },
						};
					},
				},
				search: { path: "/search/issues", reply: () => state.reply ?? { body: state.items[0], headers: state.headers } },
			},
		});
		const recording = telemetry();
		const layer = GitHub.layer.pipe(
			Layer.provide(
				Layer.mergeAll(
					FetchHttpClient.layer,
					Layer.succeed(GitHubToken)(Option.some(Redacted.make(FIXTURE_TOKEN))),
					Layer.succeed(GitHubConfig)({ apiUrl: server.url }),
				),
			),
		);
		const context = yield* Layer.build(Layer.fresh(layer));
		return { archive: archive.state, client: Context.get(context, GitHub), context, recording, server, state, writes: writes.state };
	},
	inspect: ({ server }) => ({ requests: server.requests.map(({ method, path }) => ({ method, path })) }),
	name: "GitHub REST client",
	stages: ["github"],
	verbs: ({ archive, client, context, recording, server, state }, story) => {
		server.narrate(story.tell);
		function run<A, E>(effect: Effect.Effect<A, E, Context.Service.Identifier<typeof GitHub>>) {
			return effect.pipe(Effect.provide(context), Effect.withSpan("GitHub request"), Effect.provide(recording.layer));
		}
		return {
			...writeVerbs(client),
			archiveBytesSent: () => archive.sentBytes,
			bytes: (limit: number) => run(client.bytes("/artifact", "application/octet-stream", limit)),
			downloadArchive: (byteLimit: number) => run(client.downloadArtifactArchive({ artifactId: 7, byteLimit, owner: "acme", repo: "widgets" })),
			dropConnection: () => server.scriptFault("pull", { kind: "drop" }, { repeat: true }).pipe(Effect.asVoid),
			observations: () => client.observations(),
			readPull: (number = 1) => run(read(`/repos/acme/widgets/pulls/${number}?private=query-secret`, PullRequest)),
			readPullAs: <TSchema extends Schema.ConstraintDecoder<unknown>>(schema: TSchema) =>
				run(read("/repos/acme/widgets/pulls/1?private=query-secret", schema)),
			readPulls: (take?: number) =>
				run(
					list("/repos/acme/widgets/pulls", PullRequest).pipe(
						(stream) => (take === undefined ? stream : Stream.take(stream, take)),
						Stream.runCollect,
					),
				),
			readPullsBounded: (pageCap: number, byteLimit?: number) => run(listBounded("/repos/acme/widgets/pulls", PullRequest, pageCap, byteLimit)),
			readWithEnvironment: (variables: Record<string, string>) => readWithEnvironment(server.url, variables),
			rejectArchive: () => server.replyOnce("artifactRedirect", { status: HttpStatus.fromLiteral("Unauthorized") }),
			requests: () => server.requests,
			search: () => run(read("/search/issues?private=query-secret", PullRequest)),
			setBudget: (resource: string, remaining: number, reset: number) =>
				Effect.sync(() => {
					state.headers = budgetHeaders(resource, remaining, reset);
				}),
			telemetry: () => recording,
			text: (limit: number) => run(client.text("/artifact", "application/vnd.github.diff", limit)),
			writeIssue: (method: "POST" | "PATCH") => run(write(method, "/repos/acme/widgets/issues", { title: "New title" }, PullRequest)),
		};
	},
});
