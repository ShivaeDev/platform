import { Effect } from "effect";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { newEngineState } from "#test/engineState.ts";
import { engineDefinition } from "#test/engineStory.ts";
import { engineVerbs } from "#test/engineVerbs.ts";

export const areaOrder = storyKit({
	...engineDefinition,
	around: withIsolatedDatabase,
	create: () => {
		const state = { ...newEngineState(), conflictingPrs: new Set<string>(), red: new Set<string>() };
		state.options = { now: () => state.now };
		return state;
	},
	verbs: (state, story) => ({
		...engineVerbs(state, story),
		checksFail: (id: string) => {
			state.red.add(id);
			story.tell(`${id}'s required checks fail`);
		},
		checksPass: (id: string) => {
			state.red.delete(id);
			story.tell(`${id}'s repair passes its required checks`);
		},
		conflictsWithMain: (id: string) => {
			state.conflictingPrs.add(id);
			story.tell(`${id}'s PR conflicts with main`);
		},
		resolveMainConflict: (id: string) => {
			state.conflictingPrs.delete(id);
			story.tell(`${id}'s repair resolves its main conflict`);
		},
	}),
});

export const cyclicChecks = areaOrder.trait("configuration", "required checks can turn green for either cycle member", (state) => {
	state.options = {
		...state.options,
		checksQuery: (result) =>
			Effect.succeed({
				evidence: ["Required checks observed for the PR head"],
				head: result.head,
				passed: result.kind === "change" && !state.red.has(result.pr.split("/").at(-1) ?? ""),
			}),
	};
});
