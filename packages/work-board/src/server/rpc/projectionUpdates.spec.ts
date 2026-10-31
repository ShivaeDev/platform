import { expect } from "vitest";
import { boardHome, boardStory, projectFiles } from "#test/boardStory.ts";
import { projectionTask } from "#test/projectionTask.ts";

const HOME = "# Home board\n\n## Plans\n\n### Task\n\nRead the source.\n";
const project = [projectFiles({ "home.md": HOME, "task.md": projectionTask("A task") }), boardHome("home.md")];

for (const view of ["the Inbox", "the work board", "the work table"] as const) {
	boardStory.it(`renaming a task updates ${view} mounted through native HTTP`, project, function* ({ edited, mountedUpdate, mounts }) {
		expect(yield* mounts(view)).toBe("A task");

		yield* edited("task.md", projectionTask("Updated task"));

		expect(yield* mountedUpdate(view)).toBe("Updated task");
	});
}

boardStory.it("editing the home file updates the home board mounted through native HTTP", project, function* ({ edited, mountedUpdate, mounts }) {
	expect(yield* mounts("the home board")).toContain("Home board");

	yield* edited("home.md", HOME.replace("Home board", "Updated board"));

	expect(yield* mountedUpdate("the home board")).toContain("Updated board");
});
