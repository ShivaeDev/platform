import { expect } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { readReviewerVerdict } from "#prompt/reviewer.ts";
import { SessionJournal, SessionService } from "#session/service.ts";
import { codexConfiguration, codexServer, type WireRequest } from "#test/codex.ts";
import { authFolder, cloudConfiguration, cloudThread, FUTURE_EXPIRY, SYNTHETIC_WORKSPACE, syntheticToken } from "#test/codexCloud.ts";
import { reviewerNetwork } from "#test/reviewerNetwork.ts";

const journal = Layer.succeed(SessionJournal)({ acknowledgeSession: () => Effect.void, acknowledgeTurn: () => Effect.void });
for (const provider of ["local", "cloud"] as const) {
	it.live(`${provider} reviewer sessions read PR and CI evidence and return a verdict without network writes or escalation`, () =>
		Effect.scoped(
			Effect.gen(function* () {
				const requests: WireRequest[] = [];
				const review = reviewerNetwork();
				const fixture = yield* codexServer((request) => {
					requests.push(request);
					switch (request.method) {
						case "thread/start":
							return { thread: { id: "reviewer" } };
						case "thread/read":
							return cloudThread();
						default:
							return review.reply(request);
					}
				});
				const authFile = yield* authFolder(syntheticToken("current", FUTURE_EXPIRY));
				const transport = provider === "cloud" ? cloudConfiguration(fixture.endpoint, authFile) : codexConfiguration(fixture.endpoint);
				yield* Effect.gen(function* () {
					const session = yield* SessionService;
					const receipt = yield* session.start({
						access: "read-only",
						cwd: SYNTHETIC_WORKSPACE,
						operationId: "review",
						prompt: review.prompt,
					});
					expect(receipt).toEqual({ sessionId: "reviewer", turnId: "review-turn" });
					yield* review.inspect;
					const observation = yield* session.observe(receipt);
					expect(yield* readReviewerVerdict(observation.output, receipt)).toMatchObject({
						head: "a".repeat(40),
						verdict: "approved",
					});
				}).pipe(Effect.provide(SessionService.layer.pipe(Layer.provide([transport, journal]))));
				const start = requests.find((request) => request.method === "thread/start")?.params;
				expect(start).toMatchObject(
					provider === "cloud"
						? { config: { "approval_policy": "never", "sandbox_mode": "read-only", "sandbox_read_only.network_access": true } }
						: { approvalPolicy: "never", config: { "sandbox_read_only.network_access": true }, sandbox: "read-only" },
				);
				expect(requests.find((request) => request.method === "turn/start")?.params).toMatchObject({
					approvalPolicy: "never",
					sandboxPolicy: { networkAccess: true, type: "readOnly" },
					threadId: "reviewer",
				});
			}),
		),
	);
}
