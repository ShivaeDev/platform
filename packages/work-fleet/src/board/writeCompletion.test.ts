import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { completionMarkdown } from "#board/completionMarkdown.ts";
import { boardFileStory } from "#test/boardFileStory.ts";

const SUMMARY = "Done; PR #7 merged.";

for (const authored of ["identity", "criterion"] as const) {
	boardFileStory.it(
		`completion is refused when a YAML alias would change the authored ${authored}, and the task is kept`,
		[],
		function* ({ completion }) {
			const anchored = completion.source.replace("status: draft", "status: &bookkeeping planned");
			const aliased =
				authored === "identity"
					? anchored.replace("id: one", "id: *bookkeeping")
					: anchored.replace("next_action: Work", "next_action: Work\ncriteria: [{ id: behavior, text: *bookkeeping }]");
			yield* completion.writeTask(aliased);

			const completed = yield* completion.complete(authored === "identity" ? "planned" : "one", `${completion.root}/tasks/one.md`, SUMMARY);

			expect(completed).toMatch(/^Board failure: /u);
			expect(yield* completion.taskSource()).toBe(aliased);
		},
	);
}

for (const location of ["root", "directory", "file"] as const) {
	boardFileStory.it(`a completion through a symlinked ${location} is refused and the outside task is kept`, [], function* ({ completion }) {
		yield* completion.linkOutside(location);

		const published = yield* completion.publish(completion.root, "tasks/one.md", completion.source, "replacement");

		expect(published).toMatch(/^report file failure: /u);
		expect(yield* completion.outsideSource()).toBe(completion.source);
	});
}

boardFileStory.it("a task edited after the replacement is prepared keeps the edit and loses the temporary file", [], function* ({ completion }) {
	const changed = `${completion.source}A human edit.\n`;
	const edit = yield* completion.editTaskWhileReplacing(changed);

	yield* completion.publish(completion.root, "tasks/one.md", completion.source, completionMarkdown(completion.source, SUMMARY) ?? "");

	yield* outcomes([
		["task before the edit", () => edit.beforeEdit(), { source: completion.source, temporaryFiles: 1 }],
		["task", () => completion.taskSource(), changed],
		["task folder", () => completion.taskFiles(), ["one.md"]],
	]);
});

boardFileStory.it("a completion against a different Board root is refused", [], function* ({ completion }) {
	expect(yield* completion.publish(completion.outside, "tasks/one.md", completion.source, "replacement")).toMatch(/^report file failure: /u);
});

boardFileStory.it(
	"a completion at the saved path is refused when that file now holds another identity, and the file is kept",
	[],
	function* ({ completion }) {
		const other = completion.source.replace("id: one", "id: other");
		yield* completion.complete("one", `${completion.root}/moved.md`, SUMMARY);
		yield* completion.writeTask(other);

		const completed = yield* completion.complete("one", `${completion.root}/tasks/one.md`, SUMMARY);

		expect(completed).toMatch(/^Board failure: /u);
		expect(yield* completion.taskSource()).toBe(other);
	},
);
