import { Effect, Layer, Redacted, Schema, Stream } from "effect";
import { FetchHttpClient } from "effect/http";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { GitHub, list, read } from "#GitHub.ts";
import { GitHubConfig } from "#GitHubConfig.ts";
import { githubApp, type InstallationScope } from "#githubApp.ts";
import { verifyWebhook } from "#verifyWebhook.ts";
import { APP_ID, APP_TOKEN, PRIVATE_KEY, WEBHOOK_SECRET, WORKFLOW_BODY, WorkflowDelivery, webhookSignature } from "./appFixture.ts";
import { appServer } from "./appServer.ts";
import { PullRequest } from "./fixtures.ts";
import { telemetry } from "./telemetry.ts";

const App = Schema.Struct({ appId: Schema.Number, slug: Schema.String }).pipe(Schema.encodeKeys({ appId: "id" }));
const Installation = Schema.Struct({ account: Schema.Struct({ login: Schema.String }), installationId: Schema.Number }).pipe(
	Schema.encodeKeys({ installationId: "id" }),
);

export const appGithub = storyKit({
	*create() {
		const { server, state } = yield* appServer;
		const recording = telemetry();
		const environment = Layer.mergeAll(FetchHttpClient.layer, Layer.succeed(GitHubConfig)({ apiUrl: server.url }));
		function layer(
			installation:
				| { installationId: number; scope?: InstallationScope }
				| { owner: string; repository: string }
				| { installationId?: never; owner?: never; repository?: never },
			privateKey = PRIVATE_KEY,
		) {
			return GitHub.layer.pipe(
				Layer.provide(githubApp({ appId: APP_ID, privateKey: Redacted.make(privateKey), ...installation })),
				Layer.provide(environment),
			);
		}
		const context = yield* Layer.build(layer({ installationId: 7 }));
		const appContext = yield* Layer.build(layer({}));
		const metadataContext = yield* Layer.build(layer({ installationId: 7, scope: { permissions: { metadata: "read" }, repositoryIds: [42] } }));
		const scopedContext = yield* Layer.build(layer({ installationId: 7, scope: { permissions: { contents: "read" }, repositories: ["widgets"] } }));
		return { appContext, context, layer, metadataContext, recording, scopedContext, server, state };
	},
	inspect: ({ state }) => ({ exchanges: state.exchanges }),
	name: "GitHub App",
	stages: ["github"],
	verbs: ({ appContext, context, layer, metadataContext, recording, scopedContext, server, state }, story) => {
		server.narrate(story.tell);
		function record<A, E, R>(effect: Effect.Effect<A, E, R>) {
			return effect.pipe(Effect.withSpan("GitHub App operation"), Effect.provide(recording.layer));
		}
		return {
			awaitPulls: (count: number) =>
				Effect.yieldNow.pipe(
					Effect.andThen(Effect.sync(() => server.requests.filter(({ path }) => path === "/repos/acme/widgets/pulls/1").length)),
					Effect.repeat({ while: (arrived) => arrived < count }),
					Effect.asVoid,
				),
			downloadArchive: () =>
				record(
					Effect.flatMap(GitHub, (github) =>
						github.downloadArtifactArchive({
							artifactId: 42,
							byteLimit: 1024,
							owner: "acme",
							repo: "widgets",
						}),
					).pipe(Effect.provide(context)),
				),
			exchanges: () => server.requests.filter(({ path }) => path === "/app/installations/7/access_tokens"),
			holdExchange: () => server.hold("token"),
			holdPulls: () => server.hold("pull", { once: false }),
			jwts: () => state.jwts,
			listInstallations: () => record(list("/app/installations", Installation).pipe(Stream.runCollect, Effect.provide(appContext))),
			readApp: () => record(read("/app", App).pipe(Effect.provide(appContext))),
			readMetadata: () =>
				record(read("/repos/acme/widgets", Schema.Struct({ id: Schema.Number, name: Schema.String })).pipe(Effect.provide(metadataContext))),
			readPull: () => record(read("/repos/acme/widgets/pulls/1", PullRequest).pipe(Effect.provide(context))),
			readRepository: () =>
				record(read("/repos/acme/widgets/pulls/1", PullRequest).pipe(Effect.provide(layer({ owner: "acme", repository: "widgets" })))),
			readScopedPull: () => record(read("/repos/acme/widgets/pulls/1", PullRequest).pipe(Effect.provide(scopedContext))),
			readWithInvalidKey: () =>
				record(read("/repos/acme/widgets/pulls/1", PullRequest).pipe(Effect.provide(layer({ installationId: 7 }, "invalid-private-key-secret")))),
			rejectArchive: () => server.replyOnce("artifact", { status: 401 }),
			rejectExchange: () =>
				server.replyOnce("token", (request) => ({
					body: { message: `${request.headers.authorization} ${PRIVATE_KEY} ${APP_TOKEN} ${WEBHOOK_SECRET}` },
					status: 401,
				})),
			rejectPull: () => server.replyOnce("pull", { status: 401 }),
			requests: () => server.requests,
			secrets: () => [
				PRIVATE_KEY,
				"invalid-private-key-secret",
				APP_TOKEN,
				WEBHOOK_SECRET,
				...server.requests.map(({ headers }) => headers.authorization?.replace(/^Bearer /u, "") ?? "").filter(Boolean),
			],
			telemetry: () => recording,
			verifyAs: <TSchema extends Schema.Constraint>(body: Uint8Array, signature: string | undefined, schema: TSchema, secret = WEBHOOK_SECRET) =>
				record(verifyWebhook(body, signature, Redacted.make(secret), schema)),
			verifyDelivery: (body = WORKFLOW_BODY, signature: string | undefined = webhookSignature(), secret = WEBHOOK_SECRET) =>
				record(verifyWebhook(body, signature, Redacted.make(secret), WorkflowDelivery)),
		};
	},
});
