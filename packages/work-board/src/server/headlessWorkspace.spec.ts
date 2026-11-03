import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { SETTLED_DECISION_SOURCE, TASK_SOURCE } from "#test/headlessWorkspaceFixture.ts";
import { headlessWorkspaceStory, workspaceFiles } from "#test/headlessWorkspaceStory.ts";

const task = workspaceFiles({ "task.md": TASK_SOURCE });

headlessWorkspaceStory.it("an application reads a document without starting the Board server", [task], function* ({ document }) {
	const read = yield* document("/task.md");

	expect(read).toMatchObject({
		file: "task.md",
		identity: "task",
		metadata: { kind: "task", status: "ready" },
		source: "# The task\n\nKeep the task body exactly as written.\n",
	});
});

headlessWorkspaceStory.it("a headless workspace follows external document edits", [task], function* ({ document, editorWrites, nextChangedPaths }) {
	expect((yield* document("/task.md")).source).toContain("The task");

	yield* editorWrites("task.md", TASK_SOURCE.replace("The task", "The changed task"));

	yield* outcomes([
		["indexed changes", () => nextChangedPaths(), ["task.md"]],
		["changed document", () => document("/task.md"), { source: "# The changed task\n\nKeep the task body exactly as written.\n" }],
	]);
});

headlessWorkspaceStory.it("closing the headless workspace scope closes its change feed", [task], function* ({ stop, watchingStopped }) {
	expect(yield* watchingStopped()).toBe(false);

	yield* stop();

	expect(yield* watchingStopped()).toBe(true);
});

headlessWorkspaceStory.it(
	"a headless workspace loads settled decisions into an archived snapshot",
	[task, workspaceFiles({ "decision.md": SETTLED_DECISION_SOURCE })],
	function* ({ archived, indexedFiles }) {
		expect(yield* indexedFiles()).not.toContain("decision.md");

		const snapshot = yield* archived("task");

		expect(snapshot).toContainEqual({ body: "# Settled direction\n", file: "decision.md", id: "settled" });
	},
);

headlessWorkspaceStory.it(
	"a headless workspace reads settled documents by identity",
	[task, workspaceFiles({ "decision.md": SETTLED_DECISION_SOURCE })],
	function* ({ document }) {
		const read = yield* document("/_board/item/settled");

		expect(read).toMatchObject({ identity: "settled", source: "# Settled direction\n" });
	},
);
