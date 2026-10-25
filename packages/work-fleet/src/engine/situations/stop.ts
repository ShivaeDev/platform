import type { DecisionCode } from "#DecisionCode.ts";
import { type Situation, stopOnly } from "#engine/situations/choices.ts";

export const stopSituations = {
	"checks-result-invalid": stopOnly(
		"Fleet could not read check results because this work has no valid PR or commit.",
		"Trying again cannot fix this. Stop here so the task can be prepared again with a valid PR.",
	),
	"delivery-pr-required": stopOnly(
		"Fleet has no valid GitHub PR for this work.",
		"Trying again cannot fix this. Stop here, check who owns the branch, and prepare the task again.",
	),
	"duplicate-turns": stopOnly(
		"The worker service shows several runs for the same step, so Fleet cannot tell which result is right.",
		"Fleet cannot pick a result itself. Stop here once every one of those runs has finished.",
	),
	"foreign-pr": stopOnly(
		"The reported PR belongs to another repository.",
		"Fleet cannot move a PR between repositories. Stop here so the task can be prepared again in the right repository.",
	),
	"incomplete-context": {
		details: true,
		happened: "The task needs information the worker cannot reach.",
		recommendation:
			"Trying again cannot fill in the missing information. Stop here, change the task to use data from the repository, and prepare it again.",
	},
	"incomplete-observation": {
		details: true,
		happened: "Fleet could not get a complete view of the Board or the repository.",
		recommendation: "Fleet cannot continue from an incomplete view. Stop here so the task can be prepared again.",
	},
	"no-change-checks-unconfigured": stopOnly(
		"The worker changed nothing, and this Fleet setup cannot check a result without changes.",
		"Trying again cannot verify this result here. Stop here so the task can run where such results can be checked.",
	),
	"not-ancestor": stopOnly(
		"The main branch no longer contains the commit this work was prepared on.",
		"Fleet cannot move the work onto the new history. Stop here so the task can be prepared again on the current main branch.",
	),
	"relevant-change": stopOnly(
		"Files this work depends on changed on the main branch after it was prepared.",
		"Fleet cannot refresh the preparation itself. Stop here so the task can be prepared again on the current main branch.",
	),
	"report-published": stopOnly(
		"The report worker published to GitHub, which a report task must not do.",
		"Fleet cannot undo the publication. Stop here and check what was published.",
	),
	"report-revision": stopOnly(
		"Fleet could not verify that the report researched the dispatched main revision or a descendant.",
		"Stop here so the report can be prepared again on current main. Do not use the unverified findings as evidence.",
	),
	"report-too-large": stopOnly(
		"The worker's report is too large for the Board.",
		"Fleet cannot shorten a finished report. Stop here so a worker can write a shorter report.",
	),
	"result-identity-changed": stopOnly(
		"The PR or branch for this work was replaced during review.",
		"Fleet cannot take over a different result. Stop here and check the replacement before preparing the task again.",
	),
	"worker-receipt-missing": stopOnly(
		"Fleet lost the record of which worker run produced this result.",
		"Fleet cannot prove who owns this result. Stop here and check the branch before preparing the task again.",
	),
} satisfies Partial<Record<DecisionCode, Situation>>;
