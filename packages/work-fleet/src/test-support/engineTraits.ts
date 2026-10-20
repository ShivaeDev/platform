import { Effect } from "effect";
import type { EngineOptions } from "#test/EngineOptions.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import { engine } from "#test/engineStory.ts";
import { mergedReviewGithub } from "#test/mergedReviewGithub.ts";

export function reviewRequestsRepairs(enabled = true) {
	return engineConfiguration("independent review requests a repair", () => ({ repairs: enabled }));
}

export function humanMergeRequired(enabled = true) {
	return engineConfiguration("delivery waits for a human merge", () => ({ denyDelivery: enabled }));
}

export function noChangeReported(enabled = true) {
	return engineConfiguration("the worker reports no change", () => ({ noChange: enabled }));
}

export function reviewerStillRunning(enabled = true) {
	return engineConfiguration("the reviewer keeps its turn running", () => ({ reviewRunning: enabled }));
}

export function reviewerSharesWorker() {
	return engineConfiguration("the provider reuses the worker's conversation for review", () => ({ sameReviewer: true }));
}

export function reviewAcknowledgementLost() {
	return engineConfiguration("the provider loses the review acknowledgement", () => ({ lostReviewAcknowledgement: true }));
}

export function reviewEnds(reviewExecution: EngineOptions["reviewExecution"] & string) {
	return engineConfiguration(`the reviewer turn ends ${reviewExecution}`, () => ({ reviewExecution }));
}

export function evidenceHasWrongHead(wrongHead: EngineOptions["wrongHead"] & string) {
	return engineConfiguration(`${wrongHead} evidence names the wrong head`, () => ({ wrongHead }));
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

export function providerReusesOperationIdentity() {
	return engineConfiguration("the provider reuses an operation identity across work", () => ({ operationCollision: true }));
}

export function requiredChecksFailOnce() {
	return engineConfiguration("required checks fail once before a human retry", () => ({ checksFailure: true }));
}

export function independentReviewFailsOnce() {
	return engineConfiguration("independent review fails once before a human retry", () => ({ reviewFailure: true }));
}

export function reviewerUsesHostSettings(launch: NonNullable<EngineOptions["launch"]>) {
	return engineConfiguration("the reviewer uses the host launch settings and database-check guidance", () => ({
		launch,
		reviewerGuidance: "Inspect synthetic database checks.",
	}));
}

export function reviewFollowUpAcknowledgementLost() {
	return engineConfiguration("the provider loses the review follow-up acknowledgement", () => ({ lostReviewContinuationAcknowledgement: true }));
}

export function advisoryReviews() {
	return engineConfiguration("reviews are advisory", () => ({ review: "advisory" }));
}
