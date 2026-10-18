import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { WireRejection } from "#test/codex.ts";
import { providerStory } from "#test/providerStory.ts";

providerStory.it("preserves a structured capacity rejection through the actual provider WebSocket boundary", [], function* ({ provider, replyWith }) {
	yield* replyWith((request) =>
		request.method === "turn/start" ? new WireRejection("Synthetic provider capacity", { codexErrorInfo: "serverOverloaded" }) : {},
	);
	const error = yield* provider.startTurn({ operationId: "capacity-operation", prompt: "Continue", sessionId: "thread" }).pipe(Effect.flip);
	expect(error).toMatchObject({
		capacity: "serverOverloaded",
		message: "Codex rejected the protocol request: Synthetic provider capacity",
		reason: "rejected",
	});
});

for (const message of ["App-server request queue is full. Please retry.", "No execution slots are available."]) {
	providerStory.it(`the overload protocol code identifies capacity regardless of wording: ${message}`, [], function* ({ provider, replyWith }) {
		yield* replyWith((request) => (request.method === "turn/start" ? new WireRejection(message, undefined, -32_001) : {}));
		const error = yield* provider.startTurn({ operationId: "capacity-operation", prompt: "Continue", sessionId: "thread" }).pipe(Effect.flip);
		expect(error).toMatchObject({ code: "session-queue-full", message: `Codex rejected the protocol request: ${message}`, reason: "rejected" });
	});
}

providerStory.it("queue-full wording with another protocol code remains an ordinary rejection", [], function* ({ provider, replyWith }) {
	yield* replyWith((request) => (request.method === "turn/start" ? new WireRejection("App-server request queue is full. Please retry.") : {}));
	expect(yield* provider.startTurn({ operationId: "capacity-operation", prompt: "Continue", sessionId: "thread" }).pipe(Effect.flip)).toMatchObject({
		code: "session-rejected",
		reason: "rejected",
	});
});

for (const capacity of ["serverOverloaded", "rateLimitExceeded", "flexUnavailable"]) {
	providerStory.it(`keeps structured ${capacity} evidence through a turn rejection`, [], function* ({ provider, replyWith, requests }) {
		yield* replyWith((request) => (request.method === "turn/start" ? new WireRejection("Busy", { codexErrorInfo: capacity }) : {}));
		expect(yield* provider.startTurn({ operationId: "structured", prompt: "Continue", sessionId: "thread" }).pipe(Effect.flip)).toMatchObject({
			capacity,
			reason: "rejected",
		});
		expect(requests().filter((request) => request.method === "turn/start")).toHaveLength(1);
		expect(requests().map((request) => request.method)).not.toContain("thread/turns/list");
	});
}
for (const [problem, reply] of [
	["missing turn", {}],
	["null turn", { turn: null }],
	["missing identity", { turn: {} }],
	["numeric identity", { turn: { id: 42 } }],
	["null identity", { turn: { id: null } }],
	["array response", []],
	["string response", "accepted"],
] as const) {
	providerStory.it(`refuses ${problem} in a turn acknowledgement without replay`, [], function* ({ provider, replyWith, requests }) {
		yield* replyWith((request) => (request.method === "turn/start" ? reply : {}));
		expect(yield* provider.startTurn({ operationId: "invalid", prompt: "Continue", sessionId: "thread" }).pipe(Effect.flip)).toMatchObject({
			reason: "protocol",
		});
		expect(requests().filter((request) => request.method === "turn/start")).toHaveLength(1);
	});
}
