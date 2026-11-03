import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { capacityRefusal, codex, draining, inactiveTurn, lostAcknowledgement, runningTool } from "#test/codexStory.ts";

codex.it("reading a transcript maps provider items without resuming the thread", [], function* ({ start, sendItem, transcript, requests }) {
	yield* start();
	yield* sendItem({ id: "answer", text: "the change is ready", type: "agentMessage" });

	const result = yield* transcript();

	expect(result).toMatchObject({
		completeness: "complete",
		events: [
			{ inputId: "edit", parts: [{ text: "make the change", type: "text" }], role: "user", type: "message" },
			{ parts: [{ text: "the change is ready", type: "text" }], role: "agent", type: "message" },
		],
	});
	expect((yield* requests()).map((frame) => frame.method)).toEqual(["initialize", "initialized", "thread/start", "turn/start", "thread/items/list"]);
});

codex.it(
	"a lost acknowledgement is recovered by exact operation without another submission",
	[lostAcknowledgement],
	function* ({ beginStart, submissionReceived, requestTimeoutPasses, join, anotherOperationCompleted, recover, start, requests }) {
		const pending = yield* beginStart();
		yield* submissionReceived();
		yield* requestTimeoutPasses();
		expect(yield* join(pending)).toBe("unknown acceptance");
		yield* anotherOperationCompleted();

		const recovered = yield* recover();
		const retried = yield* start();

		expect(recovered).toMatchObject({ receipt: { operationId: "edit", reference: { value: "turn-1" } }, type: "accepted" });
		expect(retried).toMatchObject({ operationId: "edit", reference: { value: "turn-1" } });
		expect((yield* requests()).filter((frame) => frame.method === "turn/start")).toMatchObject([{ params: { clientUserMessageId: "edit" } }]);
	},
);

codex.it("steering addresses the expected turn and preserves the client message id", [], function* ({ start, steer, requests }) {
	yield* start();

	yield* steer();

	expect((yield* requests()).filter((frame) => frame.method === "turn/steer")).toMatchObject([
		{ params: { clientUserMessageId: "correction", expectedTurnId: "turn-1", input: [{ text: "keep the API", type: "text" }], threadId: "root" } },
	]);
});

codex.it("a stale steering receipt cannot target a later turn", [], function* ({ start, queue, finish, join, steer, requests }) {
	yield* start();
	const pending = yield* queue();
	yield* finish();
	yield* join(pending);

	const result = yield* steer();

	expect(result).toBe("The expected turn is no longer active");
	expect((yield* requests()).filter((frame) => frame.method === "turn/steer")).toEqual([]);
});

codex.it(
	"interruption keeps queued input local until the matching turn finishes draining",
	[draining],
	function* ({ start, queue, interrupt, waitForRequest, requests, finish, join }) {
		yield* start();
		const queued = yield* queue();

		const interrupted = yield* interrupt();
		yield* waitForRequest("turn/interrupt");

		expect((yield* requests()).filter((frame) => frame.method === "turn/start")).toMatchObject([{ params: { clientUserMessageId: "edit" } }]);

		yield* finish();
		yield* join(interrupted);
		yield* join(queued);

		expect((yield* requests()).filter((frame) => frame.method === "turn/start")).toMatchObject([
			{ params: { clientUserMessageId: "edit" } },
			{ params: { clientUserMessageId: "follow-up", input: [{ text: "then document it", type: "text" }] } },
		]);
	},
);

codex.it("image input reaches Codex as a native local image", [], function* ({ startImage, requests }) {
	yield* startImage();

	expect((yield* requests()).filter((frame) => frame.method === "turn/start")).toMatchObject([
		{ params: { input: [{ path: "/project/design.png", type: "localImage" }] } },
	]);
});

codex.it("passive census claims children and prevents resuming them", [], function* ({ census, resumeChild, requests }) {
	const children = yield* census();

	const result = yield* resumeChild();

	expect(children).toMatchObject([{ agentNickname: "researcher", parentThreadId: "root", threadId: "child", working: true }]);
	expect(result).toBe("Child threads are observed passively and cannot be resumed");
	expect((yield* requests()).filter((frame) => frame.method === "thread/resume")).toEqual([]);
});

codex.it("model discovery maps provider choices to shared model data", [], function* ({ models }) {
	const choices = yield* models();

	expect(choices).toEqual([{ defaultEffort: "high", efforts: ["high"], id: "codex-model", isDefault: true, name: "Codex" }]);
});

codex.it(
	"missing recovery evidence stays uncertain and cannot submit a replacement",
	[],
	function* ({ start, clearProviderHistory, recover, requests }) {
		yield* start();
		yield* clearProviderHistory();

		const result = yield* recover();
		const retried = yield* start();

		expect(result).toMatchObject({ reason: "No matching turn is observable; absence does not authorize replay", type: "uncertain" });
		expect(retried).toBe("unknown acceptance");
		expect(yield* requests("turn/start")).toMatchObject([{ params: { clientUserMessageId: "edit" } }]);
	},
);

