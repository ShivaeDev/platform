import { storyKit } from "#storyKit.ts";

export const unattendedMill = storyKit({
	create: () => ({ wind: 0 }),
	name: "mill",
	run: {
		maxSteps: 2,
		step: (state, tell) => {
			state.wind += 1;
			tell(`the wind reaches ${state.wind}`);
		},
	},
	stages: ["yard"],
	verbs: (_state, story) => ({
		miller: { waitsForWind: (wind: number) => story.runUntil((current) => current.wind >= wind) },
	}),
});
