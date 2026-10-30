import * as HttpStatus from "effect/http/HttpStatus";
import {
	type Check,
	checksRoute,
	type FakeGitHub,
	GRAPHQL,
	OPEN_LIST,
	type Pull,
	QUEUE_REFS,
	REPOSITORY,
	type Reply,
	statusRoute,
} from "./server.ts";

export interface Change {
	readonly apply: (github: FakeGitHub) => void;
	readonly line: string;
}

export interface Read {
	readonly name: string;
	readonly route: (github: FakeGitHub) => string;
}

export interface Answer {
	readonly description: string;
	readonly reply: Reply;
}

function change(line: string, apply: (github: FakeGitHub) => void): Change {
	return { apply, line };
}

function update(number: number, changes: Partial<Pull>) {
	return (fake: FakeGitHub) => {
		Object.assign(fake.pullOf(number), changes);
	};
}

export const reads = {
	checks: (number: number): Read => ({ name: `PR ${number}'s check runs`, route: (fake) => checksRoute(fake.pullOf(number).sha) }),
	detail: (number: number): Read => ({ name: `PR ${number}'s detail`, route: () => `/pulls/${number}` }),
	graphql: { name: "the GraphQL queue confirmation", route: () => GRAPHQL } satisfies Read,
	openList: { name: "the open PR list", route: () => OPEN_LIST } satisfies Read,
	queueRefs: { name: "the queue refs", route: () => QUEUE_REFS } satisfies Read,
	status: (number: number): Read => ({ name: `PR ${number}'s commit status`, route: (fake) => statusRoute(fake.pullOf(number).sha) }),
};

export const replies = {
	emptyObject: { description: "an empty object", reply: { body: {} } } satisfies Answer,
	graphqlErrors: (data: unknown, message: string): Answer => ({
		description: `GraphQL errors and data ${JSON.stringify(data)}`,
		reply: { body: { ...(data === undefined ? {} : { data }), errors: [{ message }] } },
	}),
	graphqlPullRequest: (pullRequest: unknown): Answer => ({
		description: `the pull request ${JSON.stringify(pullRequest)}`,
		reply: { body: { data: { repository: { pullRequest } } } },
	}),
	redirect: {
		description: "a redirect to /redirected",
		reply: { body: {}, headers: { location: "/redirected" }, status: HttpStatus.fromLiteral("Found") },
	},
	status: (status: number): Answer => ({ description: `HTTP ${status}`, reply: { body: {}, status } }),
	statusWithRetryAfter: (status: number, seconds: number): Answer => ({
		description: `HTTP ${status} and Retry-After: ${seconds}`,
		reply: { body: {}, headers: { "retry-after": String(seconds) }, status },
	}),
} satisfies Record<string, Answer | ((...args: never[]) => Answer)>;

export function quotaHeaders(resource: string, remaining: number, limit: number, resetAt: number) {
	return {
		"x-ratelimit-limit": String(limit),
		"x-ratelimit-remaining": String(remaining),
		"x-ratelimit-reset": String(resetAt / 1000),
		"x-ratelimit-resource": resource,
		"x-ratelimit-used": String(limit - remaining),
	};
}

