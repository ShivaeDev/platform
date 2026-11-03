import { engine } from "#test/engineStory.ts";

export const ciPathsObserved = engine.trait("configuration", "Fleet observes CI paths through GitHub HTTP", (state) => {
	if (state.github === undefined) {
		throw new Error("CI path observation requires a GitHub pull request");
	}
	state.options = { ...state.options, ciHold: state.github.observeCiPaths };
});
