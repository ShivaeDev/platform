import { expect } from "vitest";
import { orchestratorWorkCard } from "#test/orchestratorWorkCard.tsx";
import { screenStory } from "#test/screenStory.ts";

screenStory.it(
	"A work card Fleet is building for the orchestrator names the orchestrator and leaves out an unknown pull request and stage time",
	[orchestratorWorkCard()],
	function* ({ nowCard }) {
		expect(yield* nowCard("task-0")).toEqual(
			expect.objectContaining({ owner: "Waiting on orchestrator", stage: "none", states: ["Working"], text: expect.not.stringContaining("PR") }),
		);
	},
);
