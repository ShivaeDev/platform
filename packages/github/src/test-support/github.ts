import { Context, type Duration, Effect, Layer, Option, Redacted, Schema, Stream } from "effect";
import { FetchHttpClient } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import * as TestClock from "effect/testing/TestClock";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { GitHub, list, listBounded, read, write } from "#GitHub.ts";
import { GitHubConfig } from "#GitHubConfig.ts";
import { GitHubToken } from "#GitHubToken.ts";
import { budgetHeaders } from "./budgetHeaders.ts";
import { type FakeRepository, fakeRepository, SECONDARY_LIMIT } from "./fakeRepository.ts";
import { FIXTURE_TOKEN, PRIVATE_QUERY, PullRequest } from "./fixtures.ts";
import { answered, clockTime } from "./outcome.ts";
import { readWithCliToken } from "./readWithCliToken.ts";
import { environmentToken, readWithEnvironment, type TokenVariable } from "./readWithEnvironment.ts";
import { telemetry } from "./telemetry.ts";
import { rateLimitEvents, rateLimitLogs, seenIn } from "./telemetryReadouts.ts";
import { writeVerbs } from "./writeVerbs.ts";

const SearchResult = Schema.Struct({ totalCount: Schema.Number }).pipe(Schema.encodeKeys({ totalCount: "total_count" }));
const credentialNames = new Map<string | undefined, string>([
	[`Bearer ${FIXTURE_TOKEN}`, "the configured token"],
	[`Bearer ${environmentToken("GH_TOKEN")}`, "GH_TOKEN"],
	[`Bearer ${environmentToken("GITHUB_TOKEN")}`, "GITHUB_TOKEN"],
	[undefined, "no credential"],
	["Bearer cli-token", "gh credential"],
]);

function credentialOf(authorization: string | undefined) {
	return credentialNames.get(authorization) ?? `an unknown credential: ${authorization}`;
}

