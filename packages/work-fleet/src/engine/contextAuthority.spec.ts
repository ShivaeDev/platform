import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { prepareWork } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";
import { answerWorker, askWorker } from "#test/workerQuestion.ts";

const test = postgresTests("test");

test("unapproved work retains an open answer without launching another turn", () =>
	withFleetBoard({}, (fixture, root, source) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			const { decision } = yield* askWorker(fixture);
			const answer = yield* answerWorker(root, decision);
			const current = source.replace("fleet: approved", "fleet: draft");
			boardHttpFiles(root).write("one.md", current);
			const held = yield* fleet.reconcile("one");
			expect(held.value.stage).toBe("needs-human");
			expect(held.value.blocker).toContain("no longer approved");
			expect(held.value.responses).toBeUndefined();
			expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(1);
			boardHttpFiles(root).write("one.md", source);
			const continued = yield* fleet.reconcile("one");
			expect(continued.value.stage).toBe("executing");
			expect(continued.value.attempts.at(-1)?.prompt).toContain(answer.body);
		}),
	));
