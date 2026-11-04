import { Cache, Context, Effect, Layer } from "effect";
import { HttpClient } from "effect/http";
import { appTokens } from "#appTokens.ts";
import { GitHub } from "#GitHub.ts";
import { GitHubAppCredentials } from "#GitHubAppCredentials.ts";
import { GitHubConfig } from "#GitHubConfig.ts";
import { installation } from "#operations/installation.ts";
import { viewerRepositoryAccess } from "#viewerRepositoryAccess.ts";

export const initializeGitHubApp = Effect.gen(function* () {
	const { credentials: supplied } = yield* GitHubAppCredentials;
	const credentials = { appId: supplied.appId, privateKey: supplied.privateKey };
	const http = yield* HttpClient.HttpClient;
	const config = yield* GitHubConfig;
	const environment = Layer.mergeAll(Layer.succeed(HttpClient.HttpClient)(http), Layer.succeed(GitHubConfig)(config));
	const app = yield* Layer.build(GitHub.layer.pipe(Layer.provide(appTokens(credentials)), Layer.provide(environment))).pipe(
		Effect.scoped,
		Effect.map((context) => Context.get(context, GitHub)),
	);
	const clients = yield* Cache.make({
		capacity: 100,
		lookup: (installationId: number) =>
			Layer.build(GitHub.layer.pipe(Layer.provide(appTokens({ ...credentials, installationId })), Layer.provide(environment))).pipe(
				Effect.scoped,
				Effect.map((context) => Context.get(context, GitHub)),
			),
		timeToLive: "30 minutes",
	});
	const getInstallation = installation(clients);
	return { clients, viewers: yield* viewerRepositoryAccess(app, getInstallation) };
});
