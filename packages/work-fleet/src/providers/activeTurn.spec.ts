import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { WireRejection } from "#test/codex.ts";
import { providerStory } from "#test/providerStory.ts";
import { inTurn, page, turn } from "#test/wireScript.ts";

const FOLLOWUP = {
	operationId: "followup-operation",
	prompt: "Continue the repair",
	sessionId: "worker-thread",
	settings: { effort: "high", model: "synthetic-model", serviceTier: "synthetic-tier" },
};
const CONTINUE = { operationId: "operation", prompt: "Continue", sessionId: "thread" };
const BUSY = "turn already active for thread";
const ACTIVE_THEN_IDLE = inTurn(page([turn("active", "inProgress")]), page([turn("active", "completed")]));

for (const message of [BUSY, "Another operation owns this thread."]) {
	providerStory.it(
		`a turn rejected as busy with "${message}" is resubmitted unchanged each time the thread goes idle`,
		[],
		function* ({ answers, methods, provider, sent }) {
			yield* answers({
				"thread/turns/list": ACTIVE_THEN_IDLE,
				"turn/start": inTurn(new WireRejection(message), new WireRejection(message), { turn: { id: "followup" } }),
			});

			const outcome = yield* provider.submit(FOLLOWUP);

			expect(outcome).toBe("turn followup on worker-thread");
			const submission = expect.objectContaining({ clientUserMessageId: "followup-operation", model: "synthetic-model", threadId: "worker-thread" });
			yield* outcomes([
				[
					"provider calls",
					() => methods("turn/start", "thread/turns/list", "turn/interrupt", "thread/start"),
					["turn/start", "thread/turns/list", "thread/turns/list", "turn/start", "thread/turns/list", "thread/turns/list", "turn/start"],
				],
				["submitted turns", () => sent("turn/start"), [submission, submission, submission]],
			]);
		},
	);
}

providerStory.it("a thread that stays busy fails after three resubmissions", [], function* ({ answers, methods, provider }) {
	yield* answers({ "thread/turns/list": ACTIVE_THEN_IDLE, "turn/start": new WireRejection(BUSY) });

	const outcome = yield* provider.submit(CONTINUE);

	expect(outcome).toBe(
		`session rejected (session-active-turn-exhausted): Codex rejected the protocol request: ${BUSY}; active-turn resubmission limit reached`,
	);
	expect(yield* methods("turn/start")).toEqual(["turn/start", "turn/start", "turn/start", "turn/start"]);
});

for (const [rejection, code, checks] of [
	["with the overload code", -32_001, []],
	["whose thread state is unreadable", -32_602, ["thread/turns/list"]],
] as const) {
	providerStory.it(`a busy rejection ${rejection} fails without resubmission`, [], function* ({ answers, methods, provider }) {
		yield* answers({
			"thread/turns/list": new WireRejection("State observation is unavailable."),
			"turn/start": new WireRejection(BUSY, undefined, code),
		});

		const outcome = yield* provider.submit(CONTINUE);

		expect(outcome).toBe(
			`session rejected (${code === -32_001 ? "session-queue-full" : "session-rejected"}): Codex rejected the protocol request: ${BUSY}`,
		);
		expect(yield* methods("turn/start", "thread/turns/list")).toEqual(["turn/start", ...checks]);
	});
}

for (const message of [
	"Rejected credential",
	"Invalid API key",
	"Request refused by policy",
	"Selected model is at capacity",
	"Selected model is at capacity. Please try a different model.",
]) {
	providerStory.it(`a thread with an active turn does not make "${message}" a busy rejection`, [], function* ({ answers, methods, provider }) {
		yield* answers({ "thread/turns/list": page([turn("active", "inProgress")]), "turn/start": new WireRejection(message) });

		const outcome = yield* provider.submit(CONTINUE);

		expect(outcome).toBe(`session rejected (session-rejected): Codex rejected the protocol request: ${message}`);
		expect(yield* methods("turn/start", "thread/turns/list")).toEqual(["turn/start"]);
	});
}
