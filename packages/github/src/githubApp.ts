import { Layer } from "effect";
import { appTokens } from "#adapters/appTokens.ts";
import { GitHubApp } from "#app/service.ts";
import type { AppCredentials } from "#appJwt.ts";
import { GitHubAppCredentials } from "#GitHubAppCredentials.ts";
import { githubClientsLayer } from "#githubClientsLayer.ts";

export interface InstallationScope {
	readonly permissions?: Readonly<Record<string, "read" | "write" | "admin">>;
	readonly repositories?: readonly string[];
	readonly repositoryIds?: readonly number[];
}

export type GitHubAppOptions = AppCredentials &
	(
		| { readonly installationId: number; readonly scope?: InstallationScope }
		| { readonly owner: string; readonly repository: string; readonly scope?: InstallationScope }
		| { readonly installationId?: never; readonly owner?: never; readonly repository?: never; readonly scope?: never }
	);

export function githubApp(options: GitHubAppOptions) {
	const authentication = appTokens(options);
	return Layer.merge(
		authentication,
		GitHubApp.layer.pipe(Layer.provide(githubClientsLayer), Layer.provide(Layer.succeed(GitHubAppCredentials)({ credentials: options }))),
	);
}
