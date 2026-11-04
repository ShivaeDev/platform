import { Effect } from "effect";
import { GitHubApp } from "#app/GitHub.ts";
import { GitHub } from "#GitHub.ts";

export function withInstallation<A, E, R>(installationId: number, effect: Effect.Effect<A, E, R>) {
	return Effect.flatMap(GitHubApp, (app) =>
		Effect.flatMap(app.installation(installationId), (client) => Effect.provideService(effect, GitHub, client)),
	);
}
