import { Effect, Layer, Redacted } from "effect";
import { FetchHttpClient } from "effect/http";
import * as TestClock from "effect/testing/TestClock";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { GitHubConfig } from "#GitHubConfig.ts";
import { githubApp } from "#githubApp.ts";
import { GitHubApp } from "#installationClients.ts";
import { APP_ID, PRIVATE_KEY } from "./appFixture.ts";
import { appServer } from "./appServer.ts";
import { answered } from "./outcome.ts";

export const viewerRepositories = storyKit({
	*create() {
		const { server, viewer } = yield* appServer;
		viewer.enabled = true;
		const context = yield* Layer.build(
			githubApp({ appId: APP_ID, privateKey: Redacted.make(PRIVATE_KEY) }).pipe(
				Layer.provide(FetchHttpClient.layer),
				Layer.provide(Layer.succeed(GitHubConfig)({ apiUrl: server.url })),
			),
		);
		const scoped = yield* Layer.build(
			githubApp({ appId: APP_ID, installationId: 7, privateKey: Redacted.make(PRIVATE_KEY), scope: { repositoryIds: [42] } }).pipe(
				Layer.provide(FetchHttpClient.layer),
				Layer.provide(Layer.succeed(GitHubConfig)({ apiUrl: server.url })),
			),
		);
		return { context, scoped, server, viewer };
	},
	inspect: ({ server }) => ({ requests: server.requests.map(({ path, status }) => `${path}: ${status}`) }),
	name: "installed repositories visible to a GitHub account",
	stages: ["github"],
	verbs: ({ context, scoped, server, viewer }, story) => {
		server.narrate(story.tell);
		return {
			changePermission: (repository: string, permission: string, login = "alice") => {
				story.tell(`GitHub changes ${login}'s permission on ${repository} to ${permission}`);
				return Effect.sync(() => viewer.permissions.set(`${repository}/${login}`, permission));
			},
			readAccess: (account: number | string = "alice") => {
				story.tell(`the App reads repository access for ${account}`);
				return answered(Effect.flatMap(GitHubApp, (app) => app.viewerRepositories(account)).pipe(Effect.provide(context)));
			},
			readFromScopedApp: () => {
				story.tell("the App reads alice's repository access through an installation-scoped App Layer");
				return answered(Effect.flatMap(GitHubApp, (app) => app.viewerRepositories("alice")).pipe(Effect.provide(scoped)));
			},
			removeRepository: (installation: number, name: string) => {
				story.tell(`GitHub removes ${name} from installation ${installation}`);
				return Effect.sync(() => {
					viewer.repositories.set(
						installation,
						(viewer.repositories.get(installation) ?? []).filter((repository) => repository.name !== name),
					);
				});
			},
			requestsTo: (path: string) =>
				Effect.sync(() => server.requests.filter((request) => new URL(request.path, server.url).pathname === path).map(({ status }) => status)),
			timePasses: (seconds: number) => {
				story.tell(`${seconds} seconds pass`);
				return TestClock.adjust(`${seconds} seconds`);
			},
			tokenScopes: () => Effect.sync(() => server.requests.filter(({ path }) => path.endsWith("/access_tokens")).map(({ body }) => body.toString())),
		};
	},
});

export const noRepositories = viewerRepositories.trait("github", "the App's installations contain no repositories", ({ viewer }) =>
	Effect.sync(() => viewer.repositories.clear()),
);

export const permissionLookupFails = viewerRepositories.trait("github", "GitHub refuses the next permission lookup with 500", function* ({ server }) {
	yield* server.scriptFault("viewerPermission", { kind: "status", reply: { status: 500 } });
});

export const noInstallations = viewerRepositories.trait("github", "the App has no installations", function* ({ server }) {
	yield* server.scriptFault("installations", { kind: "status", reply: { body: [], status: 200 } });
});

export const unknownAccount = viewerRepositories.trait("github", "GitHub cannot find the account", function* ({ server }) {
	yield* server.scriptFault("accountLogin", { kind: "status", reply: { status: 404 } });
});
