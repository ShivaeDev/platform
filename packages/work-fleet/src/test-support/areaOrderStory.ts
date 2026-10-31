import { Effect } from "effect";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { conflictingPr } from "#engine/deliveryFailure.ts";
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

export const areaOrderChecks = areaOrder.trait("configuration", "required checks and main conflicts can change for each PR", (state) => {
	const repository = state.predictionRepository;
	if (repository === undefined) {
		throw new Error("Area order stories need watched branches");
	}
	state.options = {
		...state.options,
		checksQuery: (result) =>
			Effect.sync(() => ({
				evidence: ["Required checks observed for the PR head"],
				head: result.head,
				passed: !state.red.has(result.kind === "change" && result.pr === repository.result("two").pr ? "two" : "one"),
				repairPrompt: "Repair the failed required check",
			})),
		deliveryQuery: (result) =>
			Effect.suspend(() => {
				const id = [...state.conflictingPrs].find((candidate) => repository.result(candidate).pr === result.pr);
				return id === undefined
					? Effect.succeed(repository.delivery(result))
					: Effect.fail(conflictingPr(repository.git("rev-parse", "origin/main")));
			}),
	};
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
