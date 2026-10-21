import { recordSourceFixture } from "./recordSourceFixture.ts";

function item(id: string, title: string, links: Readonly<Record<string, string>> = {}, kind = "task") {
	const relationships = Object.entries(links).map(([relation, target]) => `  - kind: ${relation}\n    target: ${target}\n`);
	return `---\nid: ${id}\nkind: ${kind}\n${relationships.length > 0 ? `relationships:\n${relationships.join("")}` : ""}---\n# ${title}\n`;
}

export const relationshipsFixture: Readonly<Record<string, string>> = {
	...Object.fromEntries(
		recordSourceFixture.filter(({ file }) => file === "handoff.md" || file === "question.md").map(({ file, source }) => [file, source]),
	),
	"base.md": item("base.fixture", "Base"),
	"board.md": "---\nid: board.fixture\nitems: [task.fixture]\n---\n# Board",
	"brief.md": item("brief.fixture", "Brief", { informs: "task.fixture" }),
	"build.md": item("build.fixture", "Build", { implements: "task.fixture" }),
	"goal.md": item("goal.fixture", "Goal", {}, "goal"),
	"later.md": item("later.fixture", "Later", { "depends_on": "task.fixture" }),
	"notes.md": item("notes.fixture", "Notes"),
	"orphan.md": item("orphan.fixture", "Orphan", { "depends_on": "missing.fixture" }),
	"peer.md": item("peer.fixture", "Peer", { "relates_to": "task.fixture" }),
	"task.md": item("task.fixture", "Task", {
		"depends_on": "base.fixture",
		implements: "goal.fixture",
		informs: "notes.fixture",
		"relates_to": "peer.fixture",
	}),
};

export const projectLinksFixture: Readonly<Record<string, string>> = {
	"build.md": item("build.fixture", "Build", { implements: "project.fixture" }),
	"notes.md": "# Notes\n\n[Project](project.md)",
	"project.md": item("project.fixture", "Project", {}, "goal"),
};
