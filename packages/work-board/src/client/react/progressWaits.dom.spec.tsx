import { expect } from "vitest";
import { progressWaits } from "#test/progressWaits.ts";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen } from "#test/screenTraits.ts";
import { TodayProgress } from "./TodayProgress.tsx";

screenStory.it(
	"Today includes PR waits in progress, names each owner and excludes waits without a PR and completed work",
	[componentScreen(<TodayProgress data={progressWaits()} failed={false} />)],
	({ findElements, readText }) => {
		expect(findElements("[data-progress-id]").map((row) => row.getAttribute("data-progress-id"))).toEqual([
			"task.sample.0",
			"automation",
			"maintainer",
			"orchestrator",
		]);
		expect(readText('[data-progress-id="automation"]')).toContain("Waiting on automation");
		expect(readText('[data-progress-id="maintainer"]')).toContain("Waiting on you");
		expect(readText('[data-progress-id="orchestrator"]')).toContain("Waiting on orchestrator");
	},
);
