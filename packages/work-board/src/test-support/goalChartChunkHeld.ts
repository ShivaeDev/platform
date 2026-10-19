import { vi } from "vitest";
import { screenStory } from "./screenStory.ts";

const download = Promise.withResolvers<void>();

vi.mock("#client/react/GoalChart.tsx", async (importOriginal) => {
	await download.promise;
	return importOriginal();
});

export function goalChartChunkHeld() {
	return screenStory.trait("workspace", "the goal chart chunk is still downloading", () => undefined);
}

export function finishGoalChartDownload() {
	download.resolve();
}
