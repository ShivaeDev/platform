import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { goalPageFixture } from "#test/goalPageFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

for (const kind of ["task", "question", "report"] as const) {
	const id = `${kind}.linked`;
	const counted = kind === "task";
	screenStory.it(
		`a done ${kind} that implements a goal's criterion ${counted ? "counts" : "does not count"} as the goal's linked work`,
		[
			routedScreen(
				{
					...goalPageFixture(),
					"linked.md": `---\nid: ${id}\nkind: ${kind}\n${kind === "question" ? "scope: task\nurgency: whenever\n" : ""}status: done\nrelationships:\n - kind: implements\n   target: project.example#first\n---\n# Linked ${kind}`,
				},
				"/goal.md",
			),
		],
		function* ({ goalPageStateCounts, linkedWorkItems }) {
			yield* outcomes({
				"done work": [goalPageStateCounts(), expect.arrayContaining([counted ? "2 done" : "1 done"])],
				"linked work": [linkedWorkItems(), counted ? expect.arrayContaining([id]) : expect.not.arrayContaining([id])],
			});
		},
	);
}
