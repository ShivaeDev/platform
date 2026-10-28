import { Layer } from "effect";
import { GitHub as GitHubClient } from "@shivaedev/github/GitHub.ts";
import { GitHub } from "#GitHub.ts";
import { GitHubHttp } from "#GitHubHttp.ts";
import { githubToken } from "#githubToken.ts";
import { StateFile } from "#StateFile.ts";
import { Watcher } from "#Watcher.ts";

export const services = Watcher.layer.pipe(
	Layer.provide(
		Layer.mergeAll(
			StateFile.layer,
			GitHub.layer.pipe(Layer.provide(GitHubHttp.layer.pipe(Layer.provide(GitHubClient.layer), Layer.provide(githubToken)))),
		),
	),
);
