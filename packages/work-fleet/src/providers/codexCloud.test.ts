import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { WireRejection } from "#test/codex.ts";
import { cloudThread, FUTURE_EXPIRY, PAST_EXPIRY, SYNTHETIC_ENVIRONMENT, SYNTHETIC_WORKSPACE, syntheticToken } from "#test/codexCloud.ts";
import { cloudLogin, cloudProvider, providerStory } from "#test/providerStory.ts";
import { page, turn } from "#test/wireScript.ts";

const RECEIPT = { sessionId: "synthetic-session", turnId: "synthetic-turn" };
const SETTINGS = { effort: "high", model: "synthetic-model", serviceTier: "priority" };
const START = { cwd: SYNTHETIC_WORKSPACE, operationId: "operation", prompt: "work", settings: SETTINGS };
const TURN = { operationId: "operation", prompt: "work", sessionId: RECEIPT.sessionId, settings: SETTINGS };
const CLOUD = {
	"thread/items/list": page([
		{ item: { id: "commentary", phase: "commentary", text: "Looking around", type: "agentMessage" } },
		{ item: { id: "final", phase: "final_answer", text: "HEAD: synthetic", type: "agentMessage" } },
	]),
	"thread/read": cloudThread(),
	"thread/start": { model: SETTINGS.model, reasoningEffort: SETTINGS.effort, serviceTier: SETTINGS.serviceTier, thread: { id: RECEIPT.sessionId } },
	"thread/turns/list": page([turn(RECEIPT.turnId, "completed")]),
	"turn/start": { turn: { id: RECEIPT.turnId } },
};

providerStory.it(
	"a Cloud session connects with the login token and starts its thread in the configured environment with the launch settings",
	[cloudProvider],
	function* ({ answers, offeredProtocols, provider, sent }) {
		yield* answers(CLOUD);

		const session = yield* provider.openSession(START);

		expect(session).toBe(`session ${RECEIPT.sessionId}`);
		yield* outcomes([
			["offered protocols", () => offeredProtocols(), expect.arrayContaining([`openai-bearer.${syntheticToken("current", FUTURE_EXPIRY)}`])],
			["initialization", () => sent("initialize"), [expect.objectContaining({ capabilities: expect.objectContaining({ experimentalApi: true }) })]],
			[
				"thread start",
				() => sent("thread/start"),
				[
					expect.objectContaining({
						config: expect.objectContaining({ "model_reasoning_effort": "high" }),
						environments: [expect.objectContaining({ cwd: SYNTHETIC_WORKSPACE, environmentConfigId: SYNTHETIC_ENVIRONMENT })],
						model: SETTINGS.model,
						serviceTier: "priority",
					}),
				],
			],
		]);
	},
);

providerStory.it(
	"a Cloud turn confirms its thread's environment and then starts with the launch settings",
	[cloudProvider],
	function* ({ answers, methods, provider, sent }) {
		yield* answers(CLOUD);

		const outcome = yield* provider.submit(TURN);

		expect(outcome).toBe("turn synthetic-turn on synthetic-session");
		yield* outcomes([
			["call order", () => methods("thread/read", "turn/start"), ["thread/read", "turn/start"]],
			[
				"turn start",
				() => sent("turn/start"),
				[expect.objectContaining({ clientUserMessageId: "operation", ...SETTINGS, threadId: RECEIPT.sessionId })],
			],
		]);
	},
);

providerStory.it(
	"a completed Cloud turn reports its final answer and lists turns without their items",
	[cloudProvider],
	function* ({ answers, provider, sent }) {
		yield* answers(CLOUD);

		const observation = yield* provider.observe(RECEIPT);

		expect({ execution: observation.execution, output: observation.output, progress: observation.progress }).toEqual({
			execution: "completed",
			output: "HEAD: synthetic",
			progress: [{ id: "final" }],
		});
		expect(yield* sent("thread/turns/list")).toEqual([expect.objectContaining({ itemsView: "notLoaded" })]);
	},
);

for (const [story, script, input, failure, forbidden] of [
	[
		"a thread whose echoed service tier differs fails as ambiguous before any turn starts",
		{ "thread/start": { model: SETTINGS.model, serviceTier: null, thread: { id: RECEIPT.sessionId } } },
		"session",
		"session ambiguous: Codex started the thread with service tier unset instead of priority; retain the started session reservation",
		"turn/start",
	],
	[
		"a thread in another environment fails as a protocol error before its turn starts",
		{ "thread/read": cloudThread("other-environment") },
		"turn",
		expect.stringMatching(/^session protocol/u),
		"turn/start",
	],
	[
		"work prepared for another workspace is rejected before a thread starts",
		{},
		"elsewhere",
		expect.stringMatching(/^session rejected/u),
		"thread/start",
	],
] as const) {
	providerStory.it(story, [cloudProvider], function* ({ answers, methods, provider }) {
		yield* answers({ ...CLOUD, ...script });

		const outcome = yield* input === "turn"
			? provider.submit(TURN)
			: provider.openSession(input === "session" ? START : { ...START, cwd: "/elsewhere" });

		expect(outcome).toEqual(failure);
		expect(yield* methods(forbidden)).toEqual([]);
	});
}

providerStory.it(
	"a launch field the backend rejects is reported with the backend's exact message",
	[cloudProvider],
	function* ({ answers, provider }) {
		yield* answers({ ...CLOUD, "turn/start": new WireRejection("unknown variant `turbo` for serviceTier") });

		const outcome = yield* provider.submit({ ...TURN, settings: { serviceTier: "turbo" } });

		expect(outcome).toBe("session rejected (session-rejected): Codex rejected the protocol request: unknown variant `turbo` for serviceTier");
	},
);

providerStory.it(
	"an expired Cloud login is refreshed through the Codex CLI and the connection offers only the rotated token",
	[cloudLogin(true, true)],
	function* ({ answers, offeredProtocols, provider }) {
		yield* answers(CLOUD);

		yield* provider.observe(RECEIPT);

		yield* outcomes([
			["rotated token", () => offeredProtocols(), expect.arrayContaining([`openai-bearer.${syntheticToken("rotated", FUTURE_EXPIRY)}`])],
			["expired token", () => offeredProtocols(), expect.not.arrayContaining([`openai-bearer.${syntheticToken("expired", PAST_EXPIRY)}`])],
		]);
	},
);

providerStory.it(
	"a Cloud login still expired after refresh fails as unavailable without connecting or naming the token",
	[cloudLogin(true, false)],
	function* ({ answers, handshakes, provider }) {
		yield* answers(CLOUD);

		const outcome = yield* provider.observeOutcome(RECEIPT);

		expect(outcome).toMatch(/^session unavailable/u);
		expect(outcome).not.toContain(syntheticToken("expired", PAST_EXPIRY));
		expect(yield* handshakes()).toBe(0);
	},
);
