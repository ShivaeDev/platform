function item(id: string, kind: string, fields: string, title = id) {
	return `---\nid: ${id}\nkind: ${kind}\n${fields}\n---\n# ${title}\n`;
}
function task(id: string, status: string, goal: string, fields = "") {
	return item(id, "task", `status: ${status}\n${fields}\nrelationships:\n  - kind: implements\n    target: ${goal}`);
}
export const sharedVocabularyFixture = {
	"blocking.md": item("question.z", "question", "status: ready\nscope: task\nurgency: blocking", "A blocking question"),
	"board.md": item("lane.board", "goal", "status: ready\nrelationships: [{kind: implements, target: goal}]", "Board lane"),
	"deferred.md": task("task.deferred", "deferred", "lane.fleet", "next_action: Reopen after the API settles"),
	"done.md": task("task.done", "done", "lane.board", "fleet: held\ndelivers: report"),
	"draft.md": task("task.draft", "draft", "lane.board", "fleet: manual\nowner: claude"),
	"dropped.md": task("task.dropped", "dropped", "lane.fleet"),
	"fleet.md": item("lane.fleet", "goal", "status: ready\nrelationships: [{kind: implements, target: goal}]", "Fleet lane"),
	"goal.md": item("goal", "goal", "status: ready\nowner: marvin", "Platform goal"),
	"ready.md": task("task.ready", "ready", "lane.board", "fleet: approved\nowner: codex\ndelivers: pr"),
	"report.md": item("report", "report", "status: done\nrelationships: [{kind: informs, target: goal}]", "Delivered report"),
	"ruling.md": item(
		"question.ruling",
		"question",
		"status: done\nscope: standing\nurgency: whenever\nanswer: Use the existing engine.\nrelationships: [{kind: informs, target: task.ready}]",
		"Engine ruling",
	),
	"whenever.md": item("question.a", "question", "status: ready\nscope: area\nurgency: whenever", "A later question"),
};
