import { githubBudgetOptions } from "#test/engineBudget.ts";
import type { EngineStory } from "#test/engineState.ts";
export function githubBudget(mode: "delivery" | "limit" | "reserve") {
	return (state: EngineStory) => githubBudgetOptions(state, mode);
}
