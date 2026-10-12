import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { prepareWork } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";
import { answerWorker } from "#test/workerQuestion.ts";

const test = postgresTests("test", "isolated");

for (const receipt of ["lost", "known", "recovered"] as const) {
	test(`legacy routing preserves the original question with a ${receipt} publication receipt without changing maintainer routing`, () =>
		withFleetBoard({}, (fixture, root) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				for (const [id, observation] of fixture.observations) {
					fixture.observations.set(id, { ...observation, execution: "completed", output: "FLEET_MAINTAINER_QUESTION: Choose the storage." });
				}
				const stopped = (yield* fleet.reconcile("one")).value;
				const original = stopped.decision;
				if (original?.published === undefined) {
					return yield* Effect.die("Missing original question");
				}
				const publication = original.published;
				const source = readFileSync(join(root, publication.sourcePath), "utf8");
				yield* fixture.replaceRecord({
					...stopped,
					attentionOwner: undefined,
					decision: {
						...original,
						attentionOwner: receipt === "recovered" ? "maintainer" : undefined,
						published: receipt === "lost" ? undefined : original.published,
					},
					decisionPublished: receipt !== "lost",
				});
				yield* fixture.upgradeAttention;
				yield* fixture.restart(
					Effect.gen(function* () {
						const restarted = yield* Fleet;
						const migrated = (yield* restarted.reconcile("one")).value;
						const decision = migrated.decision;
						expect(migrated.attentionOwner).toBe("maintainer");
						expect(decision?.attentionOwner).toBe("maintainer");
						expect(decision?.id).toBe(original.id);
						expect(migrated.supersededDecisions).toBeUndefined();
						expect(readFileSync(join(root, publication.sourcePath), "utf8")).toBe(source);
						if (decision === undefined) {
							return yield* Effect.die("Missing migrated question");
						}
						const answer = yield* answerWorker(root, decision);
						expect((yield* restarted.resolve("one", decision.id, answer.id)).value.stage).toBe("executing");
					}).pipe(Effect.scoped),
				);
				expect(fixture.launched).toHaveLength(1);
				expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(2);
			}),
		));
}

for (const migrate of [false, true]) {
	test(`adopts an answer recorded before upgrade ${migrate ? "after SQL migration" : "before any reassignment"}`, () =>
		withFleetBoard({}, (fixture, root) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				for (const [id, observation] of fixture.observations) {
					fixture.observations.set(id, { ...observation, execution: "completed", output: "FLEET_MAINTAINER_QUESTION: Choose the storage." });
				}
				const stopped = (yield* fleet.reconcile("one")).value;
				const original = stopped.decision;
				if (original?.published === undefined) {
					return yield* Effect.die("Missing original question");
				}
				const answer = yield* answerWorker(root, original);
				yield* fixture.replaceRecord({
					...stopped,
					attentionOwner: migrate ? undefined : "orchestrator",
					decision: { ...original, attentionOwner: undefined },
				});
				if (migrate) {
					yield* fixture.upgradeAttention;
				}
				yield* fixture.restart(
					Effect.gen(function* () {
						const restarted = yield* Fleet;
						const continued = (yield* restarted.reconcile("one")).value;
						expect(continued.stage).toBe("executing");
						expect(continued.responses).toMatchObject([{ boardAcknowledged: true, decisionId: original.id, responseId: answer.id }]);
						expect(continued.attempts.at(-1)?.prompt).toBe(answer.body);
						expect(continued.supersededDecisions).toBeUndefined();
					}),
				);
				expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(2);
			}),
		));
}
