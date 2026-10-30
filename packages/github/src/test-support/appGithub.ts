import { Deferred, type Duration, Effect, Fiber, Layer, Redacted, Schema, Stream } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import * as TestClock from "effect/testing/TestClock";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { GitHub, list, read } from "#GitHub.ts";
import { GitHubConfig } from "#GitHubConfig.ts";
import { githubApp, type InstallationScope } from "#githubApp.ts";
import { verifyWebhook } from "#verifyWebhook.ts";
import {
	APP_ID,
	APP_TOKEN,
	appJwtOf,
	INVALID_PRIVATE_KEY,
	PRIVATE_KEY,
	unencodableScope,
	WEBHOOK_SECRET,
	WORKFLOW_BODY,
	WRONG_SECRET,
	webhookSignature,
} from "./appFixture.ts";
import { appServer } from "./appServer.ts";
import { appTransport } from "./appTransport.ts";
import { PullRequest } from "./fixtures.ts";
import { answered } from "./outcome.ts";
import { telemetry } from "./telemetry.ts";
import { seenIn } from "./telemetryReadouts.ts";

const App = Schema.Struct({ appId: Schema.Number, slug: Schema.String }).pipe(Schema.encodeKeys({ appId: "id" }));
const Installation = Schema.Struct({ account: Schema.Struct({ login: Schema.String }), installationId: Schema.Number }).pipe(
	Schema.encodeKeys({ installationId: "id" }),
);
const PULL = "/repos/acme/widgets/pulls/1";
const ZIP = "/repos/acme/widgets/actions/artifacts/7/zip";
const EXCHANGE = "/app/installations/7/access_tokens";

const scopes = {
	"access-check": { permissions: { metadata: "read" }, repositoryIds: [42] },
	background: undefined,
	contents: { permissions: { contents: "read" }, repositories: ["widgets"] },
} satisfies Record<string, InstallationScope | undefined>;
export type Scope = keyof typeof scopes;

export type Delivery = "a signed delivery" | "a tampered body" | "the wrong secret" | "a missing signature header" | "a malformed signature header";
const deliveries: Record<Delivery, { body: Uint8Array; secret: string; signature: string | undefined }> = {
	"a malformed signature header": { body: WORKFLOW_BODY, secret: WEBHOOK_SECRET, signature: "sha256=abc123" },
	"a missing signature header": { body: WORKFLOW_BODY, secret: WEBHOOK_SECRET, signature: undefined },
	"a signed delivery": { body: WORKFLOW_BODY, secret: WEBHOOK_SECRET, signature: webhookSignature() },
	"a tampered body": { body: Buffer.from('{"action":"requested"}'), secret: WEBHOOK_SECRET, signature: webhookSignature() },
	"the wrong secret": { body: WORKFLOW_BODY, secret: WRONG_SECRET, signature: webhookSignature() },
};

