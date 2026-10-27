import { boardWork } from "@shivaedev/work-fleet/test-support/hostStory.ts";

export const paneProject = boardWork({
	"build.md": "---\nid: task.build\nkind: task\nfleet: approved\nrelationships:\n - kind: implements\n   target: goal.ship\n---\n# Build the pane",
	"goal.md": "---\nid: goal.ship\nkind: goal\n---\n# Ship the pane",
});

export const fiveTasks = boardWork(
	Object.fromEntries(
		["one", "two", "three", "four", "five"].map((id) => [
			`${id}.md`,
			`---\nid: task.${id}\nkind: task\nfleet: approved\nrelationships: [{kind: implements, target: goal.ship}]\n---\n# Build ${id}`,
		]),
	),
);
