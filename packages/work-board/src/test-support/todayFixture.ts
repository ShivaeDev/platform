import { attentionLanesFixture } from "./attentionLanesFixture.ts";
import { goalsFixture } from "./goalsFixture.ts";

export function todayFixture(): Record<string, string> {
	return {
		"home.md": "# Workspace notes\n\n## Plan\n\n### Keep the source readable\n",
		...attentionLanesFixture(),
		...goalsFixture(),
		...Object.fromEntries(
			["alpha", "beta"].flatMap((name) => [
				[
					`goals/${name}.md`,
					`---\nid: project.${name}\nkind: goal\nstatus: ready\nnext_action: Review ${name} delivery evidence with the maintainer and verify every linked task before choosing the next step. Record the remaining questions and arrange a follow-up review once the evidence is complete.\ncriteria:\n${Array.from({ length: 30 }, (_, index) => ` - id: proof-${index}\n   text: Evidence criterion ${index}`).join("\n")}\n---\n# ${name === "alpha" ? "First" : "Second"} active goal\n`,
				],
				...["done", "ready"].map((status) => [
					`goals/${name}-${status}.md`,
					`---\nid: task.${name}.${status}\nkind: task\nstatus: ${status}\nrelationships:\n - kind: implements\n   target: project.${name}#proof-0\n---\n# ${name} ${status} task\n`,
				]),
			]),
		),
		...Object.fromEntries(
			Array.from({ length: 50 }, (_, index) => [
				`tasks/work-${index}.md`,
				`---\nid: task.sample.${index}\nkind: task\nstatus: ${index % 3 === 0 ? "done" : "ready"}\nowner: claude\nrelationships:\n - kind: implements\n   target: project.example#second\n---\n# Workspace task ${index}\n`,
			]),
		),
	};
}
