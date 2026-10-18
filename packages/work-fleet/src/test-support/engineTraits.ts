import { Effect } from "effect";
import type { EngineOptions } from "#test/EngineOptions.ts";
import { engine } from "#test/engineStory.ts";
import { mergedReviewGithub } from "#test/mergedReviewGithub.ts";

const descriptions: Readonly<Record<string, string>> = {
	denyDelivery: "delivery waits for a human merge",
	lostReviewAcknowledgement: "the provider loses the review acknowledgement",
	noChange: "the worker reports no change",
	repairs: "independent review requests a repair",
	reviewRunning: "the reviewer keeps its turn running",
	sameReviewer: "the provider reuses the worker's conversation for review",
	writeFailure: "PostgreSQL rejects the supplied writes",
	writeGate: "PostgreSQL writes wait at the supplied gate",
};

export function configured(options: EngineOptions) {
	return engine.traits(
		...Object.entries(options).map(([key, value]) =>
			engine.trait("configuration", descriptions[key] ?? `Fleet uses ${key}`, (state) => {
				state.options = { ...state.options, [key]: value };
			}),
		),
	);
}

export function reviewRequestsRepairs(enabled = true) {
	return configured({ repairs: enabled });
}

export function humanMergeRequired(enabled = true) {
	return configured({ denyDelivery: enabled });
}

export function noChangeReported(enabled = true) {
	return configured({ noChange: enabled });
}

export function reviewerStillRunning(enabled = true) {
	return configured({ reviewRunning: enabled });
}

export function reviewerSharesWorker() {
	return configured({ sameReviewer: true });
}

export function reviewAcknowledgementLost() {
	return configured({ lostReviewAcknowledgement: true });
}

export function reviewEnds(reviewExecution: EngineOptions["reviewExecution"] & string) {
	return configured({ reviewExecution });
}

export function evidenceHasWrongHead(wrongHead: EngineOptions["wrongHead"] & string) {
	return configured({ wrongHead });
}

export function markdownWork() {
	return engine.trait("configuration", "work lives in the Markdown Board", (state) => {
		state.markdown = true;
	});
}

export function githubPullRequest(initial: Partial<Effect.Success<ReturnType<typeof mergedReviewGithub>>["state"]> = {}) {
	return engine.trait("integrations", "a pull request is observed through the loopback GitHub provider", function* (state) {
		const github = yield* mergedReviewGithub();
		Object.assign(github.state, initial);
		state.github = github;
		state.options = { ...state.options, ...github };
	});
}

export function checksWithoutRepair() {
	return engine.trait("configuration", "failed GitHub checks wait for a decision", (state) => {
		const checks = state.github?.checksQuery;
		if (checks === undefined) {
			throw new Error("Checks need the GitHub pull request trait");
		}
		state.options = {
			...state.options,
			checksQuery: (result) => checks(result).pipe(Effect.map((value) => ({ ...value, repairPrompt: undefined }))),
		};
	});
}
