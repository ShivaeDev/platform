import type { PromptAnswer } from "#browser/responses/schema.ts";
import { questionId, questionMarkdown, responseMarkdown, revisionOf } from "#server/responses/records.ts";

function decision(id: string, fields = "", body = "# Fleet asks\n\nWhich branch should continue?\n") {
	return `---\nid: ${id}\nkind: decision\nstatus: open\n${fields}relationships: [{kind: relates_to, target: task.work}]\n---\n${body}`;
}
function conversation(item: string, source: string, type: "answer" | "not_now", body: string, answers?: readonly PromptAnswer[]) {
	const path = `responses/${item}.md`;
	const revision = revisionOf(source);
	const question = questionId(item, "choice", revision, path);
	return {
		[`responses/${question}.md`]: questionMarkdown({
			context: source,
			id: question,
			question: { deadline: 0, item, reason: "Choose a branch", registeredAt: 1, request: "choice", reviewedRevision: revision, source: path },
		}).replace("scope: task\nurgency: whenever\n", ""),
		[`responses/answer.${item}.md`]: responseMarkdown({
			body,
			id: `answer.${item}`,
			response: { answers, author: "marvin", question, recordedAt: 2, reviewedRevision: revision, type },
		}).replace("---\n", "---\nkind: response\n"),
		...(type === "answer"
			? {
					[`responses/previous.${item}.md`]: responseMarkdown({
						body: "Use the discarded branch.\n",
						id: `previous.${item}`,
						response: { author: "marvin", question, recordedAt: 1, reviewedRevision: revision, type: "answer" },
					}).replace("---\n", "---\nkind: response\n"),
				}
			: {}),
	};
}

function fleetDecision(id: string, state = "open") {
	return decision(
		`fleet.${id}`,
		`attention: [{id: choice, kind: decision, managed: true, reason: Choose a branch, response_from: [maintainer], state: ${state}, unblocks: [task.${id}]}]\n`,
	);
}
const open = fleetDecision("open");
const answered = fleetDecision("answered", "closed");
const deferred = fleetDecision("deferred");
export const migrationDecisionFixture = {
	"decisions/empty.md": decision("unruled", "", ""),
	"decisions/storage.md": decision("storage", "owner: Marvin\n", "# Storage ruling\n\nKeep PostgreSQL.\n"),
	"responses/fleet.answered.md": answered,
	"responses/fleet.deferred.md": deferred,
	"responses/fleet.open.md": open,
	"task.md": "---\nid: task.work\nkind: task\nstatus: active\n---\n# Branch work\n",
	...Object.fromEntries(
		["open", "answered", "deferred"].map((id) => [`task.${id}.md`, `---\nid: task.${id}\nkind: task\nstatus: active\n---\n# ${id}\n`]),
	),
	...conversation("fleet.answered", answered, "answer", "Use the current branch.\n"),
	...conversation("fleet.deferred", deferred, "not_now", "Ask again later.\n"),
	...conversation(
		"fleet.open",
		open.replace("Which branch should continue?", "Which older branch should continue?"),
		"answer",
		"An outdated answer.\n",
	),
};

const selected = fleetDecision("selected");
const multiple = fleetDecision("multiple");
const written = fleetDecision("written");
const closed = fleetDecision("closed", "closed");
export const migrationAskStateFixture = {
	"responses/fleet.closed.md": `${closed.slice(0, closed.indexOf("---", 3))}next_action: Closed because Board work task.closed is done.\n---\n# Fleet asks\n`,
	"responses/fleet.multiple.md": multiple.replace("state: open", "state: closed"),
	"responses/fleet.selected.md": selected,
	"responses/fleet.written.md": written.replace("Which branch should continue?", "Which revised branch should continue?"),
	"task.md": "---\nid: task.work\nkind: task\n---\n# Branch work\n",
	...conversation("fleet.selected", selected, "answer", "", [{ prompt: "choice", selected: ["release"], text: "" }]),
	...conversation("fleet.multiple", multiple, "answer", "", [{ prompt: "choice", selected: ["release", "retry"], text: "" }]),
	...conversation("fleet.written", written, "answer", "Use the earlier revision.\n"),
	...Object.fromEntries(
		["selected", "multiple", "written", "closed"].map((id) => [`task.${id}.md`, `---\nid: task.${id}\nkind: task\n---\n# ${id}\n`]),
	),
};
