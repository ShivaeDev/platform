import { Cache, Context, Effect, Layer } from "effect";
import { HttpClient } from "effect/http";
import { appTokens } from "#adapters/appTokens.ts";
import { GitHubAppCredentials } from "#GitHubAppCredentials.ts";
import { GitHubClients } from "#GitHubClients.ts";
import { GitHubConfig } from "#GitHubConfig.ts";
import { GitHub } from "#github/service.ts";

export const githubClientsLayer = Layer.effect(GitHubClients)(
	Effect.gen(function* () {
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
		return { app, installation: (id: number) => Cache.get(clients, id).pipe(Effect.tap((client) => Cache.set(clients, id, client))) };
	}),
);
