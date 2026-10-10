import { storyKit } from "#storyKit.ts";

export const brokenHookMill = storyKit({
	after: {
		yard: () => {
			throw new Error("the yard is unavailable");
		},
	},
	create: () => ({ sacks: 0 }),
	name: "mill",
	stages: ["yard"],
	verbs: () => ({}),
});
