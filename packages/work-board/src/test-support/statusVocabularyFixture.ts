function task(id: string, status: string, title: string, fleet = "") {
	return `---\nid: ${id}\nkind: task\nstatus: ${status}\n${fleet}relationships:\n  - kind: implements\n    target: goal.ship\n---\n# ${title}\n`;
}

export function statusVocabularyFixture(): Record<string, string> {
	return {
		"goal.md": "---\nid: goal.ship\nkind: project\nstatus: active\n---\n# Ship the release\n",
		"home.md": "# Home\n",
		"tasks/merge.md": task("task.merge", "review", "Merge the release branch"),
		"tasks/odd.md": task("task.odd", "wip", "Odd status work"),
		"tasks/ready.md": task("task.ready", "ready", "Approved ready work", "fleet: approved\n"),
	};
}
