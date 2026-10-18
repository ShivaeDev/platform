import { Effect } from "effect";
import { SessionFailure } from "#session/schema.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import type { EngineStory } from "#test/engineState.ts";
import { engine } from "#test/engineStory.ts";
import { lostTurnProvider } from "#test/lostTurnProvider.ts";
import { workPublication } from "#test/workPublication.ts";

function publication(state: EngineStory) {
	if (state.publication === undefined) {
		throw new Error("Published work needs the lost-turn provider trait first");
	}
	return state.publication;
}

export function workerTurnsCanBeLost() {
	return engineConfiguration("the provider can lose accepted worker turns while GitHub publication stays readable", (state) => {
		const provider = lostTurnProvider();
		const published = workPublication();
		state.lostTurns = provider;
		state.publication = published;
		return {
			decorateTransport: provider.decorate,
			publicationQuery: published.query,
			refreshQuota: () => Effect.sync(() => ({ available: state.providerQuota, expiresAt: Number.MAX_SAFE_INTEGER, observedAt: 0 })),
			submissionFailure: (call) => {
				if (state.rejectNextSubmission !== call) {
					return undefined;
				}
				state.rejectNextSubmission = undefined;
				return new SessionFailure({ capacity: "serverOverloaded", message: "Replacement capacity unavailable", reason: "rejected" });
			},
		};
	});
}

export function lostAcknowledgement() {
	return engineConfiguration("the accepted turn acknowledgement is lost", () => ({ lostAcknowledgement: true }));
}

export function publishedWork(kind: "none" | "branch" | "pr") {
	return engine.trait("configuration", `published work is ${kind}`, (state) => {
		if (kind === "pr") {
			publication(state).pullRequest();
		} else if (kind === "branch") {
			publication(state).branch();
		} else {
			publication(state).neighbour();
		}
	});
}

export function unreadablePublication(kind: "branch" | "pr") {
	return engine.trait("configuration", `the ${kind} publication read is unavailable`, (state) => {
		if (kind === "branch") {
			publication(state).unavailable();
		} else {
			publication(state).pullsUnavailable();
		}
	});
}
