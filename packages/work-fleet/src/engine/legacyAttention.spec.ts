import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { isolatedEngine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";

for (const receipt of ["lost", "known", "recovered"] as const) {
	isolatedEngine.it(
		`legacy routing preserves the original question with a ${receipt} publication receipt without changing maintainer routing`,
		[markdownWork()],
		function* ({
			readBoardWork,
			replaceStoredRecord,
			answerWorker,
			upgradeStorage,
			launches,
			providerCalls,
			workerReports,
			prepareWork,
			restart,
			fleet,
		}) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			workerReports("FLEET_MAINTAINER_QUESTION: Choose the storage.");
			const stopped = (yield* fleet.reconcile("one")).value;
			const original = stopped.decision;
			if (original?.published === undefined) {
				return yield* Effect.die("Missing original question");
			}
			const publication = original.published;
			const source = readBoardWork(publication.sourcePath);
			yield* replaceStoredRecord({
				...stopped,
				attentionOwner: undefined,
				decision: {
					...original,
					attentionOwner: receipt === "recovered" ? "maintainer" : undefined,
					code: undefined,
					published: receipt === "lost" ? undefined : original.published,
				},
				decisionPublished: receipt !== "lost",
			});
			yield* upgradeStorage();
			yield* restart();
			const restarted = fleet;
			const migrated = (yield* restarted.reconcile("one")).value;
			const decision = migrated.decision;
			expect(migrated.attentionOwner).toBe("maintainer");
			expect(decision?.attentionOwner).toBe("maintainer");
			expect(decision?.id).toBe(original.id);
			expect(decision?.code).toBe("worker-question");
			expect(migrated.supersededDecisions).toBeUndefined();
			expect(readBoardWork(publication.sourcePath)).toBe(source);
			if (decision === undefined) {
				return yield* Effect.die("Missing migrated question");
			}
			const answer = yield* answerWorker(decision);
			expect((yield* restarted.resolve("one", decision.id, answer.id)).value.step).toBe("working");
			expect(launches()).toHaveLength(1);
			expect(providerCalls().filter((call) => call.call === "turn")).toHaveLength(2);
		},
	);
}

for (const migrate of [false, true]) {
	isolatedEngine.it(
		`adopts an answer recorded before upgrade ${migrate ? "after SQL migration" : "before any reassignment"}`,
		[markdownWork()],
		function* ({ replaceStoredRecord, answerWorker, upgradeStorage, providerCalls, workerReports, prepareWork, restart, fleet }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			workerReports("FLEET_MAINTAINER_QUESTION: Choose the storage.");
			const stopped = (yield* fleet.reconcile("one")).value;
			const original = stopped.decision;
			if (original?.published === undefined) {
				return yield* Effect.die("Missing original question");
			}
			const answer = yield* answerWorker(original);
			yield* replaceStoredRecord({
				...stopped,
				attentionOwner: migrate ? undefined : "orchestrator",
				decision: { ...original, attentionOwner: undefined, code: undefined },
			});
			if (migrate) {
				yield* upgradeStorage();
			}
			yield* restart();
			const restarted = fleet;
			const continued = (yield* restarted.reconcile("one")).value;
			expect(continued.step).toBe("working");
			expect(continued.responses).toMatchObject([{ boardAcknowledged: true, decisionId: original.id, responseId: answer.id }]);
			expect(continued.attempts.at(-1)?.prompt).toBe(answer.body);
			expect(continued.supersededDecisions).toBeUndefined();
			expect(providerCalls().filter((call) => call.call === "turn")).toHaveLength(2);
		},
	);
}
