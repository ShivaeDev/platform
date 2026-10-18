import type { DecisionCode } from "#DecisionCode.ts";
import { CHANGED_BRIEF_REASON } from "#engine/boardBrief.ts";
import { blocked, type Choice, RELEASE, type Situation } from "#engine/situations/choices.ts";
import { serviceSituations } from "#engine/situations/service.ts";
import { stopSituations } from "#engine/situations/stop.ts";
import { workSituations } from "#engine/situations/work.ts";
import type { Decision } from "#policy.ts";

export interface DecisionCopy {
	readonly question?: {
		readonly title: string;
		readonly retry?: Choice;
		readonly release: Choice;
	};
	readonly reason: string;
	readonly recommendation: string;
}

const situations: Readonly<Record<DecisionCode, Situation>> = { ...serviceSituations, ...stopSituations, ...workSituations };

const changedBrief: Situation = {
	happened: "The task was edited on the Board while this work was waiting.",
	question: "Continue with the edited task?",
	recommendation: "Fleet needs to know whether the edited task still fits the work done so far. If it does, continue. Otherwise stop here.",
	retry: {
		label: "Continue on the updated task",
		outcome: "Fleet accepts the edited task and continues the same work with it, on the same branch and PR.",
	},
};

const uncoded = blocked("Fleet stopped and needs your decision.", "Check the details, then let Fleet try again, or stop here.");

const WORKER =
	"The worker needs your answer to keep going. Write it on this card. Fleet passes it to the same worker, which continues where it stopped.";

export function decisionCopy(decision: Pick<Decision, "code" | "publicationWork" | "reason" | "worker">): DecisionCopy {
	if (decision.worker !== undefined) {
		return { reason: decision.reason, recommendation: WORKER };
	}
	const situation = situationOf(decision);
	const detailed = situation.details === true && decision.reason.trim() !== "" && decision.reason !== decision.code;
	return {
		question: {
			release: situation.release ?? RELEASE,
			title: situation.question ?? "What should Fleet do next?",
			...(situation.retry === undefined ? {} : { retry: situation.retry }),
		},
		reason: detailed ? `${situation.happened}\n\nDetails: ${decision.reason}` : situation.happened,
		recommendation: situation.recommendation,
	};
}

export function releaseOnly(code: DecisionCode | undefined) {
	const situation = code === undefined ? undefined : situations[code];
	return situation?.retry === undefined ? situation?.recommendation : undefined;
}

function situationOf(decision: Pick<Decision, "code" | "publicationWork" | "reason">) {
	if (decision.code === "reviewed-pr-ready" && decision.reason === "Reviewed sweep PR is ready to merge") {
		return { ...situations[decision.code], happened: "The sweep PR passed review and all required checks. It is ready to merge before held PRs." };
	}
	if (decision.code === "fleet-stale" && decision.reason === CHANGED_BRIEF_REASON && decision.publicationWork !== undefined) {
		return changedBrief;
	}
	return decision.code === undefined ? uncoded : situations[decision.code];
}
