import { expect } from "@effect/vitest";
import { openCode } from "#test/opencodeStory.ts";

openCode.it("events stay scoped to their session", [], function* ({ start, emit, events }) {
	yield* start("alice", "first");
	yield* start("bob", "second");
	yield* emit("session-2", "other.session", { secret: "bob" });
	yield* emit("session-1", "alice.event", { value: "alice" });
	yield* emit("session-1", "story.barrier");
	const received = yield* events("alice");
	expect(received.map((event) => event.raw?.kind)).toEqual(["POST /session", "alice.event", "story.barrier"]);
});
openCode.it("settled parts retain their author and are emitted only once", [], function* ({ start, emit, events }) {
	yield* start("alice", "first");
	yield* emit("session-1", "message.updated", { info: { id: "user", role: "user" } });
	yield* emit("session-1", "message.updated", { info: { id: "assistant", "modelID": "fast", "providerID": "acme", role: "assistant" } });
	yield* emit("session-1", "message.part.updated", { part: { id: "u", "messageID": "user", text: "question", type: "text" } });
	yield* emit("session-1", "message.part.updated", { part: { id: "a", "messageID": "assistant", text: "partial", type: "text" } });
	for (const _ of [1, 2]) {
		yield* emit("session-1", "message.part.updated", { part: { id: "a", "messageID": "assistant", text: "answer", time: { end: 1 }, type: "text" } });
	}
	yield* emit("session-1", "story.barrier");
	expect((yield* events("alice")).filter((event) => event.type === "message")).toMatchObject([
		{ parts: [{ text: "question", type: "text" }], role: "user" },
		{ parts: [{ text: "answer", type: "text" }], role: "agent" },
	]);
});
openCode.it("provider token and cost reports remain separate and deduplicated", [], function* ({ start, emit, events }) {
	yield* start("alice", "first");
	yield* emit("session-1", "message.updated", { info: { id: "assistant", "modelID": "fast", "providerID": "acme", role: "assistant" } });
	for (const _ of [1, 2]) {
		yield* emit("session-1", "message.part.updated", {
			part: { cost: 0.25, id: "usage", "messageID": "assistant", tokens: { input: 12, output: 3 }, type: "step-finish" },
		});
	}
	yield* emit("session-1", "story.barrier");
	const received = yield* events("alice");
	expect(received.filter((event) => event.type === "usage" || event.type === "cost")).toMatchObject([
		{ inputTokens: 12, model: "acme/fast", outputTokens: 3, scope: "delta", type: "usage", unit: "turn" },
		{ amount: 0.25, currency: "USD", source: "provider", type: "cost" },
	]);
	expect(received.find((event) => event.type === "usage")).not.toHaveProperty("cacheReadTokens");
});
for (const [error, state] of [
	[undefined, "completed"],
	["MessageAbortedError", "interrupted"],
	["ProviderError", "failed"],
] as const) {
	openCode.it(`idle reports ${state} from the provider turn evidence`, [], function* ({ start, emit, events, inspect }) {
		yield* start("alice", "first");
		yield* emit("session-1", "session.status", { status: { type: "busy" } });
		if (error !== undefined) {
			yield* emit("session-1", "session.error", { error: { name: error } });
		}
		yield* emit("session-1", "session.idle");
		yield* emit("session-1", "story.barrier");
		const received = yield* events("alice");
		expect(received.filter((event) => event.type === "execution")).toMatchObject([{ state: "running" }, { state }]);
		expect(yield* inspect("alice")).toEqual({ state, type: "known" });
	});
}
openCode.it("tool transitions reach consumers once with arguments and results", [], function* ({ start, emit, events }) {
	yield* start("alice", "first");
	yield* emit("session-1", "message.updated", { info: { id: "assistant", role: "assistant" } });
	for (const state of [
		{ status: "pending" },
		{ input: { command: "ls" }, status: "running" },
		{ input: { command: "ls" }, status: "running" },
		{ output: "README.md", status: "completed" },
		{ output: "README.md", status: "completed" },
	]) {
		yield* emit("session-1", "message.part.updated", {
			part: { "callID": "call-1", id: "tool", "messageID": "assistant", state, tool: "bash", type: "tool" },
		});
	}
	yield* emit("session-1", "story.barrier");
	expect((yield* events("alice")).filter((event) => event.type === "tool.started" || event.type === "tool.completed")).toMatchObject([
		{ input: '{"command":"ls"}', name: "bash", toolId: "call-1", type: "tool.started" },
		{ ok: true, output: "README.md", toolId: "call-1", type: "tool.completed" },
	]);
});

openCode.it("unreported model and cost stay absent from usage", [], function* ({ start, emit, events }) {
	yield* start("alice", "first");
	yield* emit("session-1", "message.updated", { info: { id: "assistant", role: "assistant" } });

	yield* emit("session-1", "message.part.updated", {
		part: { id: "usage", "messageID": "assistant", tokens: { input: 12, output: 3 }, type: "step-finish" },
	});
	yield* emit("session-1", "story.barrier");
	const received = yield* events("alice");

	expect(received.filter((event) => event.type === "usage" || event.type === "cost")).toEqual([
		{ inputTokens: 12, outputTokens: 3, raw: expect.anything(), scope: "delta", type: "usage", unit: "turn" },
	]);
});
