import { recoveryFleet } from "#test/recoveryFleet.ts";

export const runningReview = recoveryFleet.trait("configuration", "the reviewer stays active until the provider completes it", (state) => {
	state.options = { ...state.options, reviewRunning: true };
});

export const requestedRepair = recoveryFleet.trait("configuration", "the first independent review requests a repair", (state) => {
	state.options = { ...state.options, repairs: true };
});

export function lostAcknowledgement() {
	return recoveryFleet.trait("configuration", "the accepted turn acknowledgement is lost", (state) => {
		state.options = { ...state.options, lostAcknowledgement: true };
	});
}

export function publishedWork(kind: "none" | "branch" | "pr") {
	return recoveryFleet.trait("configuration", `published work is ${kind}`, (state) => {
		if (kind === "pr") {
			state.publication.pullRequest();
		} else if (kind === "branch") {
			state.publication.branch();
		} else {
			state.publication.neighbour();
		}
	});
}

export function unreadablePublication(kind: "branch" | "pr") {
	return recoveryFleet.trait("configuration", `the ${kind} publication read is unavailable`, (state) => {
		if (kind === "branch") {
			state.publication.unavailable();
		} else {
			state.publication.pullsUnavailable();
		}
	});
}
