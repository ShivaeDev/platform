import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/test-story/client/react.ts";
import { goalPageFixture } from "#test/goalPageFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

for (const kind of ["task", "question", "report"] as const) {
	const id = `${kind}.linked`;
	const ORIGINAL_TASKS = 5;
	const expectedTasks = ORIGINAL_TASKS + (kind === "task" ? 1 : 0);
	screenStory.it(
		`counts an implementing ${kind} only when it is a task`,
		[
			routedScreen(
				{
					...goalPageFixture(),
					"linked.md": `---\nid: ${id}\nkind: ${kind}\n${kind === "question" ? "scope: task\nurgency: whenever\n" : ""}status: done\nrelationships:\n - kind: implements\n   target: project.example#first\n---\n# Linked ${kind}`,
				},
				"/goal.md",
			),
		],
		function* ({ findElements, readGoals }) {
			yield* eventually(() => expect(findElements("[data-goal-item]")).toHaveLength(expectedTasks));
			const goal = (yield* Effect.promise(readGoals))?.goals.find((item) => item.id === "project.example");
			expect(goal?.linked).toBe(expectedTasks);
			expect(goal?.counts.done).toBe(kind === "task" ? 2 : 1);
			expect(findElements(`[data-goal-item="${id}"]`)).toHaveLength(kind === "task" ? 1 : 0);
		},
	);
}
