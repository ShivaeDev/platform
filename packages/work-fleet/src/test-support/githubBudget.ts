import { githubBudgetOptions } from "#test/engineBudget.ts";
import type { EngineStory } from "#test/engineState.ts";
export function githubBudget(mode: "delivery" | "limit" | "reserve", remaining?: number) {
	return (state: EngineStory) => githubBudgetOptions(state, mode, remaining);
}