codex.it("duplicate operation matches preserve uncertainty", [], function* ({ start, duplicateOperation, recover }) {
	yield* start();
	yield* duplicateOperation();

	const result = yield* recover();

	expect(result).toMatchObject({ reason: "Multiple turns match this operation; preserve ownership", type: "uncertain" });
});

codex.it("resuming a root uses its saved thread and live dynamic tools", [], function* ({ resume, callTool, reply, requests }) {
	yield* resume();

	yield* callTool("saved-root");

	yield* outcomes([
		["tool reply", () => reply(), { id: "tool-1", result: { contentItems: [{ text: '{"query":"Effect"}', type: "inputText" }], success: true } }],
		["resumed thread", () => requests("thread/resume"), [{ params: { threadId: "saved-root" } }]],
	]);
});

codex.it("dynamic tool requests reach the configured Effect and receive Codex content items", [], function* ({ start, callTool, reply, requests }) {
	yield* start();

	yield* callTool();

	yield* outcomes([
		["tool reply", () => reply(), { id: "tool-1", result: { contentItems: [{ text: '{"query":"Effect"}', type: "inputText" }], success: true } }],
		[
			"declared tools",
			() => requests("thread/start"),
			[{ params: { dynamicTools: [{ description: "look up docs", inputSchema: { type: "object" }, name: "lookup", type: "function" }] } }],
		],
	]);
});

codex.it("unhandled approvals are declined with the provider response shape", [], function* ({ serverRequest, reply }) {
	yield* serverRequest("item/commandExecution/requestApproval", { command: "deploy", threadId: "root" });

	expect(yield* reply()).toMatchObject({ id: "provider-request", result: { decision: "decline" } });
});

codex.it("current-time requests receive whole Unix seconds", [], function* ({ secondPasses, serverRequest, reply }) {
	yield* secondPasses();
	yield* serverRequest("currentTime/read", {});

	expect(yield* reply()).toMatchObject({ id: "provider-request", result: { currentTimeAt: 1 } });
});

codex.it("rate-limit events preserve percentage windows and reset milliseconds", [], function* ({ start, readEvents, notify, join }) {
	yield* start();
	const pending = yield* readEvents(3);

	yield* notify("account/rateLimits/updated", {
		rateLimits: { primary: { resetsAt: 123, usedPercent: 85, windowDurationMins: 300 }, rateLimitReachedType: "usage-limit" },
	});

	expect(yield* join(pending)).toMatchObject([
		{ type: "acknowledged" },
		{ reference: "root", type: "session.opened" },
		{ status: "rejected", type: "rate.limit", windows: [{ durationMinutes: 300, resetsAt: 123_000, usedPercent: 85 }] },
	]);
});

codex.it("descendant messages retain ownership attribution", [], function* ({ start, readEvents, notify, join }) {
	yield* start();
	const pending = yield* readEvents(3);

	yield* notify("thread/started", { thread: { id: "child", source: { subAgent: { "thread_spawn": { "parent_thread_id": "root" } } } } });
	yield* notify("item/completed", { item: { id: "answer", text: "child result", type: "agentMessage" }, threadId: "child", turnId: "child-turn" });

	expect(yield* join(pending)).toMatchObject([
		{ type: "acknowledged" },
		{ reference: "root", type: "session.opened" },
		{ origin: { node: "child", spawnedBy: "child" }, parts: [{ text: "child result", type: "text" }], type: "message" },
	]);
});

codex.it("provider exit ends queued delivery with a typed unavailable failure", [], function* ({ start, queue, providerExit, join }) {
	yield* start();
	const pending = yield* queue();

	yield* providerExit();

	expect(yield* join(pending)).toBe("unavailable");
});

codex.it("an already inactive turn interrupts without waiting for a missing completion", [inactiveTurn], function* ({ start, interruptAndWait }) {
	yield* start();

	yield* interruptAndWait();
});

codex.it(
	"closing the caller session interrupts its in-flight dynamic tool",
	[runningTool],
	function* ({ start, callTool, toolStarted, closeSession, reply }) {
		yield* start();
		yield* callTool();
		yield* toolStarted();

		yield* closeSession();

		expect(yield* reply()).toMatchObject({
			id: "tool-1",
			result: { contentItems: [{ text: "The session closed or tool execution failed" }], success: false },
		});
	},
);

for (const code of ["rateLimitExceeded", "flexUnavailable", "serverOverloaded", "usageLimitExceeded"]) {
	codex.it(
		`a ${code} rejection retains its capacity reason and proves non-acceptance`,
		[capacityRefusal(code)],
		function* ({ rejectedStart, recover }) {
			const result = yield* rejectedStart();

			expect(result).toEqual({ outcome: "rejected", providerCode: code });
			expect(yield* recover()).toMatchObject({ evidence: "Provider capacity refusal", operationId: "edit", type: "not-accepted" });
		},
	);
}
