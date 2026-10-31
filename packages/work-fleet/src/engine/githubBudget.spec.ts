import { expect } from "@effect/vitest";
import * as HttpStatus from "effect/http/HttpStatus";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { GITHUB_RESET } from "#test/githubApi.ts";
import { githubBudget } from "#test/githubBudget.ts";
import { ADOPTED_HEAD, githubResult } from "#test/githubChecks.ts";
import { refusal } from "#test/refusal.ts";

const STRETCHED_BUDGET = 1500;
const FULL_PASSES = 5;

const INITIAL_REMAINING = 1000;
const reservedGithubBudget = engineConfiguration("GitHub reserve reads use the REST budget", githubBudget("reserve", INITIAL_REMAINING));
const exhaustedGithubBudget = engineConfiguration("GitHub limit reads use the REST budget", githubBudget("limit"));
const conditionalHumanDelivery = engineConfiguration("GitHub delivery reads use the REST budget", githubBudget("delivery"));

const result = githubResult();
const RESET_AT = GITHUB_RESET * 1000;
const RATE_LIMITED = `GitHub is rate-limited until ${new Date(RESET_AT).toISOString()}`;
const RESERVE_PAUSE = `GitHub paused below the 20% reserve until ${new Date(RESET_AT).toISOString()}`;
const PASSES = 6;

isolatedEngine.it(
	"a PR waiting for a human merge is re-observed by conditional requests that spend no budget and leave its record unchanged",
	[conditionalHumanDelivery],
	function* ({ budgetRemaining, budgetRequests, finishWorkers, fleet, prepareWork }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		const ready = yield* fleet.reconcile("one");
		expect(ready.value.decision?.reason).toBe("Reviewed PR is ready to merge");
		const remaining = budgetRemaining();
		const observed = budgetRequests().length;

		const versions: number[] = [];
		for (let pass = 0; pass < PASSES; pass += 1) {
			versions.push((yield* fleet.reconcile("one")).version);
		}

		expect({
			remaining: budgetRemaining(),
			statuses: [
				...new Set(
					budgetRequests()
						.slice(observed)
						.map(({ status }) => status),
				),
			],
			versions: [...new Set(versions)],
		}).toEqual({ remaining, statuses: [HttpStatus.fromLiteral("NotModified")], versions: [ready.version] });
	},
	{ clock: "live" },
);

isolatedEngine.it(
	"a human merge of a waiting PR completes its work with the merged revision for one request",
	[conditionalHumanDelivery],
	function* ({ budgetRemaining, finishWorkers, fleet, mergeBudgetPullRequest, prepareWork }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		expect((yield* fleet.reconcile("one")).value.decision?.reason).toBe("Reviewed PR is ready to merge");
		const remaining = budgetRemaining();

		mergeBudgetPullRequest();
		const accepted = yield* fleet.reconcile("one");

		expect({ outcome: accepted.value.outcome, spent: remaining - budgetRemaining(), step: accepted.value.step }).toEqual({
			outcome: { head: ADOPTED_HEAD, revision: "c".repeat(40), url: result.kind === "change" ? result.pr : "" },
			spent: 1,
			step: "done",
		});
	},
	{ clock: "live" },
);

isolatedEngine.it(
	"a rate-limited validation read waits on automation until the reset after one check-runs request",
	[exhaustedGithubBudget],
	function* ({ budgetRequests, finishWorkers, fleet, prepareWork }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();

		const waiting = (yield* fleet.reconcile("one")).value;

		expect({
			blocker: waiting.blocker,
			owner: waiting.attentionOwner,
			requests: budgetRequests().map(({ endpoint, method }) => `${method} ${endpoint.includes("check-runs") ? "check-runs" : endpoint}`),
			retry: waiting.integrationRetry,
			step: waiting.step,
		}).toMatchObject({
			blocker: RATE_LIMITED,
			owner: "automation",
			requests: ["GET check-runs"],
			retry: { failures: 0, retryAt: RESET_AT },
			step: "validating",
		});
	},
	{ clock: "live" },
);

isolatedEngine.it(
	"passes during a rate limit call GitHub no more, escalate nothing and show until when in status",
	[exhaustedGithubBudget],
	function* ({ budgetObservations, budgetRequests, finishWorkers, fleet, prepareWork, readBudgetPullRequest, statusText }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		yield* fleet.reconcile("one");
		const requests = budgetRequests().length;

		for (let pass = 0; pass < PASSES; pass += 1) {
			yield* fleet.reconcile("one");
		}

		expect({
			decision: (yield* fleet.get("one")).value.decision?.code ?? "none",
			direct: yield* refusal(readBudgetPullRequest()),
			observations: yield* budgetObservations(),
			requests: budgetRequests().length,
			status: yield* statusText(),
		}).toMatchObject({
			decision: "none",
			direct: expect.stringContaining(RATE_LIMITED),
			observations: [{ limitedBy: "rate-limit", limitedUntil: RESET_AT, remaining: 0, resource: "core" }],
			requests,
			status: expect.stringContaining(`one  waiting  ${RATE_LIMITED}`),
		});
	},
	{ clock: "live" },
);

isolatedEngine.it(
	"below the 20% reserve validation waits on automation until the reset after one check-runs request",
	[reservedGithubBudget],
	function* ({ budgetRemaining, budgetRequests, finishWorkers, fleet, prepareWork }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();

		const waiting = (yield* fleet.reconcile("one")).value;

		expect({
			blocker: waiting.blocker,
			remaining: budgetRemaining(),
			requests: budgetRequests().map(({ endpoint, method }) => `${method} ${endpoint.includes("check-runs") ? "check-runs" : endpoint}`),
			retry: waiting.integrationRetry,
			step: waiting.step,
		}).toMatchObject({
			blocker: RESERVE_PAUSE,
			remaining: INITIAL_REMAINING - 1,
			requests: ["GET check-runs"],
			retry: { failures: 0, retryAt: RESET_AT },
			step: "validating",
		});
	},
	{ clock: "live" },
);

isolatedEngine.it(
	"passes below the reserve call GitHub no more, escalate nothing and show the pause in status",
	[reservedGithubBudget],
	function* ({ budgetObservations, budgetRequests, finishWorkers, fleet, prepareWork, statusText }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		yield* fleet.reconcile("one");
		const requests = budgetRequests().length;

		for (let pass = 0; pass < PASSES; pass += 1) {
			yield* fleet.reconcile("one");
		}

		expect({
			decision: (yield* fleet.get("one")).value.decision?.code ?? "none",
			observations: yield* budgetObservations(),
			requests: budgetRequests().length,
			status: yield* statusText(),
		}).toMatchObject({
			decision: "none",
			observations: [{ limitedBy: "reserve", limitedUntil: RESET_AT, remaining: INITIAL_REMAINING - 1 }],
			requests,
			status: expect.stringContaining(`one  waiting  ${RESERVE_PAUSE}`),
		});
	},
	{ clock: "live" },
);

isolatedEngine.it(
	"a REST budget between half and the reserve holds its scheduler to one pass while a full-budget scheduler passes six times",
	[],
	function* ({ stretchedSchedulerPasses }) {
		const passes = yield* stretchedSchedulerPasses(STRETCHED_BUDGET, FULL_PASSES);

		expect(passes).toBe("one pass");
	},
	{ clock: "live" },
);
