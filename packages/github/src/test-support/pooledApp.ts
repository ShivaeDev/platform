import { NodeHttpClient } from "@effect/platform-node";
import { Layer, Redacted } from "effect";
import { GitHub } from "#GitHub.ts";
import { GitHubConfig } from "#GitHubConfig.ts";
import { githubApp } from "#githubApp.ts";
import { APP_ID, PRIVATE_KEY } from "./appFixture.ts";

export function pooledApp(apiUrl: string) {
	return GitHub.layer.pipe(
		Layer.provide(githubApp({ appId: APP_ID, installationId: 7, privateKey: Redacted.make(PRIVATE_KEY) })),
		Layer.provide(Layer.mergeAll(NodeHttpClient.layerNodeHttpOptions({ keepAlive: true, maxSockets: 1 }), Layer.succeed(GitHubConfig)({ apiUrl }))),
	);
}
