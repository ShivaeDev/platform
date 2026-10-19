import { vi } from "vitest";
import { screenStory } from "./screenStory.ts";

// The screen engine loads the goal chart before any trait runs, so the failure covers every story in an importing file.
vi.mock("#client/react/GoalChart.tsx", () => {
	throw new TypeError("Failed to fetch dynamically imported module");
});

export function goalChartChunkFails() {
	return screenStory.trait("workspace", "the goal chart chunk cannot be fetched", () => undefined);
}
