import { utimesSync } from "node:fs";
import { join } from "node:path";
import { Clock } from "effect";
import { boardStory, projectFiles } from "./boardStory.ts";

export function finishedBrief(id: string, status = "done") {
	return `---\nid: ${id}\nkind: task\nstatus: ${status}\nrelationships: [{kind: implements, target: goal}]\n---\n# ${id}\n`;
}

export function archiveFixture(aged = true) {
	return boardStory.traits(
		projectFiles({
			"goal.md": "---\nid: goal\nkind: goal\nstatus: ready\n---\n# Goal\n",
			"tasks/board/dropped.md": finishedBrief("dropped", "dropped"),
			"tasks/board/old.md": finishedBrief("old"),
			"tasks/board/open.md": finishedBrief("open", "ready").replace("target: goal}]", "target: goal}, {kind: depends_on, target: old}]"),
			"tasks/board/recent.md": finishedBrief("recent"),
		}),
		boardStory.trait(
			"project",
			aged ? "finished and open briefs have been unchanged for fifteen days" : "the briefs changed recently",
			function* (engine) {
				if (!aged) {
					return;
				}
				const old = new Date((yield* Clock.currentTimeMillis) - 15 * 24 * 60 * 60 * 1000);
				for (const file of ["old", "dropped", "open"]) {
					utimesSync(join(engine.notes.root, `tasks/board/${file}.md`), old, old);
				}
			},
		),
	);
}
