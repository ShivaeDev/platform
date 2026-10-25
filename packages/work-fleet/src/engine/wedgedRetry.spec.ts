import { expect } from "@effect/vitest";
import { wedgedConflictRepair } from "#test/engineStalledTurnTraits.ts";
import { engine } from "#test/engineStory.ts";

engine.it(
	"a wedged repair automatically starts a fresh thread on the same PR across restart",
	[wedgedConflictRepair()],
	function* ({
		setFleetTime,
		resolvePullRequestConflict,
		fleet,
		prepareWork,
		finishWorkers,
		afterRestart,
		publishedDecisions,
		providerStarts,
		reviewedHeads,
	}) {
		const retryAt = 30_100;
		yield* prepareWork("one");

		yield* fleet.dispatch("one");
		finishWorkers();
		yield* fleet.reconcile("one");
		const blocked = yield* fleet.reconcile("one");
		expect(blocked.value.decision).toBeUndefined();
		expect(blocked.value.step).toBe("repairing");
		expect(blocked.value.launchRetry?.retryAt).toBe(retryAt);
		expect(blocked.value.attempts.at(-1)).toMatchObject({ role: "repair", sessionUnusable: true, status: "failed" });
		yield* afterRestart(fleet.reconcile("one"));
		expect(providerStarts().map((start) => start.operationId)).toEqual(["operation-1", "operation-2"]);
		setFleetTime(retryAt);
		const repair = yield* afterRestart(fleet.reconcile("one"));
		expect(repair.value.step).toBe("working");
		expect(repair.value.result).toEqual(blocked.value.result);
		const attempt = repair.value.attempts.at(-1);
		expect(attempt?.role).toBe("repair");
		expect(attempt?.receipt?.sessionId).not.toBe(blocked.value.attempts[0]?.receipt?.sessionId);
		expect(providerStarts().at(-1)?.prompt).toContain("Fetch and merge main");
		expect(providerStarts().at(-1)?.prompt).toContain(
			`same branch and PR (${blocked.value.result?.kind === "change" ? blocked.value.result.pr : ""})`,
		);
		expect(providerStarts().at(-1)?.cwd).toBe(blocked.value.cwd);
		expect(reviewedHeads()).toEqual(["head-one-0"]);
		expect(publishedDecisions()).toHaveLength(0);
		resolvePullRequestConflict();
		finishWorkers();
		const reviewed = yield* fleet.reconcile("one");
		expect(reviewed.value.result).toMatchObject({
			head: "head-one-1",
			pr: blocked.value.result?.kind === "change" ? blocked.value.result.pr : "",
		});
		expect(reviewed.value.review).toMatchObject({ head: "head-one-1", verdict: "approved" });
		expect(reviewedHeads()).toEqual(["head-one-0", "head-one-1"]);
	},
);