export const appGithub = storyKit({
	*create() {
		const { server, state } = yield* appServer;
		const recording = telemetry();
		const transport = appTransport();
		const environment = Layer.mergeAll(transport.layer, Layer.succeed(GitHubConfig)({ apiUrl: server.url }));
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
		const contexts = {
			"access-check": yield* Layer.build(layer({ installationId: 7, scope: scopes["access-check"] })),
			app: yield* Layer.build(layer({})),
			background: yield* Layer.build(layer({ installationId: 7 })),
			contents: yield* Layer.build(layer({ installationId: 7, scope: scopes.contents })),
			repository: yield* Layer.build(layer({ owner: "acme", repository: "widgets" })),
		};
		const decoded = { count: 0 };
		const delivery = Schema.Struct({
			action: Schema.String,
			workflowRun: Schema.Struct({ conclusion: Schema.String, id: Schema.Number }),
		})
			.pipe(Schema.encodeKeys({ workflowRun: "workflow_run" }))
			.check(
				Schema.makeFilter(() => {
					decoded.count += 1;
					return true;
				}),
			);
		const failures: unknown[] = [];
		return { contexts, decoded, delivery, failures, layer, recording, server, state, transportFailures: transport.failures };
	},
	inspect: ({ server }) => ({ requests: server.requests.map(({ method, path, status }) => `${method} ${path} ${status}`) }),
	name: "GitHub App",
	stages: ["github"],
	verbs: ({ contexts, decoded, delivery: deliverySchema, failures, layer, recording, server, state, transportFailures }, story) => {
		server.narrate(story.tell);
		const engineAnswers: { receiver: unknown } = { receiver: "nothing received" };
		function credentialOf(authorization: string | undefined) {
			if (authorization === undefined) {
				return "no credential";
			}
			const token = authorization.match(new RegExp(`^Bearer ${APP_TOKEN}-(\\d+)$`, "u"));
			if (token !== null) {
				return `installation token ${token[1]}`;
			}
			return appJwtOf(authorization, 0)?.signedBy === "the App's key" ? "an App JWT" : "an unknown credential";
		}
		function attempt<A, E, R>(line: string, effect: Effect.Effect<A, E, R>) {
			return Effect.suspend(() => {
				story.tell(line);
				return answered(effect.pipe(Effect.withSpan("GitHub App operation"), Effect.provide(recording.layer)), failures);
			});
		}
		function readPull() {
			return attempt("the background client reads pull request 1", read(PULL, PullRequest).pipe(Effect.provide(contexts.background)));
		}
		function answersTo(path: string) {
			return Effect.sync(() =>
				server.requests.filter((request) => request.path === path).map(({ headers, status }) => `${credentialOf(headers.authorization)}: ${status}`),
			);
		}
		return {
			appFailures: () => Effect.sync(() => [...failures]),
			appJwts: () => Effect.sync(() => state.jwts),
			bodiesDecoded: () => Effect.sync(() => decoded.count),
			credentialsSeenIn: () =>
				Effect.sync(() => {
					const sent = server.requests.flatMap(({ headers }) =>
						headers.authorization === undefined ? [] : [headers.authorization.replace(/^Bearer /u, "")],
					);
					const credentials: Record<string, readonly string[]> = {
						"App JWTs": sent.filter((value) => !value.startsWith(APP_TOKEN)),
						"installation tokens": [APP_TOKEN, ...sent.filter((value) => value.startsWith(APP_TOKEN))],
						"the invalid private key": [INVALID_PRIVATE_KEY],
						"the private key": [PRIVATE_KEY],
						"the webhook secret": [WEBHOOK_SECRET],
						"the wrong webhook secret": [WRONG_SECRET],
					};
					return Object.fromEntries(
						Object.entries(credentials).flatMap(([name, values]) => {
							const places = [...new Set(values.flatMap((value) => seenIn(value, recording, failures, ["failures", "logs", "spans"])))];
							return places.length === 0 ? [] : [[name, places]];
						}),
					);
				}),
			downloadArchive: () =>
				attempt(
					"the background client downloads artifact 7",
					Effect.flatMap(GitHub, (service) => service.downloadArtifactArchive({ artifactId: 7, byteLimit: 8, owner: "acme", repo: "widgets" })).pipe(
						Effect.provide(contexts.background),
					),
				),
			exchangeRequested: () =>
				Effect.sync(() => server.requests.filter(({ path }) => path === EXCHANGE).map(({ body }) => JSON.parse(body.toString() || "{}"))),
			listInstallations: () =>
				attempt("the App lists its installations", list("/app/installations", Installation).pipe(Stream.runCollect, Effect.provide(contexts.app))),
			pullReads: () => answersTo(PULL),
			pullReadTally: () =>
				Effect.map(answersTo(PULL), (answers) => {
					const tally: Record<string, number> = {};
					for (const answer of answers) {
						tally[answer] = (tally[answer] ?? 0) + 1;
					}
					return tally;
				}),
			readApp: () => attempt("the App reads itself", read("/app", App).pipe(Effect.provide(contexts.app))),
			readConcurrently: (readers: number) =>
				Effect.gen(function* () {
					story.tell(`${readers} reads start together while GitHub holds the token exchange until it arrives`);
					const exchange = yield* server.hold("token");
					const reads = yield* Effect.forkChild(
						Effect.all(
							Array.from({ length: readers }, () => readPull()),
							{ concurrency: "unbounded" },
						),
					);
					yield* exchange.waiting;
					yield* exchange.release;
					return yield* Fiber.join(reads);
				}),
			readConcurrentlyAfterRejection: (readers: number) =>
				Effect.gen(function* () {
					story.tell(`${readers} reads reach GitHub together with installation token 1, and GitHub answers each with 401 Bad credentials`);
					for (let index = 0; index < readers; index += 1) {
						yield* server.scriptFault("pull", {
							kind: "status",
							reply: { body: { message: "Bad credentials" }, status: HttpStatus.fromLiteral("Unauthorized") },
						});
					}
					const reached = yield* Deferred.make<void>();
					state.arrivals = { expected: readers, reached, seen: 0 };
					const pulls = yield* server.hold("pull", { once: false });
					const exchange = yield* server.hold("token");
					const reads = yield* Effect.forkChild(
						Effect.all(
							Array.from({ length: readers }, () => readPull()),
							{ concurrency: "unbounded" },
						),
					);
					yield* Deferred.await(reached);
					state.arrivals = undefined;
					yield* pulls.release;
					yield* exchange.waiting;
					yield* exchange.release;
					return yield* Fiber.join(reads);
				}),
			readPull: () => readPull(),
			readPullThrough: (scope: Scope) =>
				attempt(`the ${scope} client reads pull request 1`, read(PULL, PullRequest).pipe(Effect.provide(contexts[scope]))),
			readRepositoryPull: () =>
				attempt("a client for acme/widgets reads pull request 1", read(PULL, PullRequest).pipe(Effect.provide(contexts.repository))),
			readWithInvalidKey: () =>
				attempt(
					"a client with an invalid private key reads pull request 1",
					read(PULL, PullRequest).pipe(Effect.provide(layer({ installationId: 7 }, INVALID_PRIVATE_KEY))),
				),
			readWithUnencodableScope: () =>
				attempt(
					"a client with an unencodable repository scope reads pull request 1",
					read(PULL, PullRequest).pipe(Effect.provide(layer({ installationId: 7, scope: unencodableScope }))),
				),
			receive: (delivery: Delivery) => {
				const { body, secret, signature } = deliveries[delivery];
				return attempt(
					`the receiver verifies ${delivery} and decodes it`,
					verifyWebhook(body, signature, Redacted.make(secret), deliverySchema),
				).pipe(
					Effect.tap((answer) =>
						Effect.sync(() => {
							engineAnswers.receiver = answer;
						}),
					),
				);
			},
			receiverAnswered: () => Effect.sync(() => engineAnswers.receiver),
			receiveUndecoded: (body: Uint8Array) =>
				attempt(
					"the receiver verifies a signed delivery without decoding it",
					Effect.as(verifyWebhook(body, webhookSignature(body), Redacted.make(WEBHOOK_SECRET)), "verified"),
				),
			requests: () =>
				Effect.sync(() =>
					server.requests.map(({ headers, method, path, status }) => `${method} ${path} ${status} with ${credentialOf(headers.authorization)}`),
				),
			spanNames: () => Effect.sync(() => recording.spans.map(({ name }) => name)),
			timePasses: (duration: Duration.Input) =>
				Effect.suspend(() => {
					story.tell(`${duration} pass`);
					return TestClock.adjust(duration);
				}),
			tokensIssued: () =>
				Effect.sync(() =>
					server.requests
						.filter(({ path, status }) => path === EXCHANGE && status === HttpStatus.fromLiteral("OK"))
						.map((_, index) => `installation token ${index + 1}`),
				),
			transportFailures: () => Effect.sync(() => [...transportFailures]),
			zipRequests: () => answersTo(ZIP),
		};
	},
});

export const holdsInstallationToken = appGithub.trait(
	"github",
	"the background client already holds installation token 1 from an earlier read",
	function* ({ contexts }) {
		yield* read(PULL, PullRequest).pipe(Effect.provide(contexts.background));
	},
);

export const clockReadsTwoMinutes = appGithub.trait("github", "the clock reads 00:02:00", function* () {
	yield* TestClock.adjust("2 minutes");
});

export const exchangeRefused = appGithub.trait(
	"github",
	"GitHub refuses the next token exchange with 401 and echoes the App JWT, the private key, an installation token and the webhook secret",
	function* ({ server }) {
		yield* server.scriptFault("token", {
			kind: "status",
			reply: (request) => ({
				body: { message: `${request.headers.authorization} ${PRIVATE_KEY} ${APP_TOKEN} ${WEBHOOK_SECRET}` },
				status: HttpStatus.fromLiteral("Unauthorized"),
			}),
		});
	},
);
