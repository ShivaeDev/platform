import type { DecisionCode } from "#DecisionCode.ts";
import { blocked, FRESH_WORKER, RUN_AGAIN, type Situation, TRY_AGAIN } from "#engine/situations/choices.ts";

export const serviceSituations = {
	"board-failure": blocked(
		"Fleet could not read or update the Board.",
		"Fleet needs the Board files readable again. Fix the cause in the details, then let Fleet try again.",
	),
	"fleet-denied": blocked(
		"Fleet is not allowed to take the next step.",
		"Fleet needs the blocker in the details resolved. Then let Fleet try again, or stop here.",
	),
	"fleet-integration": blocked(
		"A service Fleet depends on is unavailable or not set up.",
		"Fleet needs that service working. Fix it, then let Fleet try again, or stop here.",
	),
	"fleet-invalid": blocked("Fleet received data it cannot use.", "Fix the problem in the details, then let Fleet try again, or stop here."),
	"fleet-missing": blocked(
		"Fleet could not find something this work needs.",
		"Restore what the details name, then let Fleet try again, or stop here.",
	),
	"fleet-stale": blocked(
		"Something changed while Fleet was working on this task.",
		"Fleet recommends trying again from the current state. Stop here if the task should not go on.",
	),
	"integration-failure": blocked(
		"Fleet hit an unexpected error.",
		"Check the details. If the cause is fixed, let Fleet try again. Otherwise stop here.",
	),
	"provider-quota-unavailable": {
		happened: "The worker service has no usage quota left for Fleet.",
		recommendation: "Fleet needs fresh quota to start workers. Try again once quota is available.",
		retry: { label: "Try again", outcome: "Fleet checks the quota again and starts the work once quota is available." },
	},
	"session-active-turn": {
		happened: "The worker was still busy with an earlier step, so Fleet could not send the next one.",
		recommendation: "Fleet recommends trying again once the worker is free.",
		retry: { label: "Try again", outcome: "Fleet sends the step to the same worker again." },
	},
	"session-active-turn-exhausted": {
		happened: "The worker stayed busy with an earlier step through several attempts.",
		recommendation: "Fleet recommends starting over with a fresh worker.",
		retry: FRESH_WORKER,
	},
	"session-ambiguous": {
		details: true,
		happened: "Fleet lost contact with the worker service and cannot tell whether the last step started.",
		recommendation: "Fleet recommends trying again once the worker service is reachable. Fleet checks what already ran before it sends anything.",
		retry: { label: "Try again", outcome: "Fleet checks what the worker already did and continues from there." },
	},
	"session-persistence": blocked(
		"Fleet could not save the state of the worker's run.",
		"Fleet needs its database working. Fix the cause in the details, then let Fleet try again.",
	),
	"session-protocol": blocked(
		"The worker service sent an answer Fleet does not understand.",
		"Check the details. Let Fleet try again once the cause is fixed, or stop here.",
	),
	"session-queue-full": {
		happened: "The worker service is too busy to accept new work.",
		recommendation: "Fleet recommends trying again later.",
		retry: TRY_AGAIN,
	},
	"session-rejected": blocked(
		"The worker service rejected Fleet's request.",
		"Check the details. Let Fleet try again once the cause is fixed, or stop here.",
	),
	"session-stalled": {
		happened: "The worker has shown no activity for a while. Fleet has not interrupted it.",
		recommendation: "Keep waiting if the worker may still be busy, or start over with a fresh worker.",
		retry: FRESH_WORKER,
		wait: { label: "Keep waiting", outcome: "Fleet keeps the same worker running and starts a new silence interval." },
	},
	"session-turn-missing": {
		happened: "The worker's run can no longer be found, even after Fleet resumed it once.",
		recommendation: "Fleet recommends running the step again.",
		retry: RUN_AGAIN,
	},
	"session-unavailable": blocked(
		"Fleet could not reach the worker service.",
		"Fleet needs the worker service reachable. Let Fleet try again once it is back, or stop here.",
	),
} satisfies Partial<Record<DecisionCode, Situation>>;
