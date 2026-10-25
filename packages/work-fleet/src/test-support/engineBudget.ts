import { Clock, Effect, Layer, Stream } from "effect";
import { run } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { schedulerPause } from "#host/commands.ts";
import { resolveHost } from "#host/config.ts";
import { GithubApi } from "#host/githubApi.ts";
import { githubChecks } from "#host/githubChecks.ts";
import { githubDelivery, readPullRequest } from "#host/githubDelivery.ts";
import { LiveConfig } from "#host/liveConfig.ts";
import { type EngineStory, running } from "#test/engineState.ts";
import { syntheticGithub, unslurped } from "#test/githubApi.ts";
import { ADOPTED_HEAD, checkRun, githubFixture, githubResult } from "#test/githubChecks.ts";

const PR_ENDPOINT = "repos/example/project/pulls/7";
export function budgetPullRequest(merged: boolean) {
	const result = githubResult();
	return {
		base: { sha: "b".repeat(40) },
		head: { sha: ADOPTED_HEAD },
		"html_url": result.kind === "change" ? result.pr : "",
		"merge_commit_sha": "c".repeat(40),
		mergeable: true,
		merged,
		"merged_at": merged ? "2026-01-01T00:00:00Z" : null,
		state: merged ? "closed" : "open",
	};
}
export interface EngineBudget {
	api: typeof GithubApi.Service;
	github: ReturnType<typeof syntheticGithub>;
}
export const githubBudgetOptions = Effect.fn("FleetStory.githubBudgetOptions")(function* (
	state: EngineStory,
	mode: "delivery" | "limit" | "reserve",
) {
	const github = budgetFixture(mode);
	const api = yield* GithubApi.pipe(Effect.provide(github.layer));
	state.budget = { api, github };
	return {
		...(mode === "delivery" ? { deliveryQuery: githubDelivery(readPullRequest(api.get)) } : { checksQuery: githubChecks(api) }),
		resultQuery: () => Effect.succeed(githubResult()),
	};
});
function liveInterval(seconds: number) {
	const host = { ...resolveHost("/synthetic/board", { provider: "local" }), interval: seconds };
	const guidance = { reviewer: Effect.succeed(undefined), worker: Effect.succeed(undefined) };
	return Layer.succeed(
		LiveConfig,
		LiveConfig.of({ changes: Stream.never, current: Effect.succeed({ guidance, host, loadedAt: 0, restartRequired: [] }) }),
	);
}
export function engineBudgetVerbs(state: EngineStory, tell: (line: string) => void) {
	function budget() {
		if (state.budget === undefined) {
			throw new Error("No GitHub REST budget is configured");
		}
		return state.budget;
	}
	return {
		budgetObservations: () => budget().api.observations(),
		budgetRemaining: () => budget().github.budget.remaining,
		budgetRequests: () => [...budget().github.requests],
		mergeBudgetPullRequest: () => {
			tell("a human merges the budgeted PR");
			budget().github.reply(PR_ENDPOINT, budgetPullRequest(true));
		},
		readBudgetPullRequest: () => {
			tell("read the PR through the GitHub API");
			return budget().api.get(PR_ENDPOINT);
		},
		startBudgetScheduler: (remaining: number) =>
			Effect.gen(function* () {
				tell(`start the scheduler with ${remaining} GitHub requests left`);
				const github = syntheticGithub({ remaining, reset: Math.ceil((yield* Clock.currentTimeMillis) / 1000) + 3600 });
				github.reply(PR_ENDPOINT, budgetPullRequest(false));
				const api = yield* GithubApi.pipe(Effect.provide(github.layer));
				yield* api.get(PR_ENDPOINT);
				const passes = { count: 0 };
				const admit = Effect.sync(() => {
					passes.count += 1;
				});
				const pause = schedulerPause.pipe(Effect.provideService(GithubApi, api), Effect.provide(liveInterval(0.005)));
				const scheduler = yield* Effect.scoped(run(pause, admit)).pipe(Effect.provideService(Fleet, running(state).fleet), Effect.forkChild);
				return { passes, scheduler };
			}),
	};
}

function budgetFixture(mode: "delivery" | "limit" | "reserve") {
	const github = syntheticGithub({ remaining: { delivery: 5000, limit: 0, reserve: 1000 }[mode] });
	if (mode === "delivery") {
		github.reply(PR_ENDPOINT, budgetPullRequest(false));
	} else {
		const checks = githubFixture();
		checks.reply(ADOPTED_HEAD, [[checkRun()]]);
		for (const [path, body] of unslurped(checks.responses)) {
			github.reply(path, mode === "limit" ? { message: "API rate limit exceeded for user." } : body, mode === "limit" ? { status: 403 } : {});
		}
	}
	return github;
}
