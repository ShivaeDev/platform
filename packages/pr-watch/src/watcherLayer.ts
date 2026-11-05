import * as NodeServices from "@effect/platform-node/NodeServices";
import { Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import { GitHubToken } from "@shivaedev/github/GitHubToken.ts";
import { GitHub as GitHubClient } from "@shivaedev/github/github/service.ts";
import { GitHub } from "#github/service.ts";
import { GitHubHttp } from "#github-http/service.ts";
import { StateFile } from "#state-file/service.ts";
import { Watcher } from "#watcher/service.ts";

export const watcherLayer = Watcher.layer.pipe(
	Layer.provide(
		Layer.mergeAll(
			StateFile.layer,
			GitHub.layer.pipe(Layer.provide(GitHubHttp.layer.pipe(Layer.provide(GitHubClient.layer), Layer.provide(GitHubToken.fromEnvOrCli)))),
		),
	),
	Layer.provide(
		Layer.mergeAll(NodeServices.layer, FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.RequestInit)({ redirect: "error" })))),
	),
);
