import { githubBudgetOptions } from "#test/engineBudget.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";

export function githubBudget(mode: "delivery" | "limit" | "reserve") {
	return engineConfiguration(`GitHub ${mode} reads use the REST budget`, (state) => githubBudgetOptions(state, mode));
}
