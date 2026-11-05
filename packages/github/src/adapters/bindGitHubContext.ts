import { Context, Effect } from "effect";
import { HttpClient } from "effect/http";
import { GitHubConfig } from "#GitHubConfig.ts";
import { GitHubToken } from "#GitHubToken.ts";
import { TokenRefresh } from "#TokenRefresh.ts";

export function bindGitHubContext<A, E, R>(effect: Effect.Effect<A, E, R>) {
	return Effect.withFiber((fiber) => {
		const context = Context.make(HttpClient.HttpClient, Context.getUnsafe(fiber.context, HttpClient.HttpClient)).pipe(
			Context.add(GitHubToken, Context.getUnsafe(fiber.context, GitHubToken)),
			Context.add(GitHubConfig, Context.getUnsafe(fiber.context, GitHubConfig)),
			Context.add(TokenRefresh, Context.getUnsafe(fiber.context, TokenRefresh)),
		);
		return Effect.provide(effect, context);
	});
}
