import { decisionFile } from "./answerCardFixture.ts";
import { answeredDecisionFixture } from "./answeredDecisionFixture.ts";

export const ACTIVE_GUIDE = "---\nid: task.guide\nkind: task\nstatus: ready\n---\n# Publish the install guide\n";

export function closedDecision(files: Readonly<Record<string, string>>): Record<string, string> {
	return { ...files, "guide.md": ACTIVE_GUIDE, [decisionFile]: (files[decisionFile] ?? "").replace('"state":"open"', '"state":"closed"') };
}

export function unansweredDecision(): Record<string, string> {
	return Object.fromEntries(Object.entries(answeredDecisionFixture()).filter(([file]) => !file.startsWith("responses/response.")));
}

export const GOALS = {
	"decision.md": "---\nid: decision.scope\nkind: question\nscope: task\nurgency: whenever\n---\n# Scope",
	"dropped.md": "---\nid: task.dropped\nkind: task\nstatus: dropped\n---\n# Dropped task",
	"finished.md":
		"---\nid: task.finished\nkind: task\nstatus: done\nrelationships:\n  - kind: implements\n    target: goal.reader\n---\n# Finished task",
	"goal.md": "---\nid: goal.reader\nkind: goal\nstatus: ready\ncriteria:\n  - id: layout\n    text: The layout reads well\n---\n# Readable workspace",
	"home.md": "# Home",
	"task.md":
		"---\nid: task.part\nkind: task\nstatus: ready\nrelationships:\n  - kind: implements\n    target: goal.reader#layout\n  - kind: implements\n    target: decision.scope\n---\n# Part of the goal",
};
