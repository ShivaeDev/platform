import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { claude, savedSubagent, unreadableCensus } from "#test/claudeStory.ts";
import { assistant, key, line, NATIVE_SESSION, progress, stamp, stored } from "#test/frames.ts";

claude.it(
	"the live and mirror lanes reconcile equal UUIDs while retaining identical text with a different UUID",
	[],
	function* ({ start, frame, mirror, messages }) {
		yield* start();
		const uuid = stamp();
		yield* frame(assistant("Same words", uuid));
		yield* mirror(key(), [line("Same words", uuid), line("Same words")]);
		expect(yield* messages()).toEqual(["Build the app", "Same words", "Same words"]);
	},
);
claude.it("a mirror arriving before its live frame appears only once", [], function* ({ start, frame, mirror, messages }) {
	yield* start();
	const uuid = stamp();
	yield* mirror(key(), [line("Mirrored first", uuid)]);
	yield* frame(assistant("Mirrored first", uuid));
	expect(yield* messages()).toEqual(["Build the app", "Mirrored first"]);
});
claude.it(
	"workflow transcript output keeps its node and spawning call and receives its later name and ending",
	[],
	function* ({ start, frame, mirror, transcript }) {
		yield* start();
		const workflow = key("subagents/workflows/review/agent-auditor");
		yield* mirror(workflow, [line("Reading")]);
		yield* frame(progress("running", "Read the ledger"));
		yield* mirror(workflow, [line("Read")]);
		yield* frame(progress("done", "Read the ledger"));
		const events = (yield* transcript()).events;
		expect(events.filter((event) => event.type === "child.opened")).toMatchObject([
			{ childRef: "auditor", spawnedBy: "subagents/workflows/review" },
			{ childRef: "auditor", label: "Read the ledger", spawnedBy: "workflow-call" },
		]);
		expect(events.filter((event) => event.type === "message" && event.role === "agent")).toMatchObject([
			{ origin: { node: "auditor", spawnedBy: "subagents/workflows/review" }, parts: [{ text: "Reading" }] },
			{ origin: { node: "auditor", spawnedBy: "workflow-call" }, parts: [{ text: "Read" }] },
		]);
		expect(events.filter((event) => event.type === "child.ended")).toMatchObject([{ childRef: "auditor", outcome: "completed" }]);
	},
);
claude.it(
	"repair recovers an unseen subagent with explicit partial evidence",
	[savedSubagent("lost", [stored("Recovered answer")])],
	function* ({ start, finish, transcript }) {
		yield* start();
		yield* finish();
		const result = yield* transcript();
		expect(result.completeness).toBe("partial");
		expect(result.events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ childRef: "lost", spawnedBy: "spawn", type: "child.opened" }),
				expect.objectContaining({ kind: "adopted-late", origin: { node: "lost", spawnedBy: "spawn" }, type: "gap" }),
				expect.objectContaining({
					origin: { node: "lost", spawnedBy: "spawn" },
					parts: [{ text: "Recovered answer", type: "text" }],
					type: "message",
				}),
				expect.objectContaining({ childRef: "lost", outcome: "unknown", type: "child.ended" }),
			]),
		);
	},
);
const delivered = stored("Delivered");
claude.it(
	"repair compares UUIDs for a known subagent and recovers only missing lines with a gap",
	[savedSubagent("reader", [delivered, stored("Missed")])],
	function* ({ start, frame, mirror, finish, messages, transcript }) {
		yield* start();
		yield* frame({
			description: "Reader",
			"session_id": NATIVE_SESSION,
			subtype: "task_started",
			"task_id": "reader",
			"task_type": "local_agent",
			"tool_use_id": "spawn",
			type: "system",
			uuid: stamp(),
		});
		yield* mirror(key("subagents/agent-reader"), [line("Delivered", delivered.uuid)]);
		yield* finish();
		yield* outcomes([
			["transcript messages", () => messages(), ["Build the app", "Delivered", "Missed"]],
			[
				"missing output",
				() => transcript(),
				{
					events: expect.arrayContaining([
						expect.objectContaining({ kind: "missing-output", origin: { node: "reader", spawnedBy: "spawn" }, type: "gap" }),
					]),
				},
			],
		]);
	},
);
claude.it("an unreadable repair census becomes an explicit transcript gap", [unreadableCensus], function* ({ start, finish, transcript }) {
	yield* start();
	yield* finish();
	expect((yield* transcript()).events).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ detail: expect.stringContaining("transcript directory unavailable"), kind: "unknown", type: "gap" }),
		]),
	);
});
claude.it("spilled tool output retains its preview and declares the missing full output", [], function* ({ start, frame, transcript }) {
	yield* start();
	yield* frame({
		message: { content: [{ content: "Preview", "tool_use_id": "read", type: "tool_result" }], role: "user" },
		"parent_tool_use_id": null,
		"tool_use_result": { persistedOutputPath: "/provider/output.txt", persistedOutputSize: 50_000 },
		type: "user",
		uuid: stamp(),
	});
	expect((yield* transcript()).events).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ ok: true, output: "Preview", toolId: "read", type: "tool.completed" }),
			expect.objectContaining({ detail: "full tool output spilled to /provider/output.txt (50000 bytes)", kind: "spilled-preview", type: "gap" }),
		]),
	);
});
claude.it("outgoing user input and its provider mirror share a UUID and appear once", [], function* ({ start, inputs, mirror, messages }) {
	yield* start();
	const sent = (yield* inputs())[0];
	yield* mirror(key(), [{ message: { content: "Build the app", role: "user" }, type: "user", uuid: sent?.uuid ?? "" }]);
	expect(yield* messages()).toEqual(["Build the app"]);
});
claude.it(
	"a workflow mirror arriving after its final progress frame still receives its name and ending",
	[],
	function* ({ start, frame, mirror, transcript }) {
		yield* start();
		yield* frame(progress("done", "Finished review"));
		yield* mirror(key("subagents/workflows/review/agent-auditor"), [line("Reviewed")]);
		const events = (yield* transcript()).events;
		expect(events.filter((event) => event.type === "child.opened" || event.type === "child.ended")).toMatchObject([
			{ childRef: "auditor", label: "Finished review", spawnedBy: "workflow-call", type: "child.opened" },
			{ childRef: "auditor", outcome: "completed", type: "child.ended" },
		]);
	},
);
