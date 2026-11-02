interface MergeGroupCheck {
	readonly conclusion: string | null;
	readonly name: string;
	readonly url: string;
}

export function mergeQueueChecks() {
	const checks = new Map<string, MergeGroupCheck>();
	return {
		record: (commit: string, check: MergeGroupCheck) => checks.set(commit, check),
		runs: (head: string) => {
			const check = checks.get(head);
			return check === undefined
				? []
				: [
						{
							conclusion: check.conclusion,
							"details_url": check.url,
							"head_sha": head,
							"html_url": check.url,
							name: check.name,
							status: check.conclusion === null ? "in_progress" : "completed",
						},
					];
		},
	};
}
