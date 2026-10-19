import { host } from "#test/hostStory.ts";

export function pullRequestWithPendingChecks() {
	return host.trait("observation", "GitHub holds the delivered PR's checks pending", (engine) => {
		if (engine.pullRequest === undefined) {
			throw new Error("Configure human delivery before holding checks pending");
		}
		engine.pullRequest.state.pending = true;
	});
}
