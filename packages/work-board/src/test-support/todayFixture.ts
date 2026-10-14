import { attentionLanesFixture } from "./attentionLanesFixture.ts";
import { goalsFixture } from "./goalsFixture.ts";

export function todayFixture(): Record<string, string> {
	return {
		"home.md": "# Workspace notes\n\n## Plan\n\n### Keep the source readable\n",
		...attentionLanesFixture(),
		...goalsFixture(),
		...Object.fromEntries(
			Array.from({ length: 50 }, (_, index) => [
				`tasks/work-${index}.md`,
				`---\nid: task.sample.${index}\nkind: task\nstatus: ${index % 3 === 0 ? "done" : "active"}\nowner: agent\nrelationships:\n - kind: implements\n   target: project.example#second\n---\n# Workspace task ${index}\n`,
			]),
		),
	};
}
