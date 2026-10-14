import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { SessionTransport } from "#session/service.ts";
import { codexServer, type Handshake, WireRejection, type WireRequest } from "#test/codex.ts";
import {
	authFolder,
	cloudConfiguration,
	cloudThread,
	FUTURE_EXPIRY,
	PAST_EXPIRY,
	refreshingCli,
	SYNTHETIC_ENVIRONMENT,
	SYNTHETIC_WORKSPACE,
	syntheticToken,
} from "#test/codexCloud.ts";

const receipt = { sessionId: "synthetic-session", turnId: "synthetic-turn" };
const settings = { effort: "high", model: "synthetic-model", serviceTier: "priority" };
const start = { cwd: SYNTHETIC_WORKSPACE, operationId: "operation", prompt: "work", settings };
function cloudBackend(requests: WireRequest[], overrides: Partial<Record<string, unknown>> = {}) {
	return (request: WireRequest) => {
		requests.push(request);
		if (request.method in overrides) {
			return overrides[request.method];
		}
		switch (request.method) {
			case "thread/start":
				return { model: settings.model, reasoningEffort: settings.effort, serviceTier: settings.serviceTier, thread: { id: receipt.sessionId } };
			case "thread/read":
				return cloudThread();
			case "turn/start":
				return { turn: { id: receipt.turnId } };
			case "thread/turns/list":
				return {
					data: [{ id: receipt.turnId, items: [{ id: "command", status: "completed", type: "commandExecution" }], status: "completed" }],
					nextCursor: null,
				};
			case "thread/items/list":
				return {
					data: [
						{ item: { id: "commentary", phase: "commentary", text: "Looking around", type: "agentMessage" } },
						{ item: { id: "final", phase: "final_answer", text: "HEAD: synthetic", type: "agentMessage" } },
					],
					nextCursor: null,
				};
			default:
				return {};
		}
	};
}
function params(requests: readonly WireRequest[], method: string) {
	return requests.find((request) => request.method === method)?.params;
}

