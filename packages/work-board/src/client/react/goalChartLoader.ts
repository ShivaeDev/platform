export type GoalChartModule = typeof import("./GoalChart.tsx");
export type GoalChartLoad = GoalChartModule | { readonly error: string };

let loaded: GoalChartModule | undefined;
let loading: Promise<GoalChartLoad> | undefined;

export function loadedGoalChart() {
	return loaded;
}

// A failed chunk stays failed until the reader reloads, so the chart reports it once instead of refetching on each render.
export function loadGoalChart() {
	loading ??= import("./GoalChart.tsx").then(
		(module) => {
			loaded = module;
			return module;
		},
		(error: unknown) => ({ error: error instanceof Error ? error.message : String(error) }),
	);
	return loading;
}
