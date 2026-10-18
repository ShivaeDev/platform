import type { DecisionCode } from "#DecisionCode.ts";
import { CORRECT_REPORT, RUN_AGAIN, type Situation } from "#engine/situations/choices.ts";

export const workSituations = {
	"approval-required": {
		happened: "The task is no longer approved on the Board.",
		recommendation: "Fleet only works on approved tasks. If the task is still needed, approve it on the Board and continue. Otherwise stop here.",
		retry: { label: "Continue after approval", outcome: "Fleet checks that the task is approved and continues the same work." },
	},
	"checks-repair-exhausted": {
		details: true,
		happened: "Required checks still fail after three repair attempts.",
		recommendation:
			"Fleet will not repair these checks again on its own. Look at the failing checks on the PR. If you fixed the cause, let Fleet check again. Otherwise stop here.",
		retry: { label: "Check again", outcome: "Fleet reviews the PR and its checks again. If the same checks still fail, Fleet asks you again." },
	},
	"delivery-head-mismatch": {
		happened: "The PR changed after Fleet reviewed it.",
		recommendation: "Fleet must review the current PR before it can be merged. Fleet recommends reviewing it again.",
		retry: { label: "Review again", outcome: "Fleet reviews the PR at its current commit and checks it again." },
	},
	"empty-report": {
		happened: "The report worker returned an empty report.",
		recommendation: "Fleet recommends running the report worker again.",
		retry: { label: "Write the report again", outcome: "Fleet starts the report worker again." },
	},
	"pr-closed": {
		happened: "The PR was closed without merging.",
		recommendation: "Check why the PR was closed. If that was a mistake, reopen it on GitHub and let Fleet check again. Otherwise stop here.",
		retry: { label: "Check the PR again", outcome: "Fleet checks the PR again and continues the same work if it is open." },
	},
	"pr-conflicting": {
		happened: "The PR has merge conflicts with the main branch.",
		question: "How should Fleet handle the conflicts?",
		recommendation: "Fleet recommends letting the worker resolve the conflicts. Add notes for the worker in your answer if needed.",
		retry: {
			label: "Resolve the conflicts",
			outcome: "The worker merges main into the same branch, resolves the conflicts and updates the same PR. Your notes go along.",
		},
	},
	"pr-head-moved": {
		happened: "New commits reached the PR after Fleet reviewed it.",
		recommendation: "Fleet must review the new commits before the PR can be merged. Fleet recommends reviewing again.",
		retry: { label: "Review the new commits", outcome: "Fleet reviews the PR again at its latest commit." },
	},
	"reviewed-pr-ready": {
		happened: "The PR passed review and all required checks. It is ready to merge.",
		question: "Do you want changes before merging?",
		recommendation:
			"Merge the PR on GitHub when you are happy with it. Fleet notices the merge and finishes the task. Answer here only to request changes or to stop.",
		release: { label: "Stop and hand back", outcome: "Fleet stops watching this PR and hands the task back to you. The PR stays open." },
		retry: {
			label: "Request changes",
			outcome: "Write the changes in your answer. The worker makes them on the same branch and PR, then Fleet reviews and checks the PR again.",
		},
	},
	"reviewer-terminal": {
		happened: "The review stopped before it finished.",
		recommendation: "Fleet recommends running the review again.",
		retry: { label: "Review again", outcome: "Fleet starts a new review of the same PR." },
	},
	"worker-question": {
		details: true,
		happened: "The worker asked a question.",
		recommendation: "Fleet recommends running the step again.",
		retry: RUN_AGAIN,
	},
	"worker-report-head-invalid": {
		happened: "The worker's final report does not name the exact commit it pushed.",
		recommendation: "Fleet recommends asking the worker to fix its report.",
		retry: CORRECT_REPORT,
	},
	"worker-report-head-moved": {
		happened: "The PR changed after the worker reported its final commit.",
		recommendation: "Fleet recommends asking the worker to report the PR's current commit.",
		retry: CORRECT_REPORT,
	},
	"worker-report-merged-head-mismatch": {
		happened: "The PR was merged at a different commit than the worker reported.",
		recommendation: "Check what was merged on GitHub. Then ask the worker to correct its report, or stop here.",
		retry: CORRECT_REPORT,
	},
	"worker-report-pr-invalid": {
		happened: "The worker's final report does not contain a valid PR link.",
		recommendation: "Fleet recommends asking the worker to fix its report.",
		retry: CORRECT_REPORT,
	},
	"worker-terminal": {
		details: true,
		happened: "The worker's run stopped before it finished.",
		recommendation: "Fleet recommends running the step again.",
		retry: RUN_AGAIN,
	},
} satisfies Partial<Record<DecisionCode, Situation>>;
