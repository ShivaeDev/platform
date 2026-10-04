import { Effect } from "effect";
import type { PullRequest, Work } from "./domain.ts";
import type { StoreService } from "./Store.ts";
import { putWork, question } from "./state.ts";
export function reviewed(work: Work) {
	return work.review?.verdict === "approve" && work.review.revision === work.outcome?.revision;
}
export function saveDelivery(store: StoreService, work: Work) {
	return store.update((state) => Effect.succeed(putWork(state, work))).pipe(Effect.asVoid);
}
export function requiredChecks(work: Work, observed: PullRequest) {
	return work.spec.requiredChecks.flatMap((name) => {
		const matches = observed.checks.filter((check) => check.name === name);
		return matches.length > 0 ? matches : [{ name, status: "pending" as const }];
	});
}
export function observedTransition(work: Work, observed: PullRequest, headChanged: boolean, baseChanged: boolean): Work | null {
	if (observed.state === "merged") {
		return mergedTransition(work, observed);
	}
	if (headChanged || baseChanged) {
		return {
			...work,
			feedback: baseChanged
				? "The base advanced. Integrate it, validate the scoped change, and update the pull request."
				: "Review the new pull request head.",
			merge: "none",
			phase: baseChanged ? "repair" : "reviewing",
			question: null,
			review: null,
			validation: null,
		};
	}
	if (observed.state === "closed") {
		return question({ ...work, phase: "held" }, "Should the closed pull request be reopened?", "Inspect why the change host closed this outcome.");
	}
	if (observed.mergeable === "conflict" || requiredChecks(work, observed).some((check) => check.status === "failed")) {
		return {
			...work,
			feedback: "Repair merge conflicts or failing required checks, validate, and update the original pull request.",
			phase: "repair",
			question: null,
			review: null,
			validation: null,
		};
	}
	return null;
}
function mergedTransition(work: Work, observed: PullRequest): Work {
	const valid =
		reviewed(work) && work.validation?.revision === observed.revision && requiredChecks(work, observed).every((check) => check.status === "passed");
	if (valid) {
		return { ...work, phase: "completed", question: null };
	}
	return question(
		{ ...work, phase: "held" },
		"Was this merged revision validated before delivery?",
		"The merge is observed, but durable scope/check validation and independent review are required for this exact revision.",
	);
}
