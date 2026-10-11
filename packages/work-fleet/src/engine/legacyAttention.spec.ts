import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { prepareWork } from "#test/engine.ts";
import { storageDatabaseUrl } from "#test/storage.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";
import { answerWorker } from "#test/workerQuestion.ts";

const test = it.effect.skipIf(storageDatabaseUrl === undefined);

for (const receipt of ["lost", "known", "recovered"] as const) {
	test(`legacy routing preserves the original question with a ${receipt} publication receipt before assigning the orchestrator`, () =>
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
					attentionOwner: "orchestrator",
					decision: {
						...original,
						attentionOwner: receipt === "recovered" ? "maintainer" : undefined,
						published: receipt === "lost" ? undefined : original.published,
					},
					decisionPublished: receipt !== "lost",
				});
				yield* fixture.restart(
					Effect.gen(function* () {
						const restarted = yield* Fleet;
						const migrated = (yield* restarted.reconcile("one")).value;
						const decision = migrated.decision;
						expect(migrated.attentionOwner).toBe("orchestrator");
						expect(decision?.attentionOwner).toBe("orchestrator");
						expect(decision?.id).not.toBe(original.id);
						expect(migrated.supersededDecisions).toMatchObject([{ boardAcknowledged: true, published: original.published }]);
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
