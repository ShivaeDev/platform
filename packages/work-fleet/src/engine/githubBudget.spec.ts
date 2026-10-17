import { expect } from "@effect/vitest";
import { Clock, Effect, Fiber, Layer, Stream } from "effect";
import { run } from "#engine/scheduler.ts";
import { views } from "#engine/views.ts";
import { Fleet } from "#fleet.ts";
import { schedulerPause } from "#host/commands.ts";
import { resolveHost } from "#host/config.ts";
import { GithubApi } from "#host/githubApi.ts";
import { githubChecks } from "#host/githubChecks.ts";
import { githubDelivery, readPullRequest } from "#host/githubDelivery.ts";
import { LiveConfig } from "#host/liveConfig.ts";
import { renderStatus } from "#host/renderStatus.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { GITHUB_RESET, syntheticGithub, unslurped } from "#test/githubApi.ts";
import { ADOPTED_HEAD, checkRun, githubFixture, githubResult } from "#test/githubChecks.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("live", "isolated");
const PR_ENDPOINT = "repos/example/project/pulls/7";
const result = githubResult();
function pullRequest(merged: boolean) {
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

test("a PR waiting for a human merge is re-observed by conditional requests that spend no budget", () => {
	const github = syntheticGithub();
	github.reply(PR_ENDPOINT, pullRequest(false));
	return Effect.gen(function* () {
		const api = yield* GithubApi.pipe(Effect.provide(github.layer));
		yield* withEngine({ deliveryQuery: githubDelivery(readPullRequest(api.get)), resultQuery: () => Effect.succeed(result) }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const ready = yield* fleet.reconcile("one");
				expect(ready.value.decision?.reason).toBe("Reviewed PR is ready to merge");
				const spent = github.budget.remaining;
				const observed = github.requests.length;
				for (let pass = 0; pass < 5; pass += 1) {
					expect((yield* fleet.reconcile("one")).version).toBe(ready.version);
				}
				expect(github.requests.length).toBeGreaterThan(observed);
				expect(github.requests.slice(observed).every(({ status }) => status === 304)).toBe(true);
				expect(github.budget.remaining).toBe(spent);
				github.reply(PR_ENDPOINT, pullRequest(true));
				const accepted = yield* fleet.reconcile("one");
				expect(accepted.value.stage).toBe("completed");
				expect(accepted.value.outcome).toEqual({ head: ADOPTED_HEAD, revision: "c".repeat(40), url: result.kind === "change" ? result.pr : "" });
				expect(github.budget.remaining).toBe(spent - 1);
			}),
		);
	});
});

test("a rate-limited read waits for the reset without escalating or calling GitHub again, and status says until when", () => {
	const github = syntheticGithub({ remaining: 0 });
	const checks = githubFixture();
	checks.reply(ADOPTED_HEAD, [[checkRun()]]);
	for (const [endpoint] of checks.responses) {
		github.reply(endpoint, { message: "API rate limit exceeded for user." }, { status: 403 });
	}
	return Effect.gen(function* () {
		const api = yield* GithubApi.pipe(Effect.provide(github.layer));
		yield* withEngine({ checksQuery: githubChecks(api), resultQuery: () => Effect.succeed(result) }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const waiting = yield* fleet.reconcile("one");
				const until = new Date(GITHUB_RESET * 1000).toISOString();
				expect(waiting.value.stage).toBe("validating");
				expect(waiting.value.blocker).toBe(`GitHub is rate-limited until ${until}`);
				expect(waiting.value.attentionOwner).toBe("automation");
				expect(waiting.value.integrationRetry).toMatchObject({ failures: 0, retryAt: GITHUB_RESET * 1000 });
				expect(github.requests).toHaveLength(1);
				for (let pass = 0; pass < 6; pass += 1) {
					yield* fleet.reconcile("one");
				}
				expect(yield* api.get(PR_ENDPOINT).pipe(Effect.flip)).toMatchObject({ message: `GitHub is rate-limited until ${until}` });
				expect(github.requests).toHaveLength(1);
				const current = yield* fleet.get("one");
				expect(current.value.decision).toBeUndefined();
				expect(renderStatus(views((yield* fleet.list()).map(({ value }) => value)))).toContain(
					`one  validating  GitHub is rate-limited until ${until}`,
				);
				expect(yield* api.observations()).toMatchObject([
					{ limitedBy: "rate-limit", limitedUntil: GITHUB_RESET * 1000, remaining: 0, resource: "core" },
				]);
			}),
		);
	});
});

