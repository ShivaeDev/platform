import { running } from "#test/engineState.ts";
import { engine } from "#test/engineStory.ts";
import { githubPullRequest } from "#test/engineTraits.ts";

export const sharedArea = engine.trait("work", "approved work shares an area in preparation order", (state) => {
	const { fixture } = running(state);
	for (const id of ["one", "two", "three"]) {
		fixture.approveWork(id, `board-${id}`);
		fixture.areas(id, ["shared"]);
	}
	fixture.approveWork("dependency", "board-dependency");
});

export const highPrioritySecond = engine.trait("work", "the second item has high dispatch priority", (state) => {
	running(state).fixture.priority("two", "high");
});

export const githubBacklog = githubPullRequest();

export const singlePrBacklog = engine.trait("configuration", "the delivery backlog only admits one PR at a time", (state) => {
	state.options = { ...state.options, backlog: 1 };
});

export const immediateAreaRelease = engine.trait("configuration", "reviewed PRs release their areas without a merge wait", (state) => {
	state.options = { ...state.options, areaMergeWaitMs: 0 };
});
