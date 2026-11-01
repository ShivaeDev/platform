import { Effect, Layer, Redacted, Schema } from "effect";
import { FetchHttpClient } from "effect/http";
import * as TestClock from "effect/testing/TestClock";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { read } from "#GitHub.ts";
import { GitHubConfig } from "#GitHubConfig.ts";
import { githubApp } from "#githubApp.ts";
import { withInstallation } from "#installationClients.ts";
import { APP_ID, PRIVATE_KEY } from "./appFixture.ts";
import { appServer } from "./appServer.ts";
import { answered } from "./outcome.ts";

const Repositories = Schema.Struct({ repositories: Schema.Array(Schema.Struct({ id: Schema.Number, name: Schema.String })) });

export const manyInstallations = storyKit({
	*create() {
		const { server } = yield* appServer;
		const context = yield* Layer.build(
			githubApp({ appId: APP_ID, privateKey: Redacted.make(PRIVATE_KEY) }).pipe(
				Layer.provide(FetchHttpClient.layer),
				Layer.provide(Layer.succeed(GitHubConfig)({ apiUrl: server.url })),
			),
		);
		return { context, server };
	},
	inspect: ({ server }) => ({ requests: server.requests.map(({ path, status }) => `${path}: ${status}`) }),
	name: "one App with many installations",
	stages: ["github"],
	verbs: ({ context, server }, story) => {
		server.narrate(story.tell);
		return {
			exchangeTally: () =>
				Effect.sync(() => {
					const tally: Record<string, number> = {};
					for (const request of server.requests.filter(({ path }) => path.endsWith("/access_tokens"))) {
						const id = request.params.installationId ?? "unknown";
						tally[id] = (tally[id] ?? 0) + 1;
					}
					return tally;
				}),
			readRepositories: (installationId: number) => {
				story.tell(`installation ${installationId} reads its repositories`);
				return answered(withInstallation(installationId, read("/installation/repositories", Repositories)).pipe(Effect.provide(context)));
			},
			readTogether: (installationIds: readonly number[]) => {
				story.tell(`installations ${installationIds.join(", ")} read their repositories concurrently`);
				return answered(
					Effect.all(
						installationIds.map((id) => withInstallation(id, read("/installation/repositories", Repositories))),
						{ concurrency: "unbounded" },
					).pipe(Effect.provide(context)),
				);
			},
			repositoryRequests: () =>
				Effect.sync(() =>
					server.requests
						.filter(({ path }) => path === "/installation/repositories")
						.map(({ headers, status }) => ({ etag: headers["if-none-match"] ?? "none", status })),
				),
			timePasses: (minutes: number) => {
				story.tell(`${minutes} minutes pass without installation requests`);
				return TestClock.adjust(`${minutes} minutes`);
			},
			tokenExchanges: () =>
				Effect.sync(() =>
					server.requests
						.filter(({ path }) => path.endsWith("/access_tokens"))
						.map(({ params, status }) => ({ installation: Number(params.installationId), status })),
				),
		};
	},
});

export const rejectsNextRead = manyInstallations.trait("github", "GitHub rejects the next repository read with 401", function* ({ server }) {
	yield* server.scriptFault("installedRepositories", { kind: "status", reply: { body: { message: "Bad credentials" }, status: 401 } });
});

export const limitsNextRead = manyInstallations.trait("github", "GitHub limits the next repository read for 120 seconds", function* ({ server }) {
	yield* server.scriptFault("installedRepositories", {
		kind: "status",
		reply: { body: { message: "secondary rate limit" }, headers: { "retry-after": "120" }, status: 429 },
	});
});

export const refusesNextExchange = manyInstallations.trait("github", "GitHub refuses the next token exchange", function* ({ server }) {
	yield* server.scriptFault("token", { kind: "status", reply: { status: 401 } });
});

export const bothInstallationsUsed = manyInstallations.trait(
	"github",
	"installations 7 and 8 have already read their repositories",
	function* ({ context }) {
		for (const installation of [7, 8]) {
			yield* withInstallation(installation, read("/installation/repositories", Repositories)).pipe(Effect.provide(context));
		}
	},
);