test("below the 20% reserve Fleet stops calling GitHub until the reset and status says so", () => {
	const github = syntheticGithub({ remaining: 1000 });
	const checks = githubFixture();
	checks.reply(ADOPTED_HEAD, [[checkRun()]]);
	for (const [endpoint, body] of unslurped(checks.responses)) {
		github.reply(endpoint, body);
	}
	return Effect.gen(function* () {
		const api = yield* GithubApi.pipe(Effect.provide(github.layer));
		yield* withEngine({ checksQuery: githubChecks(api), resultQuery: () => Effect.succeed(result) }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const waiting = yield* fleet.reconcile("one");
				const message = `GitHub paused below the 20% reserve until ${new Date(GITHUB_RESET * 1000).toISOString()}`;
				expect(waiting.value.stage).toBe("validating");
				expect(waiting.value.blocker).toBe(message);
				expect(waiting.value.integrationRetry).toMatchObject({ failures: 0, retryAt: GITHUB_RESET * 1000 });
				expect(github.requests).toHaveLength(1);
				expect(github.budget.remaining).toBe(999);
				for (let pass = 0; pass < 6; pass += 1) {
					yield* fleet.reconcile("one");
				}
				expect(github.requests).toHaveLength(1);
				expect((yield* fleet.get("one")).value.decision).toBeUndefined();
				expect(renderStatus(views((yield* fleet.list()).map(({ value }) => value)))).toContain(`one  validating  ${message}`);
				expect(yield* api.observations()).toMatchObject([{ limitedBy: "reserve", limitedUntil: GITHUB_RESET * 1000, remaining: 999 }]);
			}),
		);
	});
});

function liveInterval(seconds: number) {
	const host = { ...resolveHost("/synthetic/board", { provider: "local" }), interval: seconds };
	const guidance = { reviewer: Effect.succeed(undefined), worker: Effect.succeed(undefined) };
	return Layer.succeed(
		LiveConfig,
		LiveConfig.of({ changes: Stream.never, current: Effect.succeed({ guidance, host, loadedAt: 0, restartRequired: [] }) }),
	);
}

const pacedScheduler = Effect.fn("GithubBudget.pacedScheduler")(function* (remaining: number) {
	const github = syntheticGithub({ remaining, reset: Math.ceil((yield* Clock.currentTimeMillis) / 1000) + 3600 });
	github.reply(PR_ENDPOINT, pullRequest(false));
	const api = yield* GithubApi.pipe(Effect.provide(github.layer));
	yield* api.get(PR_ENDPOINT);
	const passes = { count: 0 };
	const admit = Effect.sync(() => {
		passes.count += 1;
	});
	const pause = schedulerPause.pipe(Effect.provideService(GithubApi, api), Effect.provide(liveInterval(0.005)));
	const scheduler = yield* Effect.scoped(run(pause, admit)).pipe(Effect.forkChild);
	return { passes, scheduler };
});

test("a REST budget between half and the reserve stretches the scheduler's pause beyond the configured interval", () =>
	withEngine({}, () =>
		Effect.gen(function* () {
			const full = yield* pacedScheduler(5000);
			yield* Effect.sleep("5 millis").pipe(Effect.repeat({ until: () => full.passes.count > 5 }), Effect.timeout("10 seconds"));
			yield* Fiber.interrupt(full.scheduler);
			const stretched = yield* pacedScheduler(1500);
			yield* Effect.sleep("300 millis");
			yield* Fiber.interrupt(stretched.scheduler);
			expect(stretched.passes.count).toBe(1);
		}),
	));
