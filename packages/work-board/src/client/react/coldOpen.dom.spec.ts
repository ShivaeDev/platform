import { describe, expect } from "vitest";
import { boardStory, projectFiles, readerAt } from "#test/boardStory.ts";

const project = projectFiles({
	"goals/launch.md": "---\nid: goal.launch\nkind: goal\nstatus: ready\n---\n# Launch the notes\n",
	"plan.md": "# Plan\n\nA plain document.\n",
	"tasks/intro.md": "---\nid: task.intro\nkind: task\nstatus: ready\ngoal: goal.launch\n---\n# Write the intro\n",
});
const shell = ["indexing", "navigation", "watcher", "goals", "fleetItems"];
const pages: Readonly<Record<string, readonly string[]>> = {
	"/": [...shell, "inbox"],
	"/_board/goals": shell,
	"/_board/item/task.intro": [...shell, "document"],
	"/_board/library": [...shell, "library"],
	"/_board/pull-requests": shell,
	"/_board/system": [...shell, "diagnostics", "inbox"],
	"/_board/work": [...shell, "work"],
	"/plan.md": [...shell, "document"],
};

describe("cold open", () => {
	for (const [path, methods] of Object.entries(pages)) {
		boardStory.it(`requests each piece of data for ${path} once`, [project, readerAt(path)], function* ({ reader }) {
			expect(yield* reader.readsByMethod()).toEqual(Object.fromEntries(methods.map((method) => [`work-board.${method}`, 1])));
		});
	}
});
