import { requireCapability } from "#test/engineCapabilities.ts";
import type { EngineStory } from "#test/engineState.ts";
import type { githubFixture } from "#test/githubChecks.ts";

function observation(state: EngineStory) {
	if (typeof state.pullObservation !== "object" || state.pullObservation === null) {
		throw new Error("No scripted pull request is configured");
	}
	return state.pullObservation;
}

function mergeObservation(state: EngineStory, head: string | undefined, revision: string, base: string | undefined) {
	state.pullObservation = {
		...observation(state),
		...(head === undefined ? {} : { headRefOid: head }),
		...(base === undefined ? {} : { baseRefOid: base }),
		mergeCommit: { oid: revision },
		mergedAt: "2026-01-01T00:00:00Z",
		state: "MERGED",
	};
}

export function engineGithubVerbs(state: EngineStory, tell: (line: string) => void) {
	function change(line: string, action: () => void) {
		action();
		tell(line);
	}
	return {
		changePullRequestBase: (base: string) =>
			change(`the pull request base moves to ${base}`, () => {
				if (state.github === undefined) {
					state.pullObservation = { ...observation(state), baseRefOid: base };
				} else {
					state.github.state.base = base;
				}
			}),
		changePullRequestPaths: (paths: string[]) =>
			change("the pull request changes its affected paths", () => {
				if (state.github === undefined) {
					throw new Error("No loopback GitHub provider is configured");
				}
				state.github.state.paths = paths;
			}),
		checkedHeads: () => [...state.checkedHeads],
		checksRemainPending: (pending: boolean) =>
			change(`GitHub checks are ${pending ? "pending" : "terminal"}`, () => {
				if (state.github === undefined) {
					throw new Error("No loopback GitHub provider is configured");
				}
				state.github.state.pending = pending;
			}),
		checksRespond: (...args: Parameters<ReturnType<typeof githubFixture>["reply"]>) =>
			change(`GitHub returns check evidence for ${args[0]}`, () => {
				if (state.checks === undefined) {
					throw new Error("No scripted GitHub checks are configured");
				}
				state.checks.reply(...args);
			}),
		closePullRequest: () =>
			change("the pull request closes without merging", () => {
				requireCapability(state, "closePullRequest", state.github !== undefined || state.pullObservation !== undefined);
				state.deliveryChanged = true;
				if (state.github !== undefined) {
					state.github.state.status = "CLOSED";
				} else if (state.pullObservation !== undefined) {
					state.pullObservation = { ...observation(state), state: "CLOSED" };
				}
			}),
		conflictPullRequest: () =>
			change("the pull request conflicts with main", () => {
				requireCapability(state, "conflictPullRequest", state.github !== undefined);
				state.conflicting = true;
				if (state.github !== undefined) {
					state.github.state.mergeable = "CONFLICTING";
				}
			}),
		currentPullRequestHead: () => state.github?.state.head ?? state.resultHead,
		githubBecomesUnavailable: () =>
			change("GitHub reads become unavailable", () => {
				requireCapability(state, "githubAvailability");
				state.githubUnavailable = true;
			}),
		githubRecovers: () =>
			change("GitHub reads recover", () => {
				requireCapability(state, "githubAvailability");
				state.githubUnavailable = false;
			}),
		githubRequests: () => [...(state.github?.requests ?? state.checks?.requests ?? state.adoption?.requests ?? [])],
		legacyResultRefresh: (enabled: boolean) =>
			change(`legacy result refresh is ${enabled ? "enabled" : "disabled"}`, () => {
				if (state.github === undefined) {
					throw new Error("No loopback GitHub provider is configured");
				}
				state.github.state.legacyResult = enabled;
			}),
		mergePullRequest: (head?: string, revision = "merged-revision", base?: string) =>
			change("a human merges the pull request", () => {
				requireCapability(state, "mergePullRequest", state.github !== undefined || state.pullObservation !== undefined);
				state.deliveryMerged = true;
				if (state.github !== undefined) {
					state.github.state.status = "MERGED";
					if (head !== undefined) {
						state.github.state.head = head;
					}
				} else if (state.pullObservation !== undefined) {
					mergeObservation(state, head, revision, base);
				}
			}),
		movePullRequestHead: (head: string) =>
			change(`the pull request moves to ${head}`, () => {
				requireCapability(state, "movePullRequestHead", state.github !== undefined || state.pullObservation !== undefined);
				state.resultHead = head;
				state.deliveryChanged = true;
				if (state.github !== undefined) {
					state.github.state.head = head;
				}
				if (state.pullObservation !== undefined) {
					state.pullObservation = { ...observation(state), headRefOid: head };
				}
			}),
		reopenPullRequest: () =>
			change("the pull request is open again", () => {
				state.pullObservation = { ...observation(state), mergeCommit: null, mergedAt: null, state: "OPEN" };
			}),
		restoreDeliveryEvidence: () =>
			change("valid delivery evidence is available again", () => {
				requireCapability(state, "restoreDeliveryEvidence");
				state.deliveryChanged = false;
			}),
	};
}
