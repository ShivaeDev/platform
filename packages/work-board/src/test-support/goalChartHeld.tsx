import { type ComponentType, use } from "react";
import { vi } from "vitest";
import { screenStory } from "./screenStory.ts";

type ChartProps = Readonly<Record<string, unknown>>;

const ready = Promise.withResolvers<void>();

// The screen engine loads every chunk before a screen opens, so the chart suspends inside its own chunk instead.
vi.mock("#client/react/GoalChart.tsx", async (importOriginal) => {
	const { GoalChart } = await importOriginal<{ readonly GoalChart: ComponentType<ChartProps> }>();
	return {
		GoalChart: (props: ChartProps) => {
			use(ready.promise);
			return <GoalChart {...props} />;
		},
	};
});

export function goalChartHeld() {
	return screenStory.trait("workspace", "the goal chart is still loading", () => undefined);
}

export function finishGoalChart() {
	ready.resolve();
}
