import { ConfigProvider, Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import { GitHub, read } from "#GitHub.ts";
import { GitHubConfig } from "#GitHubConfig.ts";
import { GitHubToken } from "#GitHubToken.ts";
import { PullRequest } from "./fixtures.ts";

export type TokenVariable = "GH_TOKEN" | "GITHUB_TOKEN";

export function environmentToken(variable: TokenVariable) {
	return `${variable.toLowerCase().replaceAll("_", "-")}-value`;
}

export function readWithEnvironment(apiUrl: string, variables: readonly TokenVariable[]) {
	const layer = GitHub.layer.pipe(
		Layer.provide(Layer.mergeAll(FetchHttpClient.layer, GitHubToken.fromEnv, Layer.succeed(GitHubConfig)({ apiUrl }))),
		Layer.provide(
			ConfigProvider.layer(ConfigProvider.fromEnvRecord(Object.fromEntries(variables.map((variable) => [variable, environmentToken(variable)])))),
		),
	);
	return read("/repos/acme/widgets/pulls/1", PullRequest).pipe(Effect.provide(layer));
}
