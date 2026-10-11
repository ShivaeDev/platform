const explanations: Readonly<Record<string, string>> = {
	"Delivery requires the adopted GitHub PR URL":
		"Retry cannot replace an adopted PR identity; release and inspect ownership before preparing a valid GitHub result.",
	"GitHub checks need a GitHub pull request URL and an exact commit SHA":
		"Retry cannot validate a malformed adopted result; release and prepare with a valid PR identity and commit SHA.",
	"incomplete-context": "Retry cannot reconstruct missing preparation context; release and prepare with complete context.",
	"incomplete-observation": "Retry cannot establish preparation compatibility; release and prepare with a complete main observation.",
	"Multiple Codex turns match one operation; retain reservation":
		"Retry cannot select one result from duplicate accepted turns; release only after every matching turn is confirmed terminal.",
	"No-change validation is not configured in this Fleet host; inspect the worker session":
		"Retry cannot validate a no-change result in this host; release and prepare work in a runtime with configured no-change checks.",
	"not-ancestor": "Retry cannot rebase preparation onto unrelated main history; release and prepare against current main.",
	"Report worker published to GitHub":
		"Retry cannot undo GitHub publication because closed pull requests remain publication evidence; release this report cycle and inspect the published work.",
	"Reported PR must belong to the host repository":
		"Retry cannot move a PR into the configured repository; release this cycle and prepare work with the correct repository ownership.",
	"Result identity changed during review":
		"Retry cannot transfer ownership to a different result; release and inspect the replacement before preparing again.",
	"Review lacks the adopted worker receipt":
		"Retry cannot establish adopted worker ownership from the saved evidence; release and inspect ownership before preparing again.",
	"Reviewed PR is ready to merge": "Retry cannot merge a PR; a human must merge the reviewed head, or release Fleet ownership.",
	"relevant-change": "Retry cannot refresh affected preparation context; release and prepare against current main.",
	"Worker report exceeds Board’s 256 KiB context limit, including metadata and receipt; request a shorter report before retrying.":
		"Retry cannot shorten the immutable completed report; release and prepare a worker to produce a shorter report.",
};

export function releaseOnly(reason: string) {
	return Object.hasOwn(explanations, reason) ? explanations[reason] : undefined;
}
