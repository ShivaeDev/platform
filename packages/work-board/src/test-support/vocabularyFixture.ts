import { questionId, questionMarkdown, responseMarkdown, revisionOf } from "#server/responses/records.ts";

function item(id: string, fields: string, body = `# ${id}\n\nKeep **these bytes**, spacing and links.  \n`) {
	return `---\nid: ${id}\n${fields}\n---\n${body}`;
}

const documents = {
	"draft.md": item("draft", "kind: task\nstatus: planned\nowner: cloud-worker\nfleet: none\nfleet-deliverable: report"),
	"goal.md": item("goal", "kind: project\nstatus: active\nowner: Claude"),
	"last-owner.md": item("last-owner", "kind: task\nstatus: ready\nowner: claude-worker"),
	"question.md": item("question", "kind: question\nstatus: open\nowner: orchestrator\nrelationships: [{kind: relates_to, target: draft}]"),
	"replaced.md": item("replaced", "kind: task\nstatus: superseded\nowner: claude-cloud\nsuperseded_by: successor"),
	"report.md": item("report", "kind: result\nstatus: received\nowner: Marvin"),
	"ruling.md": item(
		"ruling",
		"kind: decision\nstatus: done\nscope: area\nowner: claude-code\nrelationships: [{kind: informs, target: goal}]",
		"# Ruling\n\nUse the existing engine.\n",
	),
	"successor.md": item(
		"successor",
		"kind: task\nstatus: ready\nowner: claude-local\nrelationships:\n  - kind: implements # retain this comment\n    target: goal",
	),
};

const context = documents["question.md"];
const revision = revisionOf(context);
const captured = questionId("question", "answer", revision, "question.md");
export const vocabularyFixture = {
	...documents,
	"answer.md": responseMarkdown({
		body: "Keep this answer.  \n",
		id: "answer",
		response: { author: "marvin", question: captured, recordedAt: 1, reviewedRevision: revision, type: "answer" },
	}).replace("---\n", "---\nkind: response\n"),
	"captured.md": questionMarkdown({
		context,
		id: captured,
		question: {
			deadline: 0,
			item: "question",
			reason: "Choose",
			registeredAt: 0,
			request: "answer",
			reviewedRevision: revision,
			source: "question.md",
		},
	}).replace("scope: task\nurgency: whenever\n", ""),
	"crlf.md": "\uFEFF---\r\nid: crlf\r\nkind: project # retain comment\r\nstatus: active\r\n---\r\n# Keep CRLF  \r\n",
	"fleet/status.md": "# Fleet\n\n## Waiting on a person\n\n### draft\n\nStage: needs-human\n",
	"flow.md": '---\n{"id":"flow","kind":"question","status":"open","owner":"Claude"}\n---\n# Flow header\n',
};
