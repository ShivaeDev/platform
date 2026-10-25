import { Clock, Effect, Layer, Redacted, type Schema } from "effect";
import { FetchHttpClient } from "effect/http";
import { fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { GitHub, read } from "#GitHub.ts";
import { GitHubConfig } from "#GitHubConfig.ts";
import { githubApp } from "#githubApp.ts";
import { verifyWebhook } from "#verifyWebhook.ts";
import { APP_ID, APP_TOKEN, inspectJwt, PRIVATE_KEY, WEBHOOK_SECRET, WORKFLOW_BODY, WorkflowDelivery, webhookSignature } from "./appFixture.ts";
import { PullRequest } from "./fixtures.ts";
import { telemetry } from "./telemetry.ts";

export const appGithub = storyKit({
	*create() {
		const clock = yield* Clock.Clock;
		const state: { exchanges: number; jwts: ReturnType<typeof inspectJwt>[] } = { exchanges: 0, jwts: [] };
		function check(request: Parameters<typeof inspectJwt>[0]) {
			const observed = inspectJwt(request, clock.currentTimeMillisUnsafe());
			state.jwts.push(observed);
			return (
				observed.valid
				&& observed.header.alg === "RS256"
				&& observed.claims.iss === APP_ID
				&& observed.claims.iat === observed.now - 60
				&& observed.claims.exp > observed.now
				&& observed.claims.exp <= observed.now + 600
			);
		}
		function accessTokenReply() {
			state.exchanges += 1;
			return {
				body: {
					"expires_at": new Date(clock.currentTimeMillisUnsafe() + 3_600_000).toISOString(),
					token: `${APP_TOKEN}-${state.exchanges}`,
				},
			};
		}
		const server = yield* fakeHttpService({
			routes: {
				installation: {
					guard: check,
					path: "/repos/acme/widgets/installation",
					reply: () => ({ body: { id: 7 } }),
				},
				pull: {
					guard: (request) => request.headers.authorization === `Bearer ${APP_TOKEN}-${state.exchanges}`,
					path: "/repos/acme/widgets/pulls/1",
					reply: () => ({ body: { number: 1, title: "App read" } }),
				},
				token: {
					guard: check,
					method: "POST",
					path: "/app/installations/7/access_tokens",
					reply: accessTokenReply,
				},
			},
		});
		const recording = telemetry();
		const environment = Layer.mergeAll(FetchHttpClient.layer, Layer.succeed(GitHubConfig)({ apiUrl: server.url }));
		function layer(installation: { installationId: number } | { owner: string; repository: string }, privateKey = PRIVATE_KEY) {
			return GitHub.layer.pipe(
				Layer.provide(githubApp({ appId: APP_ID, privateKey: Redacted.make(privateKey), ...installation })),
				Layer.provide(environment),
			);
		}
		const context = yield* Layer.build(layer({ installationId: 7 }));
		return { context, layer, recording, server, state };
	},
	inspect: ({ state }) => ({ exchanges: state.exchanges }),
	name: "GitHub App",
	stages: ["github"],
	verbs: ({ context, layer, recording, server, state }, story) => {
		server.narrate(story.tell);
		function record<A, E, R>(effect: Effect.Effect<A, E, R>) {
			return effect.pipe(Effect.withSpan("GitHub App operation"), Effect.provide(recording.layer));
		}
		return {
			exchanges: () => server.requests.filter(({ path }) => path === "/app/installations/7/access_tokens"),
			holdExchange: () => server.hold("token"),
			jwts: () => state.jwts,
			readPull: () => record(read("/repos/acme/widgets/pulls/1", PullRequest).pipe(Effect.provide(context))),
			readRepository: () =>
				record(read("/repos/acme/widgets/pulls/1", PullRequest).pipe(Effect.provide(layer({ owner: "acme", repository: "widgets" })))),
			readWithInvalidKey: () =>
				record(read("/repos/acme/widgets/pulls/1", PullRequest).pipe(Effect.provide(layer({ installationId: 7 }, "invalid-private-key-secret")))),
			rejectExchange: () =>
				server.replyOnce("token", (request) => ({
					body: { message: `${request.headers.authorization} ${PRIVATE_KEY} ${APP_TOKEN} ${WEBHOOK_SECRET}` },
					status: 401,
				})),
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
