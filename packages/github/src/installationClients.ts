import { Cache, Context, Effect, Layer } from "effect";
import { HttpClient } from "effect/http";
import { defineService } from "@shivaedev/service/defineService.ts";
import type { AppCredentials } from "#appJwt.ts";
import { appTokens } from "#appTokens.ts";
import { GitHub } from "#GitHub.ts";
import { GitHubConfig } from "#GitHubConfig.ts";
import { viewerRepositoryAccess } from "#viewerRepositoryAccess.ts";

export const GitHubAppCredentials = Context.Service<{ readonly credentials: AppCredentials }>("@shivaedev/github/AppCredentials");

export const GitHubApp = defineService({
	id: "@shivaedev/github/GitHubApp",
	initialize: Effect.gen(function* () {
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
		function installation(id: number) {
			return Cache.get(clients, id).pipe(Effect.tap((client) => Cache.set(clients, id, client)));
		}
		return { installation, viewers: yield* viewerRepositoryAccess(app, installation) };
	}),
	methods: ({ installation, viewers }) => ({
		installation,
		viewerRepositories: (account: number | string) =>
			Cache.get(viewers, typeof account === "number" ? `id:${account}` : `login:${account.toLowerCase()}`),
	}),
	requires: [GitHubAppCredentials, HttpClient.HttpClient, GitHubConfig],
});

export function withInstallation<A, E, R>(installationId: number, effect: Effect.Effect<A, E, R>) {
	return Effect.flatMap(GitHubApp, (app) =>
		Effect.flatMap(app.installation(installationId), (client) => Effect.provideService(effect, GitHub, client)),
	);
}
