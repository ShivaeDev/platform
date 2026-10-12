import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { finishWorkers, prepareWork } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";
import { answerWorker, askWorker } from "#test/workerQuestion.ts";

const test = postgresTests("test");
const GOAL = "---\nid: goal.example\nkind: goal\n---\n# Example goal\n\n| Lane | Work |\n| --- | --- |\n";
function linked(source: string) {
	return source.replace("kind: task\n", "kind: task\nrelationships:\n  - kind: implements\n    target: goal.example\n");
}

for (const stage of ["preparation", "execution", "review"] as const) {
	test(`editing a linked goal and unrelated item during ${stage} leaves the current brief running`, () =>
		withFleetBoard({ reviewRunning: true }, (fixture, root, source) =>
			Effect.gen(function* () {
				const files = boardHttpFiles(root);
				files.write("one.md", linked(source));
				files.write("goal.md", GOAL);
				files.write("other.md", "---\nid: other\nkind: plan\n---\n# Unrelated plan\n");
				const fleet = yield* Fleet;
				const prepared = yield* prepareWork("one");
				if (stage !== "preparation") {
					yield* fleet.dispatch("one");
				}
				if (stage === "review") {
					finishWorkers(fixture);
					expect((yield* fleet.reconcile("one")).value.stage).toBe("reviewing");
				}
				files.write("goal.md", `${GOAL}| Active | Example |\n`);
				files.write("other.md", "---\nid: other\nkind: plan\n---\n# Updated plan\n");
				const running = yield* stage === "preparation" ? fleet.dispatch("one") : fleet.reconcile("one");
				expect(running.value.stage).toBe(stage === "review" ? "reviewing" : "executing");
				expect(running.value.boardRevision).toBe(prepared.value.boardRevision);
				expect(running.value.boardContext).toBe(linked(source));
				expect(running.value.decision).toBeUndefined();
				expect(fixture.decisions).toHaveLength(0);
			}),
		));
}

test("criteria edited during execution reach the same worker at its next terminal turn without adopting the old result", () =>
	withFleetBoard({}, (fixture, root, source) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			const dispatched = yield* fleet.dispatch("one");
			const current = source.replace("kind: task\n", "kind: task\ncriteria:\n  - id: persistence\n    text: Preserve transactions.\n");
			boardHttpFiles(root).write("one.md", current);
			expect((yield* fleet.reconcile("one")).value.stage).toBe("executing");
			finishWorkers(fixture);
			const continued = yield* fleet.reconcile("one");
			expect(continued.value.stage).toBe("executing");
			expect(continued.value.boardContext).toBe(current);
			expect(continued.value.result).toBeUndefined();
			expect(continued.value.attempts.at(-1)?.receipt?.sessionId).toBe(dispatched.value.attempts[0]?.receipt?.sessionId);
			expect(continued.value.attempts.at(-1)?.prompt).toContain(current);
			expect(continued.value.attempts.at(-1)?.prompt).toContain(source);
			expect(continued.value.decision).toBeUndefined();
			expect(fixture.launched).toHaveLength(1);
			finishWorkers(fixture);
			expect((yield* fleet.reconcile("one")).value.stage).toBe("completed");
		}),
	));

test("an answer recorded immediately before unrelated Board edits reaches the worker after restart", () =>
	withFleetBoard({}, (fixture, root, source) =>
		Effect.gen(function* () {
			const files = boardHttpFiles(root);
			files.write("one.md", linked(source));
			files.write("goal.md", GOAL);
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			const { decision } = yield* askWorker(fixture);
			const answer = yield* answerWorker(root, decision);
			files.write("goal.md", `${GOAL}| Queued | Other |\n`);
			files.write("other.md", "---\nid: other\nkind: report\n---\n# Bookkeeping\n");
			yield* fixture.restart(
				Effect.gen(function* () {
					const continued = yield* (yield* Fleet).reconcile("one");
					expect(continued.value.stage).toBe("executing");
					expect(continued.value.boardContext).toBe(linked(source));
					expect(continued.value.attempts.at(-1)?.prompt).toBe(answer.body);
					expect(continued.value.responses).toMatchObject([{ boardAcknowledged: true, responseId: answer.id }]);
				}),
			);
			expect(fixture.launched).toHaveLength(1);
		}),
	));

test("two answers from the same author continue the worker with the newest answer", () =>
	withFleetBoard({}, (fixture, root) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			const { decision } = yield* askWorker(fixture);
			yield* answerWorker(root, decision, "response.first", "answer", undefined, "orchestrator", "Use SQLite.");
			const newest = yield* answerWorker(root, decision, "response.second", "answer", undefined, "orchestrator");
			const continued = yield* fleet.reconcile("one");
			expect(continued.value.stage).toBe("executing");
			expect(continued.value.attempts.at(-1)?.prompt).toBe(newest.body);
			expect(continued.value.responses).toMatchObject([{ boardAcknowledged: true, responseId: newest.id }]);
			expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(2);
		}),
	));
