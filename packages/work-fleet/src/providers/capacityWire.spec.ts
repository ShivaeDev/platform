import { expect } from "@effect/vitest";
import { WireRejection } from "#test/codex.ts";
import { providerStory } from "#test/providerStory.ts";

const CONTINUE = { operationId: "capacity-operation", prompt: "Continue", sessionId: "thread" };

for (const message of ["App-server request queue is full. Please retry.", "No execution slots are available."]) {
	providerStory.it(`the overload protocol code marks "${message}" as a full queue`, [], function* ({ answers, provider }) {
		yield* answers({ "turn/start": new WireRejection(message, undefined, -32_001) });

		const outcome = yield* provider.submit(CONTINUE);

		expect(outcome).toBe(`session rejected (session-queue-full): Codex rejected the protocol request: ${message}`);
	});
}

providerStory.it("queue-full wording with another protocol code stays an ordinary rejection", [], function* ({ answers, provider }) {
	yield* answers({ "turn/start": new WireRejection("App-server request queue is full. Please retry.") });

	const outcome = yield* provider.submit(CONTINUE);

	expect(outcome).toBe("session rejected (session-rejected): Codex rejected the protocol request: App-server request queue is full. Please retry.");
});

for (const capacity of ["serverOverloaded", "rateLimitExceeded", "flexUnavailable"]) {
	providerStory.it(
		`a turn rejected with ${capacity} evidence keeps it and is not checked for a busy thread`,
		[],
		function* ({ answers, methods, provider }) {
			yield* answers({ "turn/start": new WireRejection("Busy", { codexErrorInfo: capacity }) });

			const outcome = yield* provider.submit(CONTINUE);

			expect(outcome).toMatch(new RegExp(`^session rejected .*at ${capacity}: Codex rejected the protocol request: Busy$`, "u"));
			expect(yield* methods("turn/start", "thread/turns/list")).toEqual(["turn/start"]);
		},
	);
}

for (const [problem, reply] of [
	["a missing turn", {}],
	["a null turn", { turn: null }],
	["a missing turn id", { turn: {} }],
	["a numeric turn id", { turn: { id: 42 } }],
	["a null turn id", { turn: { id: null } }],
	["an array", []],
	["a string", "accepted"],
] as const) {
	providerStory.it(
		`a turn acknowledgement with ${problem} fails as a protocol error without resubmission`,
		[],
		function* ({ answers, methods, provider }) {
			yield* answers({ "turn/start": reply });

			const outcome = yield* provider.submit(CONTINUE);

			expect(outcome).toMatch(/^session protocol/u);
			expect(yield* methods("turn/start")).toEqual(["turn/start"]);
		},
	);
}
