import { Clock, Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import type { Engine } from "./engine.ts";
import type { pull, Reply } from "./server.ts";

export type PullChanges = Partial<ReturnType<typeof pull>>;
export interface Check {
	readonly conclusion: string | null;
	readonly name?: string;
	readonly required?: boolean;
	readonly status: string;
}
export function quotaHeaders(resource: string, remaining: number, limit: number, reset: number) {
	return {
		"x-ratelimit-limit": String(limit),
		"x-ratelimit-remaining": String(remaining),
		"x-ratelimit-reset": String(reset / 1000),
		"x-ratelimit-resource": resource,
		"x-ratelimit-used": String(limit - remaining),
	};
}
export function github(engine: Engine, tell: (line: string) => void) {
	function reply(path: string, response: Reply) {
		tell(`GitHub replies to ${path}: ${JSON.stringify(response)}`);
		engine.set(path, response);
	}
	function pullIs(number: number, changes: PullChanges = {}) {
		tell(`PR #${number} is ${JSON.stringify(changes)}`);
		engine.setPull(number, changes);
	}
	function queueHas(...numbers: number[]) {
		reply("/git/matching-refs/heads/gh-readonly-queue/", {
			body: numbers.map((number) => ({ ref: `refs/heads/gh-readonly-queue/main/pr-${number}-abc` })),
		});
	}
	function checksAre(number: number, checks: readonly Check[], sha = `sha${number}`) {
		const runs = checks.map(({ required: _, ...check }, index) => ({ ...check, "node_id": `check-${number}-${index}` }));
		const existing = engine.requirements.get(sha) ?? [];
		engine.requirements.set(sha, [
			...existing.filter((context) => context.__typename !== "CheckRun"),
			...runs.map((check, index) => ({ __typename: "CheckRun", id: check.node_id, isRequired: checks[index]?.required ?? true })),
		]);
		reply(`/commits/${sha}/check-runs?per_page=100&filter=latest`, { body: { "check_runs": runs } });
	}
	function statusIs(number: number, state: string, sha = `sha${number}`, required = true) {
		const existing = engine.requirements.get(sha) ?? [];
		engine.requirements.set(sha, [
			...existing.filter((context) => context.__typename !== "StatusContext"),
			{ __typename: "StatusContext", context: "ci", isRequired: required },
		]);
		reply(`/commits/${sha}/status`, { body: { state, statuses: [{ context: "ci", state }] } });
	}
	function openPulls(...numbers: number[]) {
		reply("/pulls?state=open&per_page=100", { body: numbers.map((number) => ({ number })) });
	}
	return {
		checksAre,
		merged: (number: number) => pullIs(number, { merged: true, state: "closed" }),
		openPulls,
		pages: (path: string, first: unknown, nextPath: string, second: Reply) => {
			reply(path, { body: first, headers: { link: `<${engine.options.apiUrl}/repos/acme/project${nextPath}>; rel="next"` } });
			reply(nextPath, second);
		},
		pullIs,
		queueConfirmationIs: (response: Reply) => {
			tell(`GitHub confirms queue membership: ${JSON.stringify(response)}`);
			engine.setGraphql(response);
		},
		queueEntryIs: (number: number, autoMerge: boolean, queued: boolean, reason?: string) => {
			tell(`PR #${number} confirms auto-merge=${autoMerge}, queued=${queued}, reason=${reason}`);
			engine.setQueue(number, autoMerge, queued, reason);
		},
		queueHas,
		quotaRemaining: (remaining: number) =>
			Effect.gen(function* () {
				const reset = Math.ceil((yield* Clock.currentTimeMillis) / 1000) + 3600;
				reply("/commits/sha1/status", {
					body: { state: "success", statuses: [] },
					headers: {
						"x-ratelimit-limit": "5000",
						"x-ratelimit-remaining": String(remaining),
						"x-ratelimit-reset": String(reset),
						"x-ratelimit-used": String(5000 - remaining),
					},
				});
			}),
		reply,
		requiredChecksPage: (after: string | null, response: Reply) => {
			tell(`GitHub replies with required checks after ${after}: ${JSON.stringify(response)}`);
			engine.setRequiredPage(after, response);
		},
		statusIs,
		throttled: (seconds: number) =>
			reply("/commits/sha1/status", { body: {}, headers: { "retry-after": String(seconds) }, status: HttpStatus.fromLiteral("TooManyRequests") }),
	};
}
