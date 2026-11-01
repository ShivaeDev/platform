import { Layer } from "effect";
import type { AppCredentials } from "#appJwt.ts";
import { appTokens } from "#appTokens.ts";
import { GitHubApp, GitHubAppCredentials } from "#installationClients.ts";

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
	return Layer.merge(authentication, GitHubApp.layer.pipe(Layer.provide(Layer.succeed(GitHubAppCredentials)({ credentials: options }))));
}
