import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { withFailureContext } from "#engine/failureContext.ts";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { backlog } from "#model.ts";
import { deliveryReadsCanFail, movedHeadReadCanFail } from "#test/deliveryObservationScenarios.ts";
import { engine } from "#test/engineStory.ts";
import { configured } from "#test/engineTraits.ts";

const result = { head: "reviewed-head", kind: "change", paths: ["src/one.ts"], pr: "https://github.com/example/repository/pull/42" } as const;
const open = { headRefOid: result.head, mergeCommit: null, mergedAt: null, state: "OPEN", url: result.pr };

for (const owner of ["orchestrator", "automation"] as const) {
	engine.it(
		`delivery observation failures wait on ${owner}`,
		[
			configured({
				deliveryQuery: () =>
					Effect.fail(
						withFailureContext(new ServiceUnavailable({ message: "Delivery unavailable" }), {
							attentionOwner: owner === "automation" ? owner : undefined,
						}),
					),
			}),
		],
		function* ({ fleet, prepareWork, finishWorkers, restart }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			const retrying = yield* fleet.reconcile("one");
			expect(retrying.value.attentionOwner).toBe("automation");
			expect(retrying.value.decision).toBeUndefined();
			for (let count = 0; count < 4; count += 1) {
				const current = yield* fleet.get("one");
				const retry = current.value.integrationRetry ?? current.value.attempts.at(-1)?.readRetry;
				if (retry === undefined) {
					break;
				}
				yield* restart(fleet.reconcile("one"), (policy) => ({ ...policy, now: () => retry.retryAt }));
			}
			const waiting = yield* fleet.get("one");
			expect(waiting.value.attentionOwner).toBe(owner);
			expect(waiting.value.decision?.attentionOwner).toBe(owner);
			yield* restart(
				Effect.gen(function* () {
					expect((yield* (yield* Fleet).get("one")).value.attentionOwner).toBe(owner);
				}),
			);
		},
	);
}

for (const state of ["OPEN", "CLOSED"] as const) {
	{
		const setup = deliveryReadsCanFail(state);
		engine.it(
			`transient delivery failure preserves the ${state} PR's Board decision across restart`,
			[setup.given],
			function* ({ fixture, fleet, prepareWork, finishWorkers, restart }) {
				const context = setup.context();
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				finishWorkers();
				const current = yield* fleet.reconcile("one");
				expect(current.value.decision?.published).toBeDefined();
				expect(current.value.decision?.reason).toContain(state === "OPEN" ? "ready to merge" : "closed without merging");
				context.unavailable = true;
				yield* restart(cycle);
				expect(yield* fleet.get("one")).toEqual(current);
				expect(yield* fleet.reconcile("one")).toEqual(current);
				expect(backlog(current.value)).toBe(true);
				context.unavailable = false;
				context.observation = open;
				const recovered = yield* fleet.reconcile("one");
				expect(recovered.value.decision?.reason).toBe("Reviewed PR is ready to merge");
				context.observation = { ...open, mergeCommit: { oid: "merge-revision" }, mergedAt: "2026-01-01T00:00:00Z", state: "MERGED" };
				yield* restart(cycle);
				expect((yield* fleet.get("one")).value.outcome).toEqual({ head: result.head, revision: "merge-revision", url: result.pr });
				expect(fixture.reviews).toHaveLength(1);
				expect(fixture.merged).toEqual([]);
			},
		);
	}
}

{
	const setup = movedHeadReadCanFail();
	engine.it(
		"an outage while refreshing a moved PR head preserves the existing decision",
		[setup.given],
		function* ({ fixture, fleet, prepareWork, finishWorkers, restart }) {
			const context = setup.context();
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			const ready = (yield* fleet.reconcile("one")).value;
			expect(ready.decision?.code).toBe("reviewed-pr-ready");
			context.unavailable = true;
			context.observation = { ...open, headRefOid: "moved-head" };
			yield* restart(cycle);
			const waiting = (yield* fleet.get("one")).value;
			expect(waiting.decision).toEqual(ready.decision);
			expect(waiting.result).toEqual(ready.result);
			expect(waiting.mergeReadyHead).toBeUndefined();
			expect(fixture.decisions).toHaveLength(1);
			yield* restart(cycle);
			expect((yield* fleet.get("one")).value.decision).toEqual(ready.decision);
			expect(fixture.decisions).toHaveLength(1);
		},
	);
}
