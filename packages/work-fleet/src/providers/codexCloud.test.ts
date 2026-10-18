import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { WireRejection, type WireRequest } from "#test/codex.ts";
import { cloudThread, FUTURE_EXPIRY, PAST_EXPIRY, SYNTHETIC_ENVIRONMENT, SYNTHETIC_WORKSPACE, syntheticToken } from "#test/codexCloud.ts";
import { cloudLogin, cloudProvider, providerStory } from "#test/providerStory.ts";

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
providerStory.it(
	"launches in the configured environment with launch settings and reads the final answer",
	[cloudProvider],
	function* ({ provider, replyWith, handshakes }) {
		const requests: WireRequest[] = [];
		const token = syntheticToken("current", FUTURE_EXPIRY);
		yield* replyWith(cloudBackend(requests));
		yield* Effect.gen(function* () {
			const sessionId = yield* provider.startSession(start);
			expect(yield* provider.startTurn({ operationId: "operation", prompt: "work", sessionId, settings })).toEqual(receipt);
			const observation = yield* provider.observe(receipt);
			expect(observation.execution).toBe("completed");
			expect(observation.output).toBe("HEAD: synthetic");
			expect(observation.progress).toEqual([{ id: "command", status: "completed" }]);
		});
		expect(handshakes()).toHaveLength(1);
		expect(handshakes()[0]?.protocols).toContain(`openai-bearer.${token}`);
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
	},
);
providerStory.it(
	"refuses a thread whose echoed settings differ instead of running with provider defaults",
	[cloudProvider],
	function* ({ provider, replyWith }) {
		const requests: WireRequest[] = [];
		yield* replyWith(cloudBackend(requests, { "thread/start": { model: settings.model, serviceTier: null, thread: { id: receipt.sessionId } } }));
		const error = yield* Effect.gen(function* () {
			return yield* provider.startSession(start).pipe(Effect.flip);
		});
		expect(error.reason).toBe("ambiguous");
		expect(error.message).toBe("Codex started the thread with service tier unset instead of priority; retain the started session reservation");
		expect(requests.map((request) => request.method)).not.toContain("turn/start");
	},
);
providerStory.it("reports the backend's exact rejection of a launch field", [cloudProvider], function* ({ provider, replyWith }) {
	const requests: WireRequest[] = [];
	yield* replyWith(cloudBackend(requests, { "turn/start": new WireRejection("unknown variant `turbo` for serviceTier") }));
	const error = yield* Effect.gen(function* () {
		return yield* provider
			.startTurn({ operationId: "operation", prompt: "work", sessionId: receipt.sessionId, settings: { serviceTier: "turbo" } })
			.pipe(Effect.flip);
	});
	expect(error.reason).toBe("rejected");
	expect(error.message).toBe("Codex rejected the protocol request: unknown variant `turbo` for serviceTier");
});
providerStory.it(
	"keeps the session without a turn when Cloud does not confirm the configured environment",
	[cloudProvider],
	function* ({ provider, replyWith }) {
		const requests: WireRequest[] = [];
		yield* replyWith(cloudBackend(requests, { "thread/read": cloudThread("other-environment") }));
		const error = yield* Effect.gen(function* () {
			return yield* provider.startTurn({ operationId: "operation", prompt: "work", sessionId: receipt.sessionId }).pipe(Effect.flip);
		});
		expect(error.reason).toBe("protocol");
		expect(requests.map((request) => request.method)).not.toContain("turn/start");
	},
);
providerStory.it("rejects work prepared for a different workspace before creating a thread", [cloudProvider], function* ({ provider, replyWith }) {
	const requests: WireRequest[] = [];
	yield* replyWith(cloudBackend(requests));
	const error = yield* Effect.gen(function* () {
		return yield* provider.startSession({ ...start, cwd: "/elsewhere" }).pipe(Effect.flip);
	});
	expect(error.reason).toBe("rejected");
	expect(requests.map((request) => request.method)).not.toContain("thread/start");
});
providerStory.it(
	"asks the Codex CLI to refresh an expired login and connects with the rotated token",
	[cloudLogin(true, true)],
	function* ({ provider, replyWith, handshakes }) {
		yield* replyWith(cloudBackend([]));
		const expired = syntheticToken("expired", PAST_EXPIRY);
		const rotated = syntheticToken("rotated", FUTURE_EXPIRY);
		yield* Effect.gen(function* () {
			yield* provider.observe(receipt);
		});
		expect(handshakes()[0]?.protocols).toContain(`openai-bearer.${rotated}`);
		expect(handshakes()[0]?.protocols).not.toContain(`openai-bearer.${expired}`);
	},
);
providerStory.it(
	"fails as unavailable without connecting when the refreshed login is still expired",
	[cloudLogin(true, false)],
	function* ({ provider, replyWith, handshakes }) {
		yield* replyWith(cloudBackend([]));
		const expired = syntheticToken("expired", PAST_EXPIRY);
		const error = yield* Effect.gen(function* () {
			return yield* provider.observe(receipt).pipe(Effect.flip);
		});
		expect(error.reason).toBe("unavailable");
		expect(error.message).not.toContain(expired);
		expect(handshakes()).toHaveLength(0);
	},
);
