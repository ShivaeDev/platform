import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { assistant } from "#test/assistant.ts";
import { piAgent } from "#test/piStory.ts";

piAgent.it("a new backend resumes the saved native file and history", [], function* ({ start, emit, close, connect, resume, requests, receipt }) {
	yield* start("alice", "remember");
	yield* emit("alice", { message: { content: "remember", role: "user", timestamp: 0 }, type: "message_end" });
	yield* emit("alice", { message: assistant(), type: "message_end" });
	const saved = yield* receipt("alice");
	yield* close();
	yield* connect();

	yield* resume("bob", "alice");

	yield* outcomes([
		["resumed reference", () => receipt("bob"), { session: saved.session }],
		[
			"native history",
			() => requests(),
			[{}, { history: [{ content: "remember", role: "user" }, { role: "assistant" }], prompts: [{ text: "continue" }] }],
		],
	]);
});

piAgent.it(
	"a missing session file refuses resume instead of starting replacement history",
	[],
	function* ({ start, emit, removeSessionFile, resume, requests, result }) {
		yield* start("alice", "remember");
		yield* emit("alice", { message: assistant(), type: "message_end" });
		yield* removeSessionFile("alice");

		yield* resume("bob", "alice");

		yield* outcomes([
			["resume refusal", () => result("bob"), "Pi session file is unavailable for resume"],
			["provider requests", () => requests(), [{ prompts: [{ text: "remember" }] }]],
		]);
	},
);

piAgent.it("unknown session reference versions are refused before provider work", [], function* ({ start, resume, result, requests }) {
	yield* start("alice", "first");
	yield* resume("bob", "alice", 2);

	yield* outcomes([
		["resume refusal", () => result("bob"), "protocol: unsupported session reference version"],
		["provider requests", () => requests(), [{ prompts: [{ text: "first" }] }]],
	]);
});
