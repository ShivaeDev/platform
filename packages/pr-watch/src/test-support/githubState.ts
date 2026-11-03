import type { Check, CommitStatus, Pull, Reply } from "./githubModel.ts";

export function makeGitHubState() {
	const pulls = new Map<number, Pull>();
	const open = new Set<number>();
	const queueRefs = new Set<number>();
	const queueEntries = new Set<number>();
	const dequeueReasons = new Map<number, string>();
	const statuses = new Map<string, CommitStatus>();
	const checks = new Map<string, readonly Check[]>();
	const checkRequired = new Map<string, boolean>();
	const requiredFlagsPaged = new Set<string>();
	const overrides = new Map<string, Reply>();
	const extraHeaders = new Map<string, Record<string, string>>();

	function pullOf(number: number) {
		const pull = pulls.get(number);
		if (pull === undefined) {
			throw new Error(`Open PR ${number} on GitHub before changing it`);
		}
		return pull;
	}

	function checkRuns(prefix: string, runs: readonly Check[]) {
		return {
			"check_runs": runs.map(({ required = true, ...run }, index) => {
				const id = `${prefix}-${index}`;
				checkRequired.set(id, required);
				return { ...run, "node_id": id };
			}),
		};
	}

	return {
		checkRequired,
		checkRuns,
		checks,
		dequeueReasons,
		extraHeaders,
		open,
		overrides,
		pullOf,
		pulls,
		queueEntries,
		queueRefs,
		requiredFlagsPaged,
		statuses,
	};
}

export type GitHubState = ReturnType<typeof makeGitHubState>;
