import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const files = {
	"decision.md": "---\nid: decision\nkind: question\nscope: task\nurgency: whenever\n---\n# Decision record",
	"question.md": "---\nid: question\nkind: question\nscope: task\nurgency: whenever\n---\n# Question record",
	"receipt.md": `---\nid: receipt\nkind: task\nrequest_receipt:\n  disposition: superseded\n  question: question\n  recordedAt: 0\n  reviewedRevision: "${"a".repeat(64)}"\n---\n# Receipt record`,
	"response.md": "---\nid: response\n---\n# Response record",
	"result.md": "---\nid: result\nkind: report\n---\n# Result record",
	"task.md": "---\nid: task\nkind: task\nstatus: ready\n---\n# Work task",
};

for (const [layout, query, total] of [
	["Now", "", "none"],
	["All work", "?view=board", "1 shown · 1 items in this view"],
	["Table", "?view=table", "1 shown · 1 items in this view"],
] as const) {
	screenStory.it(
		`${layout} lists only the work task, never questions, responses, results or request receipts`,
		[routedScreen(files, `/_board/work${query}`)],
		function* ({ workItems, workTotal }) {
			yield* outcomes([
				["total", () => workTotal(), total],
				["work shown", () => workItems(), ["task"]],
			]);
		},
	);
}
