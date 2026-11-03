import { expect } from "@effect/vitest";
import { boardFileStory } from "#test/boardFileStory.ts";

const SUMMARY = "Done; PR #7 merged.";

boardFileStory.it(
	"a completion at the saved path is refused when that file now holds another identity, and the file is kept",
	[],
	function* ({ completion }) {
		const other = completion.source.replace("id: one", "id: other");
		yield* completion.writeTask(other);

		const completed = yield* completion.complete("one", `${completion.root}/tasks/one.md`, SUMMARY);

		expect(completed).toBe("Board failure: Board item no longer exists: one");
		expect(yield* completion.taskSource()).toBe(other);
	},
);

boardFileStory.it("completion records done and its summary while preserving authored fields and body", [], function* ({ completion }) {
	const source = completion.source.replace("kind: task", "kind: task\ncriteria: [{id: behavior, text: Keep the body}]\nfleet-priority: high");
	yield* completion.writeTask(source);

	yield* completion.complete("one", `${completion.root}/tasks/one.md`, SUMMARY);

	expect(yield* completion.taskMetadata()).toMatchObject({
		body: "Authored source.\n",
		fields: { criteria: [{ id: "behavior", text: "Keep the body" }], id: "one", nextAction: SUMMARY, status: "done" },
		values: { "fleet-priority": "high" },
	});
});

boardFileStory.it("completion refuses bookkeeping that would change an aliased criterion and keeps the source", [], function* ({ completion }) {
	const source = completion.source.replace("next_action: Work", "next_action: &action Work\ncriteria: [{id: behavior, text: *action}]");
	yield* completion.writeTask(source);

	const result = yield* completion.complete("one", `${completion.root}/tasks/one.md`, SUMMARY);

	expect(result).toBe("Board failure: Completion bookkeeping would change authored Board context or identity.");
	expect(yield* completion.taskSource()).toBe(source);
});

boardFileStory.it("completion records done and its summary while preserving a BOM and Windows body newlines", [], function* ({ completion }) {
	const source = `\uFEFF${completion.source.replaceAll("\n", "\r\n")}`;
	yield* completion.writeTask(source);

	yield* completion.complete("one", `${completion.root}/tasks/one.md`, SUMMARY);

	const saved = yield* completion.taskSource();
	expect({ metadata: yield* completion.taskMetadata(), opening: saved.slice(0, 6) }).toMatchObject({
		metadata: { body: "Authored source.\r\n", fields: { nextAction: SUMMARY, status: "done" } },
		opening: "\uFEFF---\r\n",
	});
});
