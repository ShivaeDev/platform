import { expect } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { SessionJournal, SessionService } from "#session/service.ts";
import { codexConfiguration, codexServer, type WireRequest } from "#test/codex.ts";
import { authFolder, cloudConfiguration, cloudThread, FUTURE_EXPIRY, SYNTHETIC_WORKSPACE, syntheticToken } from "#test/codexCloud.ts";

const journal = Layer.succeed(SessionJournal)({ acknowledgeSession: () => Effect.void, acknowledgeTurn: () => Effect.void });
for (const provider of ["local", "cloud"] as const) {
	it.live(`${provider} reviewer sessions disable writes, shell network and escalation at thread and turn launch`, () =>
		Effect.scoped(
			Effect.gen(function* () {
				const requests: WireRequest[] = [];
				const fixture = yield* codexServer((request) => {
					requests.push(request);
					switch (request.method) {
						case "thread/start":
							return { thread: { id: "reviewer" } };
						case "thread/read":
							return cloudThread();
						case "turn/start":
							return { turn: { id: "review-turn" } };
						default:
							return {};
					}
				});
				const authFile = yield* authFolder(syntheticToken("current", FUTURE_EXPIRY));
				const transport = provider === "cloud" ? cloudConfiguration(fixture.endpoint, authFile) : codexConfiguration(fixture.endpoint);
				yield* Effect.gen(function* () {
					expect(
						yield* (yield* SessionService).start({
							access: "read-only",
							cwd: SYNTHETIC_WORKSPACE,
							operationId: "review",
							prompt: "Inspect the exact head",
						}),
					).toEqual({ sessionId: "reviewer", turnId: "review-turn" });
				}).pipe(Effect.provide(SessionService.layer.pipe(Layer.provide([transport, journal]))));
				const start = requests.find((request) => request.method === "thread/start")?.params;
				expect(start).toMatchObject(
					provider === "cloud"
						? { config: { "approval_policy": "never", "sandbox_mode": "read-only" } }
						: { approvalPolicy: "never", sandbox: "read-only" },
				);
				expect(requests.find((request) => request.method === "turn/start")?.params).toMatchObject({
					approvalPolicy: "never",
					sandboxPolicy: { networkAccess: false, type: "readOnly" },
					threadId: "reviewer",
				});
			}),
		),
	);
}
