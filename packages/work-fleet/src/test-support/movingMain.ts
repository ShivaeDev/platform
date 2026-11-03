import { host } from "#test/hostStory.ts";

export const movingMain = host.trait("configuration", "main can move between admission and launch", (engine) => {
	engine.main = { observedAt: 1, revision: "main-0" };
});
