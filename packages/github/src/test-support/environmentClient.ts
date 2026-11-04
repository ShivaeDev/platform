import { NodeHttpClient } from "@effect/platform-node";
import { Context, Effect, Layer, Option, Redacted } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { GitHub } from "#GitHub.ts";
import { GitHubConfig } from "#GitHubConfig.ts";
import { GitHubToken } from "#GitHubToken.ts";
import { read } from "#read.ts";
import { fakeRepository } from "./fakeRepository.ts";
import { FIXTURE_TOKEN, PullRequest } from "./fixtures.ts";
import { answered } from "./outcome.ts";

export function environmentClient(transport: "Fetch" | "Node") {
	const github = storyKit({
		*create() {
			const repository = yield* fakeRepository;
			const suppliedClient = Layer.effect(HttpClient.HttpClient)(
				Effect.map(HttpClient.HttpClient, (client) => HttpClient.mapRequest(client, HttpClientRequest.setHeader("x-supplied-client", transport))),
			).pipe(Layer.provide(transport === "Fetch" ? FetchHttpClient.layer : NodeHttpClient.layerNodeHttp));
			const context = yield* Layer.build(
				GitHub.layer.pipe(
					Layer.provide(
						Layer.mergeAll(
							suppliedClient,
							Layer.succeed(GitHubToken)(Option.some(Redacted.make(FIXTURE_TOKEN))),
							Layer.succeed(GitHubConfig)({ apiUrl: repository.server.url }),
						),
					),
				),
			);
			return { ...repository, client: Context.get(context, GitHub), context };
		},
		name: `GitHub with the supplied ${transport} client`,
		stages: ["github"],
		verbs: ({ client, context, server }, story) => {
			server.narrate(story.tell);
			return {
				downloadArchive: () => {
					story.tell("the client downloads artifact 7");
					return answered(client.downloadArtifactArchive({ artifactId: 7, byteLimit: 1024, owner: "acme", repo: "widgets" }));
				},
				readPull: () => {
					story.tell("the client reads pull request 1");
					return read("/repos/acme/widgets/pulls/1", PullRequest).pipe(Effect.provide(context));
				},
				requestsReceived: () =>
					Effect.sync(() => server.requests.map(({ headers, path }) => ({ client: headers["x-supplied-client"], path: path.split("?")[0] }))),
			};
		},
	});
	return {
		...github,
		storageRedirects: github.trait("github", "storage redirects the archive to another URL", ({ archive }) =>
			Effect.sync(() => {
				archive.archive = { headers: { Location: "/storage/another.zip" }, status: HttpStatus.fromLiteral("Found") };
			}),
		),
	};
}