it.live("launches in the configured environment with launch settings and reads the final answer", () =>
	Effect.scoped(
		Effect.gen(function* () {
			const requests: WireRequest[] = [];
			const handshakes: Handshake[] = [];
			const token = syntheticToken("current", FUTURE_EXPIRY);
			const fixture = yield* codexServer(cloudBackend(requests), handshakes);
			const authFile = yield* authFolder(token);
			yield* Effect.gen(function* () {
				const provider = yield* SessionTransport;
				const sessionId = yield* provider.startSession(start);
				expect(yield* provider.startTurn({ operationId: "operation", prompt: "work", sessionId, settings })).toEqual(receipt);
				const observation = yield* provider.observe(receipt);
				expect(observation.execution).toBe("completed");
				expect(observation.output).toBe("HEAD: synthetic");
				expect(observation.progress).toEqual([{ id: "command", status: "completed" }]);
			}).pipe(Effect.provide(cloudConfiguration(fixture.endpoint, authFile)));
			expect(handshakes).toHaveLength(1);
			expect(handshakes[0]?.protocols).toContain(`openai-bearer.${token}`);
			expect(params(requests, "initialize")).toMatchObject({ capabilities: { experimentalApi: true } });
			expect(params(requests, "thread/start")).toMatchObject({
				config: { "model_reasoning_effort": "high" },
				environments: [{ cwd: SYNTHETIC_WORKSPACE, environmentConfigId: SYNTHETIC_ENVIRONMENT }],
				model: settings.model,
				serviceTier: "priority",
			});
			expect(params(requests, "turn/start")).toMatchObject({ clientUserMessageId: "operation", ...settings, threadId: receipt.sessionId });
			expect(params(requests, "thread/turns/list")).toMatchObject({ itemsView: "full" });
			expect(requests.map((request) => request.method).indexOf("thread/read")).toBeLessThan(
				requests.map((request) => request.method).indexOf("turn/start"),
			);
		}),
	),
);
it.live("refuses a thread whose echoed settings differ instead of running with provider defaults", () =>
	Effect.scoped(
		Effect.gen(function* () {
			const requests: WireRequest[] = [];
			const fixture = yield* codexServer(
				cloudBackend(requests, { "thread/start": { model: settings.model, serviceTier: null, thread: { id: receipt.sessionId } } }),
			);
			const authFile = yield* authFolder(syntheticToken("current", FUTURE_EXPIRY));
			const error = yield* Effect.gen(function* () {
				return yield* (yield* SessionTransport).startSession(start).pipe(Effect.flip);
			}).pipe(Effect.provide(cloudConfiguration(fixture.endpoint, authFile)));
			expect(error.reason).toBe("ambiguous");
			expect(error.message).toBe("Codex started the thread with service tier unset instead of priority; retain the started session reservation");
			expect(requests.map((request) => request.method)).not.toContain("turn/start");
		}),
	),
);
it.live("reports the backend's exact rejection of a launch field", () =>
	Effect.scoped(
		Effect.gen(function* () {
			const requests: WireRequest[] = [];
			const fixture = yield* codexServer(cloudBackend(requests, { "turn/start": new WireRejection("unknown variant `turbo` for serviceTier") }));
			const authFile = yield* authFolder(syntheticToken("current", FUTURE_EXPIRY));
			const error = yield* Effect.gen(function* () {
				const provider = yield* SessionTransport;
				return yield* provider
					.startTurn({ operationId: "operation", prompt: "work", sessionId: receipt.sessionId, settings: { serviceTier: "turbo" } })
					.pipe(Effect.flip);
			}).pipe(Effect.provide(cloudConfiguration(fixture.endpoint, authFile)));
			expect(error.reason).toBe("rejected");
			expect(error.message).toBe("Codex rejected the protocol request: unknown variant `turbo` for serviceTier");
		}),
	),
);
it.live("keeps the session without a turn when Cloud does not confirm the configured environment", () =>
	Effect.scoped(
		Effect.gen(function* () {
			const requests: WireRequest[] = [];
			const fixture = yield* codexServer(cloudBackend(requests, { "thread/read": cloudThread("other-environment") }));
			const authFile = yield* authFolder(syntheticToken("current", FUTURE_EXPIRY));
			const error = yield* Effect.gen(function* () {
				return yield* (yield* SessionTransport)
					.startTurn({ operationId: "operation", prompt: "work", sessionId: receipt.sessionId })
					.pipe(Effect.flip);
			}).pipe(Effect.provide(cloudConfiguration(fixture.endpoint, authFile)));
			expect(error.reason).toBe("protocol");
			expect(requests.map((request) => request.method)).not.toContain("turn/start");
		}),
	),
);
it.live("rejects work prepared for a different workspace before creating a thread", () =>
	Effect.scoped(
		Effect.gen(function* () {
			const requests: WireRequest[] = [];
			const fixture = yield* codexServer(cloudBackend(requests));
			const authFile = yield* authFolder(syntheticToken("current", FUTURE_EXPIRY));
			const error = yield* Effect.gen(function* () {
				return yield* (yield* SessionTransport).startSession({ ...start, cwd: "/elsewhere" }).pipe(Effect.flip);
			}).pipe(Effect.provide(cloudConfiguration(fixture.endpoint, authFile)));
			expect(error.reason).toBe("rejected");
			expect(requests.map((request) => request.method)).not.toContain("thread/start");
		}),
	),
);
it.live("asks the Codex CLI to refresh an expired login and connects with the rotated token", () =>
	Effect.scoped(
		Effect.gen(function* () {
			const handshakes: Handshake[] = [];
			const fixture = yield* codexServer(cloudBackend([]), handshakes);
			const expired = syntheticToken("expired", PAST_EXPIRY);
			const rotated = syntheticToken("rotated", FUTURE_EXPIRY);
			const authFile = yield* authFolder(expired);
			yield* Effect.gen(function* () {
				yield* (yield* SessionTransport).observe(receipt);
			}).pipe(Effect.provide(cloudConfiguration(fixture.endpoint, authFile, { refreshCommand: refreshingCli(authFile, rotated) })));
			expect(handshakes[0]?.protocols).toContain(`openai-bearer.${rotated}`);
			expect(handshakes[0]?.protocols).not.toContain(`openai-bearer.${expired}`);
		}),
	),
);
it.live("fails as unavailable without connecting when the refreshed login is still expired", () =>
	Effect.scoped(
		Effect.gen(function* () {
			const handshakes: Handshake[] = [];
			const fixture = yield* codexServer(cloudBackend([]), handshakes);
			const expired = syntheticToken("expired", PAST_EXPIRY);
			const authFile = yield* authFolder(expired);
			const error = yield* Effect.gen(function* () {
				return yield* (yield* SessionTransport).observe(receipt).pipe(Effect.flip);
			}).pipe(Effect.provide(cloudConfiguration(fixture.endpoint, authFile, { refreshCommand: refreshingCli(authFile, expired) })));
			expect(error.reason).toBe("unavailable");
			expect(error.message).not.toContain(expired);
			expect(handshakes).toHaveLength(0);
		}),
	),
);
