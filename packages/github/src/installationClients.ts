import { Cache, Context, Effect, Layer } from "effect";
import { HttpClient } from "effect/http";
import { defineService } from "@shivaedev/service/defineService.ts";
import type { AppCredentials } from "#appJwt.ts";
import { appTokens } from "#appTokens.ts";
import { GitHub } from "#GitHub.ts";
import { GitHubConfig } from "#GitHubConfig.ts";

export const GitHubAppCredentials = Context.Service<{ readonly credentials: AppCredentials }>("@shivaedev/github/AppCredentials");

export const GitHubApp = defineService({
	id: "@shivaedev/github/GitHubApp",
	initialize: Effect.gen(function* () {
		const { credentials } = yield* GitHubAppCredentials;
		const http = yield* HttpClient.HttpClient;
		const config = yield* GitHubConfig;
		return yield* Cache.make({
			capacity: 100,
			lookup: (installationId: number) =>
				Layer.build(
					GitHub.layer.pipe(
						Layer.provide(appTokens({ ...credentials, installationId })),
						Layer.provide(Layer.succeed(HttpClient.HttpClient)(http)),
						Layer.provide(Layer.succeed(GitHubConfig)(config)),
					),
				).pipe(
					Effect.scoped,
					Effect.map((context) => Context.get(context, GitHub)),
				),
			timeToLive: "30 minutes",
		});
	}),
	methods: (clients) => ({
		installation: (installationId: number) =>
			Cache.get(clients, installationId).pipe(Effect.tap((client) => Cache.set(clients, installationId, client))),
	}),
	requires: [GitHubAppCredentials, HttpClient.HttpClient, GitHubConfig],
});

export function withInstallation<A, E, R>(installationId: number, effect: Effect.Effect<A, E, R>) {
	return Effect.flatMap(GitHubApp, (app) =>
		Effect.flatMap(app.installation(installationId), (client) => Effect.provideService(effect, GitHub, client)),
	);
}
