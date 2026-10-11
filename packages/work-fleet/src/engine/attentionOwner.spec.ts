import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { RpcTest } from "effect/unstable/rpc";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { FleetContract, fleetHandlers } from "#operations.ts";
import { FleetFailure } from "#policy.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { storageDatabaseUrl } from "#test/storage.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";
import { answerWorker, askWorker } from "#test/workerQuestion.ts";

const test = it.effect.skipIf(storageDatabaseUrl === undefined);

for (const owner of ["orchestrator", "maintainer"] as const) {
	test(`persists ${owner} worker question routing through restart`, () =>
		withEngine({}, (fixture) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				for (const [id, observation] of fixture.observations) {
					fixture.observations.set(id, {
						...observation,
						execution: "completed",
						output: `${owner === "maintainer" ? "FLEET_MAINTAINER_QUESTION" : "FLEET_QUESTION"}: Choose the API.`,
					});
				}
				const waiting = yield* fleet.reconcile("one");
				expect(waiting.value.attentionOwner).toBe(owner);
				expect(waiting.value.decision?.attentionOwner).toBe(owner);
				yield* fixture.restart(
					Effect.gen(function* () {
						expect((yield* (yield* Fleet).get("one")).value.attentionOwner).toBe(owner);
					}),
				);
				expect(fixture.launched).toHaveLength(1);
			}),
		));
}

for (const owner of ["orchestrator", "automation"] as const) {
	test(`integration failures ${owner === "orchestrator" ? "default to the orchestrator" : "explicitly route configuration gaps to automation"}`, () =>
		withEngine(
			{
				resultQuery: () =>
					Effect.fail(
						new FleetFailure({
							attentionOwner: owner === "automation" ? owner : undefined,
							message: "Adoption is not configured",
							reason: "integration",
						}),
					),
			},
			(fixture) =>
				Effect.gen(function* () {
					const fleet = yield* Fleet;
					yield* prepareWork("one");
					yield* fleet.dispatch("one");
					finishWorkers(fixture);
					expect((yield* fleet.reconcile("one")).value.attentionOwner).toBe(owner);
				}),
		));
}

test("a routine failed worker waits on the orchestrator", () =>
	withEngine({}, (fixture) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			for (const [id, observation] of fixture.observations) {
				fixture.observations.set(id, { ...observation, execution: "failed" });
			}
			expect((yield* fleet.reconcile("one")).value.attentionOwner).toBe("orchestrator");
		}),
	));

test("pending checks persist automation ownership and completion clears it", () => {
	let pending = true;
	return withEngine(
		{ checksQuery: (result) => Effect.succeed({ evidence: ["Synthetic checks"], head: result.head, passed: !pending, pending }) },
		(fixture) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				expect((yield* fleet.reconcile("one")).value.attentionOwner).toBe("automation");
				pending = false;
				const completed = yield* fleet.reconcile("one");
				expect(completed.value.stage).toBe("completed");
				expect(completed.value.attentionOwner).toBeUndefined();
			}),
	);
});

test("RPC reassignment publishes maintainer ownership, supersedes the old question and continues only from the new answer", () =>
	withFleetBoard({}, (fixture, root) =>
		Effect.scoped(
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				const old = yield* askWorker(fixture);
				const oldAnswer = yield* answerWorker(root, old.decision, "response.old");
				const client = yield* RpcTest.makeClient(FleetContract, { flatten: true }).pipe(Effect.provide(fleetHandlers));
				const reassigned = yield* client("fleet.reassign", { attentionOwner: "maintainer", decisionId: old.decision.id, workId: "one" });
				expect(reassigned.attentionOwner).toBe("maintainer");
				expect(reassigned.decision?.id).not.toBe(old.decision.id);
				expect(reassigned.decision?.worker).toEqual(old.decision.worker);
				expect(reassigned.supersededDecisions).toMatchObject([{ boardAcknowledged: true, published: old.published }]);
				expect((yield* client("fleet.views", undefined)).waiting.maintainer).toHaveLength(1);
				expect((yield* client("fleet.views", undefined)).waiting.orchestrator).toHaveLength(0);
				expect(yield* fleet.resolve("one", old.decision.id, oldAnswer.id).pipe(Effect.flip)).toMatchObject({ reason: "stale" });
				const decision = reassigned.decision;
				if (decision === undefined) {
					return yield* Effect.die("Missing reassigned decision");
				}
				const answer = yield* answerWorker(root, decision, "response.new");
				yield* fixture.restart(
					Effect.gen(function* () {
						const restarted = yield* Fleet;
						const resumed = yield* restarted.resolve("one", decision.id, answer.id);
						expect(resumed.value.stage).toBe("executing");
						expect(resumed.value.attentionOwner).toBeUndefined();
					}),
				);
				expect(fixture.launched).toHaveLength(1);
				expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(2);
			}),
		),
	));
