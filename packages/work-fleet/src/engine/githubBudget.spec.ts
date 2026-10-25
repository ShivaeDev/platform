import { expect } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { views } from "#engine/views.ts";
import { renderStatus } from "#host/renderStatus.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { GITHUB_RESET } from "#test/githubApi.ts";
import { githubBudget } from "#test/githubBudget.ts";
import { ADOPTED_HEAD, githubResult } from "#test/githubChecks.ts";

const reservedGithubBudget = engineConfiguration("GitHub reserve reads use the REST budget", githubBudget("reserve"));
const exhaustedGithubBudget = engineConfiguration("GitHub limit reads use the REST budget", githubBudget("limit"));
const conditionalHumanDelivery = engineConfiguration("GitHub delivery reads use the REST budget", githubBudget("delivery"));

const result = githubResult();
isolatedEngine.it(
	"a PR waiting for a human merge is re-observed by conditional requests that spend no budget",
	[conditionalHumanDelivery],
	function* ({ budgetRemaining, budgetRequests, mergeBudgetPullRequest, finishWorkers, prepareWork, fleet }) {
		yield* prepareWork("one");

		yield* fleet.dispatch("one");
		finishWorkers();
		const ready = yield* fleet.reconcile("one");
		expect(ready.value.decision?.reason).toBe("Reviewed PR is ready to merge");
		const spent = budgetRemaining();
		const observed = budgetRequests().length;
		for (let pass = 0; pass < 5; pass += 1) {
			expect((yield* fleet.reconcile("one")).version).toBe(ready.version);
		}
		expect(budgetRequests().length).toBeGreaterThan(observed);
		const conditional = budgetRequests().slice(observed);
		expect(conditional.map(({ status }) => status)).toEqual(conditional.map(() => 304));
		expect(budgetRemaining()).toBe(spent);
		mergeBudgetPullRequest();
		const accepted = yield* fleet.reconcile("one");
		expect(accepted.value.step).toBe("done");
		expect(accepted.value.outcome).toEqual({ head: ADOPTED_HEAD, revision: "c".repeat(40), url: result.kind === "change" ? result.pr : "" });
		expect(budgetRemaining()).toBe(spent - 1);
	},
	{ clock: "live" },
);

isolatedEngine.it(
	"a rate-limited read waits for the reset without escalating or calling GitHub again, and status says until when",
	[exhaustedGithubBudget],
	function* ({ budgetRequests, budgetObservations, readBudgetPullRequest, finishWorkers, prepareWork, fleet }) {
		yield* prepareWork("one");

		yield* fleet.dispatch("one");
		finishWorkers();
		const waiting = yield* fleet.reconcile("one");
		const until = new Date(GITHUB_RESET * 1000).toISOString();
		expect(waiting.value.step).toBe("validating");
		expect(waiting.value.blocker).toBe(`GitHub is rate-limited until ${until}`);
		expect(waiting.value.attentionOwner).toBe("automation");
		expect(waiting.value.integrationRetry).toMatchObject({ failures: 0, retryAt: GITHUB_RESET * 1000 });
		expect(budgetRequests()).toHaveLength(1);
		for (let pass = 0; pass < 6; pass += 1) {
			yield* fleet.reconcile("one");
		}
		expect(yield* readBudgetPullRequest().pipe(Effect.flip)).toMatchObject({ message: `GitHub is rate-limited until ${until}` });
		expect(budgetRequests()).toHaveLength(1);
		const current = yield* fleet.get("one");
		expect(current.value.decision).toBeUndefined();
		expect(renderStatus(views((yield* fleet.list()).map(({ value }) => value)))).toContain(`one  waiting  GitHub is rate-limited until ${until}`);
		expect(yield* budgetObservations()).toMatchObject([
			{ limitedBy: "rate-limit", limitedUntil: GITHUB_RESET * 1000, remaining: 0, resource: "core" },
		]);
	},
	{ clock: "live" },
);

isolatedEngine.it(
	"below the 20% reserve Fleet stops calling GitHub until the reset and status says so",
	[reservedGithubBudget],
	function* ({ budgetRemaining, budgetRequests, budgetObservations, finishWorkers, prepareWork, fleet }) {
		yield* prepareWork("one");

		yield* fleet.dispatch("one");
		finishWorkers();
		const waiting = yield* fleet.reconcile("one");
		const message = `GitHub paused below the 20% reserve until ${new Date(GITHUB_RESET * 1000).toISOString()}`;
		expect(waiting.value.step).toBe("validating");
		expect(waiting.value.blocker).toBe(message);
		expect(waiting.value.integrationRetry).toMatchObject({ failures: 0, retryAt: GITHUB_RESET * 1000 });
		expect(budgetRequests()).toHaveLength(1);
		expect(budgetRemaining()).toBe(999);
		for (let pass = 0; pass < 6; pass += 1) {
			yield* fleet.reconcile("one");
		}
		expect(budgetRequests()).toHaveLength(1);
		expect((yield* fleet.get("one")).value.decision).toBeUndefined();
		expect(renderStatus(views((yield* fleet.list()).map(({ value }) => value)))).toContain(`one  waiting  ${message}`);
		expect(yield* budgetObservations()).toMatchObject([{ limitedBy: "reserve", limitedUntil: GITHUB_RESET * 1000, remaining: 999 }]);
	},
	{ clock: "live" },
);

isolatedEngine.it(
	"a REST budget between half and the reserve stretches the scheduler's pause beyond the configured interval",
	[],
	function* ({ startBudgetScheduler }) {
		const full = yield* startBudgetScheduler(5000);
		yield* Effect.sleep("5 millis").pipe(Effect.repeat({ until: () => full.passes.count > 5 }), Effect.timeout("10 seconds"));
		yield* Fiber.interrupt(full.scheduler);
		const stretched = yield* startBudgetScheduler(1500);
		yield* Effect.sleep("300 millis");
		yield* Fiber.interrupt(stretched.scheduler);
		expect(stretched.passes.count).toBe(1);
	},
	{ clock: "live" },
);
