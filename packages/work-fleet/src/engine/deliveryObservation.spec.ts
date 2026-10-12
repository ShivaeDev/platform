import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { withFailureContext } from "#engine/failureContext.ts";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { githubDelivery } from "#host/githubDelivery.ts";
import { backlog } from "#model.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("test");
const result = { head: "reviewed-head", kind: "change", paths: ["src/one.ts"], pr: "https://github.com/example/repository/pull/42" } as const;
const open = { headRefOid: result.head, mergeCommit: null, mergedAt: null, state: "OPEN", url: result.pr };

for (const owner of ["orchestrator", "automation"] as const) {
	test(`delivery observation failures wait on ${owner}`, () =>
		withEngine(
			{
				deliveryQuery: () =>
					Effect.fail(
						withFailureContext(new ServiceUnavailable({ message: "Delivery unavailable" }), {
							attentionOwner: owner === "automation" ? owner : undefined,
						}),
					),
			},
			(fixture) =>
				Effect.gen(function* () {
					const fleet = yield* Fleet;
					yield* prepareWork("one");
					yield* fleet.dispatch("one");
					finishWorkers(fixture);
					const waiting = yield* fleet.reconcile("one");
					expect(waiting.value.attentionOwner).toBe(owner);
					expect(waiting.value.decision?.attentionOwner).toBe(owner);
					yield* fixture.restart(
						Effect.gen(function* () {
							expect((yield* (yield* Fleet).get("one")).value.attentionOwner).toBe(owner);
						}),
					);
				}),
		));
}

for (const state of ["OPEN", "CLOSED"] as const) {
	test(`transient delivery failure preserves the ${state} PR's Board decision across restart`, () => {
		let unavailable = false;
		let observation: unknown = { ...open, state };
		const deliveryQuery = githubDelivery("/repository", () =>
			unavailable ? Effect.fail(new ServiceUnavailable({ message: "GitHub request failed" })) : Effect.succeed(observation),
		);
		return withEngine({ deliveryQuery, resultQuery: () => Effect.succeed(result) }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const current = yield* fleet.reconcile("one");
				expect(current.value.decision?.published).toBeDefined();
				expect(current.value.decision?.reason).toContain(state === "OPEN" ? "ready to merge" : "closed without merging");
				unavailable = true;
				yield* fixture.restart(cycle);
				expect(yield* fleet.get("one")).toEqual(current);
				expect(yield* fleet.reconcile("one")).toEqual(current);
				expect(backlog(current.value)).toBe(true);
				unavailable = false;
				observation = open;
				const recovered = yield* fleet.reconcile("one");
				expect(recovered.value.decision?.reason).toBe("Reviewed PR is ready to merge");
				observation = { ...open, mergeCommit: { oid: "merge-revision" }, mergedAt: "2026-01-01T00:00:00Z", state: "MERGED" };
				yield* fixture.restart(cycle);
				expect((yield* fleet.get("one")).value.outcome).toEqual({ head: result.head, revision: "merge-revision", url: result.pr });
				expect(fixture.reviews).toHaveLength(1);
				expect(fixture.merged).toEqual([]);
			}),
		);
	});
}