export const github = storyKit({
	*create() {
		const repository = yield* fakeRepository;
		const recording = telemetry();
		const layer = GitHub.layer.pipe(
			Layer.provide(
				Layer.mergeAll(
					FetchHttpClient.layer,
					Layer.succeed(GitHubToken)(Option.some(Redacted.make(FIXTURE_TOKEN))),
					Layer.succeed(GitHubConfig)({ apiUrl: repository.server.url }),
				),
			),
		);
		const context = yield* Layer.build(Layer.fresh(layer));
		const failures: unknown[] = [];
		return { ...repository, client: Context.get(context, GitHub), context, failures, recording };
	},
	inspect: ({ server }) => ({ requests: server.requests.map(({ method, path, status }) => `${method} ${path} ${status}`) }),
	name: "GitHub REST client",
	stages: ["github"],
	verbs: (engine, story) => {
		const { client, context, failures, recording, server, state } = engine;
		server.narrate(story.tell);
		function run<A, E>(effect: Effect.Effect<A, E, Context.Service.Identifier<typeof GitHub>>) {
			return effect.pipe(Effect.provide(context), Effect.withSpan("GitHub request"), Effect.provide(recording.layer));
		}
		function attempt<A, E>(line: string, effect: Effect.Effect<A, E, Context.Service.Identifier<typeof GitHub>>) {
			return Effect.suspend(() => {
				story.tell(line);
				return answered(run(effect), failures);
			});
		}
		const pacingCalls: string[] = [];
		function pacing(refusedCall: number | undefined) {
			return (resource: string) =>
				Effect.suspend(() => {
					pacingCalls.push(resource);
					return pacingCalls.length === refusedCall ? Effect.fail(new ServiceUnavailable({ message: "pacing budget spent" })) : Effect.void;
				});
		}
		function received(route: (path: string) => boolean) {
			return server.requests.filter(({ path }) => route(path.split("?")[0] ?? path));
		}
		return {
			...writeVerbs(client, engine satisfies FakeRepository, run, story.tell),
			archiveRequestHeaders: () =>
				Effect.sync(() =>
					received((path) => path === "/repos/acme/widgets/actions/artifacts/7/zip" || path === "/storage/archive.zip").map(({ headers, path }) => ({
						apiVersion: headers["x-github-api-version"] ?? "none",
						credential: credentialOf(headers.authorization),
						to: path.startsWith("/storage/") ? "storage" : "GitHub",
					})),
				),
			coreBudgetSpentElsewhere: (remaining: number, reset: number) =>
				Effect.sync(() => {
					story.tell(`other clients spend the core budget down to ${remaining} with its reset moved to ${reset} seconds`);
					state.budgets.core = { ...state.budgets.core, remaining, reset };
				}),
			credentialsSent: () => Effect.sync(() => server.requests.map(({ headers }) => credentialOf(headers.authorization))),
			downloadArchive: (byteLimit = 8) =>
				attempt(
					`the client downloads artifact 7 within ${byteLimit} bytes`,
					Effect.flatMap(GitHub, (service) => service.downloadArtifactArchive({ artifactId: 7, byteLimit, owner: "acme", repo: "widgets" })),
				),
			failureCauseStorage: () =>
				Effect.sync(() =>
					failures.map((failure) => ({
						enumerable: Object.prototype.propertyIsEnumerable.call(failure, "cause"),
						failure: failure instanceof Error ? failure.name : "unknown",
						hasCause: failure instanceof Error && failure.cause !== undefined,
					})),
				),
			headersSent: () =>
				Effect.sync(() =>
					server.requests.map(({ headers }) => ({
						accept: headers.accept,
						apiVersion: headers["x-github-api-version"],
						credential: credentialOf(headers.authorization),
					})),
				),
			listPulls: (take?: number) =>
				attempt(
					take === undefined ? "the client lists every pull request" : `the client takes ${take} pull request from the list`,
					list("/repos/acme/widgets/pulls", PullRequest).pipe(
						(stream) => (take === undefined ? stream : Stream.take(stream, take)),
						Stream.runCollect,
					),
				),
			listPullsBounded: (pageCap: number, byteLimit?: number) =>
				attempt(
					`the client lists pull requests within ${pageCap} pages${byteLimit === undefined ? "" : ` and ${byteLimit} bytes a page`}`,
					listBounded("/repos/acme/widgets/pulls", PullRequest, pageCap, byteLimit),
				),
			listPullsPaced: (refusedCall?: number) =>
				attempt(
					refusedCall === undefined
						? "the client lists every pull request through a pacing callback"
						: `the client lists every pull request through a pacing callback that refuses its call ${refusedCall}`,
					Effect.flatMap(GitHub, (service) => service.list("/repos/acme/widgets/pulls", pacing(refusedCall))).pipe(Effect.flatMap(Stream.runCount)),
				),
			observations: () =>
				Effect.map(client.observations(), (observed) => observed.map(({ reset, ...budget }) => ({ ...budget, reset: clockTime(reset) }))),
			pacingCalls: () => Effect.sync(() => [...pacingCalls]),
			pagesRequested: () =>
				Effect.sync(() => received((path) => path === "/repos/acme/widgets/pulls").map(({ query }) => Number(query.get("page") ?? 1))),
			privateQuerySeenIn: () => Effect.sync(() => seenIn(PRIVATE_QUERY, recording, failures, ["failures", "logs", "span events"])),
			rateLimitEvents: () => Effect.sync(() => rateLimitEvents(recording)),
			rateLimitLogs: () => Effect.sync(() => rateLimitLogs(recording)),
			readDiff: (byteLimit = 1024) =>
				attempt(
					`the client reads pull request 1 as a diff within ${byteLimit} bytes`,
					Effect.flatMap(GitHub, (service) => service.text("/repos/acme/widgets/pulls/1", "application/vnd.github.diff", byteLimit)),
				),
			readLogo: (byteLimit = 1024) =>
				attempt(
					`the client reads logo.png raw within ${byteLimit} bytes`,
					Effect.flatMap(GitHub, (service) => service.bytes("/repos/acme/widgets/contents/logo.png", "application/vnd.github.raw", byteLimit)),
				),
			readPull: (number = 1) => attempt(`the client reads pull request ${number}`, read(`/repos/acme/widgets/pulls/${number}`, PullRequest)),
			readPullAs: <TSchema extends Schema.ConstraintDecoder<unknown>>(name: string, schema: TSchema) =>
				attempt(`the client reads pull request 1 as ${name}`, read("/repos/acme/widgets/pulls/1", schema)),
			readPullWithin: (byteLimit: number) =>
				attempt(`the client reads pull request 1 within ${byteLimit} bytes`, read("/repos/acme/widgets/pulls/1", PullRequest, byteLimit)),
			readPullWithPrivateQuery: () =>
				attempt("the client reads pull request 1 with a private query", read(`/repos/acme/widgets/pulls/1?ref=${PRIVATE_QUERY}`, PullRequest)),
			readWithCliToken: (token: string | undefined, variables?: Record<string, string>) =>
				Effect.suspend(() => {
					story.tell("a client reads with environment credentials or gh authentication");
					return answered(readWithCliToken(server.url, token, variables), failures);
				}),
			readWithEnvironment: (variables: readonly TokenVariable[]) =>
				Effect.suspend(() => {
					story.tell(`a client built from an environment with ${variables.join(" and ") || "no token variable"} reads pull request 1`);
					return answered(readWithEnvironment(server.url, variables));
				}),
			readWithMissingGh: () =>
				Effect.suspend(() => {
					story.tell("a client reads without token variables or an installed gh command");
					return answered(readWithCliToken(server.url, undefined, {}, false), failures);
				}),
			requests: () => Effect.sync(() => server.requests.map(({ method, path, status }) => `${method} ${path} ${status}`)),
			resourceOf: (path: string) => Effect.flatMap(GitHub, (service) => service.resource(path)).pipe(Effect.provide(context)),
			revalidations: () =>
				Effect.sync(() =>
					received((path) => path.startsWith("/repos/acme/widgets/pulls/")).map(({ headers }) => headers["if-none-match"] ?? "no ETag"),
				),
			search: () => attempt("the client searches issues with a private query", read(`/search/issues?q=${PRIVATE_QUERY}`, SearchResult)),
			searchCode: () => attempt("the client searches code", read("/search/code?q=widgets", SearchResult)),
			secondaryLimitStrikesAgain: () =>
				Effect.gen(function* () {
					story.tell("GitHub strikes the next read of pull request 1 with a message-only secondary rate limit");
					yield* server.scriptFault("pull", {
						kind: "status",
						reply: {
							body: { message: SECONDARY_LIMIT },
							headers: budgetHeaders("core", { limit: 5000, remaining: 40, reset: 3600 }),
							status: HttpStatus.fromLiteral("Forbidden"),
						},
					});
				}),
			spanNames: () => Effect.sync(() => recording.spans.map(({ name }) => name)),
			timePasses: (duration: Duration.Input) =>
				Effect.suspend(() => {
					story.tell(`${duration} pass`);
					return TestClock.adjust(duration);
				}),
			tokenSeenIn: () => Effect.sync(() => seenIn(FIXTURE_TOKEN, recording, failures, ["failures", "logs", "spans"])),
			writeIssue: (method: "POST" | "PATCH", title: string) =>
				attempt(
					method === "POST" ? `the client opens an issue titled "${title}"` : `the client retitles issue 2 to "${title}"`,
					write(method, method === "POST" ? "/repos/acme/widgets/issues" : "/repos/acme/widgets/issues/2", { title }, PullRequest),
				),
		};
	},
});
