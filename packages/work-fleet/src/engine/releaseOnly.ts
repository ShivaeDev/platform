import type { DecisionCode } from "#DecisionCode.ts";

const explanations: Readonly<Partial<Record<DecisionCode, string>>> = {
	"checks-result-invalid": "Retry cannot validate a malformed adopted result; release and prepare with a valid PR identity and commit SHA.",
	"delivery-pr-required": "Retry cannot replace an adopted PR identity; release and inspect ownership before preparing a valid GitHub result.",
	"duplicate-turns": "Retry cannot select one result from duplicate accepted turns; release only after every matching turn is confirmed terminal.",
	"foreign-pr": "Retry cannot move a PR into the configured repository; release this cycle and prepare work with the correct repository ownership.",
	"incomplete-context": "Retry cannot reconstruct missing preparation context; release and prepare with complete context.",
	"incomplete-observation": "Retry cannot establish preparation compatibility; release and prepare with a complete main observation.",
	"no-change-checks-unconfigured":
		"Retry cannot validate a no-change result in this host; release and prepare work in a runtime with configured no-change checks.",
	"not-ancestor": "Retry cannot rebase preparation onto unrelated main history; release and prepare against current main.",
	"relevant-change": "Retry cannot refresh affected preparation context; release and prepare against current main.",
	"report-published":
		"Retry cannot undo GitHub publication because closed pull requests remain publication evidence; release this report cycle and inspect the published work.",
	"report-too-large": "Retry cannot shorten the immutable completed report; release and prepare a worker to produce a shorter report.",
	"result-identity-changed": "Retry cannot transfer ownership to a different result; release and inspect the replacement before preparing again.",
	"worker-receipt-missing":
		"Retry cannot establish adopted worker ownership from the saved evidence; release and inspect ownership before preparing again.",
};

export function releaseOnly(code: DecisionCode | undefined) {
	return code === undefined ? undefined : explanations[code];
}
