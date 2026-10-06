import { storyKit } from "#storyKit.ts";

export interface Mill {
	sacks: number;
	sails: "furled" | "turning";
	wind: number;
}

export const mill = storyKit({
	create: (): Mill => ({ sacks: 0, sails: "furled", wind: 0 }),
	inspect: ({ sacks, sails }) => ({ sacks, sails }),
	name: "mill",
	stages: ["yard"],
	verbs: (state, story) => ({
		miller: {
			grinds: (sacks: number) => {
				story.tell(`the miller grinds ${sacks} sacks`);
				state.sacks += sacks;
			},
			waitsForWind: () => story.runUntil((current) => current.wind > 0),
		},
	}),
});

export function sailsAreTurning() {
	return mill.trait("yard", "the sails are turning", (state) => {
		state.sails = "turning";
	});
}
