import { Layer } from "effect";
import { GitHub as GitHubClient } from "@shivaedev/github/GitHub.ts";
import { GitHubToken } from "@shivaedev/github/GitHubToken.ts";
import { GitHub } from "#github/service.ts";
import { GitHubHttp } from "#github-http/service.ts";
import { StateFile } from "#state-file/service.ts";
import { Watcher } from "#watcher/service.ts";

export const services = Watcher.layer.pipe(
	Layer.provide(
		Layer.mergeAll(
			StateFile.layer,
			GitHub.layer.pipe(Layer.provide(GitHubHttp.layer.pipe(Layer.provide(GitHubClient.layer), Layer.provide(GitHubToken.fromEnvOrCli)))),
		),
	),
);