export const github = {
	answers: (read: Read, answer: Answer) =>
		change(`GitHub answers ${read.name} with ${answer.description}`, (fake) => {
			fake.overrides.set(read.route(fake), answer.reply);
		}),
	budget: (resource: string, remaining: number, limit: number, resetAt: number) =>
		change(`the ${resource} budget has ${remaining} of ${limit} requests left until ${new Date(resetAt).toISOString().slice(11, 19)}`, (fake) => {
			fake.extraHeaders.set(statusRoute(fake.pullOf(1).sha), quotaHeaders(resource, remaining, limit, resetAt));
		}),
	checkConcludes: (number: number, check: Check) =>
		change(`PR ${number}'s check run is ${check.status} with conclusion ${check.conclusion}`, (fake) => {
			fake.checks.set(fake.pullOf(number).sha, [check]);
		}),
	checksPageLinksElsewhere: (number: number) =>
		change(`PR ${number}'s first checks page holds a failed check run and links its next page on another origin`, (fake) => {
			fake.overrides.set(checksRoute(fake.pullOf(number).sha), {
				body: { "check_runs": [{ conclusion: "failure", status: "completed" }] },
				headers: { link: '<https://other.example/checks?page=2>; rel="next"' },
			});
		}),
	closes: (number: number) =>
		change(`PR ${number} closes without merging`, (fake) => {
			update(number, { state: "closed" })(fake);
			fake.open.delete(number);
			fake.queueRefs.delete(number);
		}),
	conflicts: (number: number) => change(`PR ${number} gets a merge conflict`, update(number, { mergeable: false, mergeableState: "dirty" })),
	disablesAutoMerge: (number: number) => change(`PR ${number} turns auto-merge off`, update(number, { autoMerge: false })),
	enablesAutoMerge: (number: number) => change(`PR ${number} turns auto-merge on`, update(number, { autoMerge: true })),
	entersQueue: (number: number) =>
		change(`PR ${number} enters the merge queue, which clears its auto-merge request`, (fake) => {
			update(number, { autoMerge: false })(fake);
			fake.queueRefs.add(number);
			fake.queueEntries.add(number);
		}),
	failingCheckOnSecondPage: (number: number) =>
		change(`PR ${number}'s failed check run arrives on the second of two checks pages`, (fake) => {
			fake.overrides.set(checksRoute(fake.pullOf(number).sha), {
				body: { "check_runs": [] },
				headers: { link: `<${fake.apiUrl}${REPOSITORY}/checks?page=2>; rel="next"` },
			});
			fake.overrides.set("/checks?page=2", { body: { "check_runs": [{ conclusion: "failure", status: "completed" }] } });
		}),
	leavesOpenList: (number: number) =>
		change(`PR ${number} no longer appears in the open PR list`, (fake) => {
			fake.open.delete(number);
		}),
	leavesQueue: (number: number, reason?: string) =>
		change(`PR ${number} leaves the merge queue${reason === undefined ? "" : ` because ${reason}`} and loses its auto-merge request`, (fake) => {
			update(number, { autoMerge: false })(fake);
			fake.queueRefs.delete(number);
			fake.queueEntries.delete(number);
			if (reason !== undefined) {
				fake.dequeueReasons.set(number, reason);
			}
		}),
	listedOnSecondPage: (number: number) =>
		change(`PR ${number} opens and is listed on the second page of open PRs`, (fake) => {
			fake.pulls.set(number, pullNumbered(number));
			fake.overrides.set(OPEN_LIST, {
				body: [...fake.open].map((open) => ({ number: open })),
				headers: { link: `<${fake.apiUrl}${REPOSITORY}/pulls?page=2>; rel="next"` },
			});
			fake.overrides.set("/pulls?page=2", { body: [{ number }] });
		}),
	mergeabilityPending: (number: number) =>
		change(`GitHub is still computing PR ${number}'s mergeability`, update(number, { mergeable: null, mergeableState: "unknown" })),
	merges: (number: number) =>
		change(`PR ${number} merges`, (fake) => {
			update(number, { merged: true, state: "closed" })(fake);
			fake.open.delete(number);
			fake.queueRefs.delete(number);
			fake.queueEntries.delete(number);
		}),
	mergesStillListed: (number: number) => change(`PR ${number} merges while GitHub still lists it as open`, update(number, { merged: true })),
	opens: (number: number) =>
		change(`PR ${number} opens with auto-merge on, no conflict and passing checks`, (fake) => {
			fake.pulls.set(number, pullNumbered(number));
			fake.open.add(number);
		}),
	pushesHead: (number: number, branch: string, sha: string, title: string) =>
		change(`PR ${number} moves to head ${sha} on branch ${branch} and is retitled ${JSON.stringify(title)}`, update(number, { branch, sha, title })),
	queueRefOnSecondPage: (number: number) =>
		change(`PR ${number} enters the merge queue and its ref is listed on the second page of queue refs`, (fake) => {
			fake.queueEntries.add(number);
			fake.overrides.set(QUEUE_REFS, { body: [], headers: { link: `<${fake.apiUrl}${REPOSITORY}/refs?page=2>; rel="next"` } });
			fake.overrides.set("/refs?page=2", { body: [{ ref: `refs/heads/gh-readonly-queue/main/pr-${number}-abc` }] });
		}),
	queueRefVanishes: (number: number, remaining: "queue entry" | "auto-merge request") =>
		change(`PR ${number}'s queue ref disappears while GraphQL still shows its ${remaining}`, (fake) => {
			fake.queueRefs.delete(number);
			if (remaining === "queue entry") {
				fake.queueEntries.add(number);
				update(number, { autoMerge: false })(fake);
			} else {
				fake.queueEntries.delete(number);
				update(number, { autoMerge: true })(fake);
			}
		}),
	recovers: (read: Read) =>
		change(`GitHub answers ${read.name} normally again`, (fake) => {
			fake.overrides.delete(read.route(fake));
		}),
	secondChecksPage: (number: number, answer: Answer) =>
		change(`PR ${number}'s first checks page holds a failed check run and GitHub answers the second page with ${answer.description}`, (fake) => {
			fake.overrides.set(checksRoute(fake.pullOf(number).sha), {
				body: { "check_runs": [{ conclusion: "failure", status: "completed" }] },
				headers: { link: `<${fake.apiUrl}${REPOSITORY}/checks?page=2>; rel="next"` },
			});
			fake.overrides.set("/checks?page=2", answer.reply);
		}),
	statusBecomes: (number: number, state: string) =>
		change(`PR ${number}'s combined commit status becomes ${state}`, (fake) => {
			fake.statuses.set(fake.pullOf(number).sha, state);
		}),
};

function pullNumbered(number: number): Pull {
	return {
		autoMerge: true,
		branch: `feature-${number}`,
		mergeable: true,
		mergeableState: "clean",
		merged: false,
		sha: `sha${number}`,
		state: "open",
		title: `Change ${number}`,
	};
}
