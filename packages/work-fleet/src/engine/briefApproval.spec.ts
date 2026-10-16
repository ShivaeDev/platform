import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { metadataParse } from "@shivaedev/work-board/metadata/parse.ts";
import { briefRevision } from "#board/briefRevision.ts";
import { Fleet } from "#fleet.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { finishWorkers, prepareWork } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { answerReport } from "#test/report.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";

const test = postgresTests("test");

test("an approved brief edit preserves the repair session and adopts its result", () =>
	withFleetBoard({ repairs: true, reviewRunning: true }, (fixture, root, source) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			const worker = yield* fleet.dispatch("one");
			finishWorkers(fixture);
			yield* fleet.reconcile("one");
			finishWorkers(fixture);
			const repairing = yield* fleet.reconcile("one");
			boardHttpFiles(root).write("one.md", `${source}\nRevised repair criteria.\n`);
			yield* fleet.reconcile("one");
			finishWorkers(fixture);
			const reviewed = yield* fleet.reconcile("one");
			expect(reviewed.value.stage).toBe("reviewing");
			expect(reviewed.value.result).toMatchObject({ head: "head-one-1", pr: "https://example.invalid/pr/one" });
			expect(reviewed.value.result?.head).not.toBe(repairing.value.result?.head);
			expect(reviewed.value.attempts[2]?.receipt?.sessionId).toBe(worker.value.attempts[0]?.receipt?.sessionId);
			expect(fixture.starts.filter((entry) => entry.access !== "read-only")).toHaveLength(1);
		}),
	));

test("approval retains an adopted PR and observes the old reviewer before reviewing the revised criteria", () =>
	withFleetBoard({ reviewRunning: true }, (fixture, root, source) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers(fixture);
			const original = yield* fleet.reconcile("one");
			const current = source.replace("Preserve review and required validation.", "Preserve review.");
			boardHttpFiles(root).write("one.md", current);
			yield* fleet.reconcile("one");
			const approved = yield* fleet.dispatch("one");
			expect(approved.value.result).toEqual(original.value.result);
			expect(approved.value.attempts).toEqual(original.value.attempts);
			expect((yield* fleet.reconcile("one")).value.stage).toBe("reviewing");
			expect(fixture.launched).toHaveLength(2);
			finishWorkers(fixture);
			const obsolete = yield* fleet.reconcile("one");
			expect(obsolete.value.review).toBeUndefined();
			expect(obsolete.value.checks).toBeUndefined();
			const revised = yield* fleet.reconcile("one");
			expect(revised.value.stage).toBe("reviewing");
			expect(revised.value.attempts.at(-1)?.prompt).toContain(current.trim());
			expect(revised.value.result).toEqual(original.value.result);
			expect(fixture.starts.filter((entry) => entry.access !== "read-only")).toHaveLength(1);
			expect(revised.value.history ?? []).toEqual([]);
		}),
	));

for (const action of ["dispatch", "retry"] as const) {
	test(`${action} approves edited criteria during execution and retains the worker for review and repair`, () =>
		withFleetBoard({ repairs: true, reviewRunning: true }, (fixture, root, source) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* prepareWork("one");
				const worker = yield* fleet.dispatch("one");
				const current = `${source}\nUpdated acceptance criteria.\n`;
				boardHttpFiles(root).write("one.md", current.replace("kind: task", "kind: task\nowner: human"));
				boardHttpFiles(root).move("one.md", "revised.md");
				const stopped = yield* fleet.reconcile("one");
				const decision = stopped.value.decision;
				if (decision?.published === undefined) {
					return yield* Effect.die("Missing decision");
				}
				boardHttpFiles(root).write("revised.md", current);
				const approved =
					action === "dispatch"
						? yield* fleet.dispatch("one")
						: yield* fleet.resolve("one", decision.id, answerReport(root, decision.published, "retry"));
				expect(approved.value).toMatchObject({ boardContext: current, boardRevision: briefRevision(metadataParse(current)), stage: "executing" });
				expect(approved.value.boardSourcePath).not.toBe(worker.value.boardSourcePath);
				expect(approved.value.boardSourcePath).toMatch(/revised\.md$/u);
				expect(approved.value.prompt).toContain(current);
				expect(approved.value.attempts.map(({ briefSteers: _steers, ...attempt }) => attempt)).toEqual(stopped.value.attempts);
				expect(approved.value.attempts[0]?.briefSteers).toHaveLength(1);
				expect(approved.value.history ?? []).toEqual([]);
				expect(approved.value.decision).toBeUndefined();
				expect(approved.value.supersededDecisions).toMatchObject([{ boardAcknowledged: true, published: decision.published }]);
				expect((yield* fleet.reconcile("one")).value.stage).toBe("executing");
				finishWorkers(fixture);
				const reviewing = yield* fixture.restart(Fleet.pipe(Effect.flatMap((resumed) => resumed.reconcile("one"))));
				expect(reviewing.value.stage).toBe("reviewing");
				expect(reviewing.value.result).toMatchObject({ kind: "change", pr: "https://example.invalid/pr/one" });
				expect(reviewing.value.attempts[0]?.receipt).toEqual(worker.value.attempts[0]?.receipt);
				expect(reviewing.value.attempts[1]?.prompt).toContain(current.trim());
				expect(fixture.starts.filter((entry) => entry.access !== "read-only")).toHaveLength(1);
				finishWorkers(fixture);
				const repairing = yield* fleet.reconcile("one");
				expect(repairing.value.stage).toBe("executing");
				expect(repairing.value.attempts.at(-1)).toMatchObject({
					receipt: { sessionId: worker.value.attempts[0]?.receipt?.sessionId },
					role: "repair",
				});
				expect(repairing.value.result).toEqual(reviewing.value.result);
				expect(fixture.starts.filter((entry) => entry.access !== "read-only")).toHaveLength(1);
				expect(fixture.archived).toEqual([]);
			}),
		));
}

test("retry of a context decision cannot approve a subsequent edit", () =>
	withFleetBoard({}, (_fixture, root, source) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			const files = boardHttpFiles(root);
			files.write("one.md", `${source.replace("kind: task", "kind: task\nowner: human")}\nFirst criteria edit.\n`);
			const decision = (yield* fleet.reconcile("one")).value.decision;
			if (decision?.published === undefined) {
				return yield* Effect.die("Missing decision");
			}
			files.write("one.md", `${source}\nSecond criteria edit.\n`);
			const denied = yield* fleet.resolve("one", decision.id, answerReport(root, decision.published, "retry")).pipe(Effect.result);
			expect(denied._tag).toBe("Failure");
			expect((yield* fleet.get("one")).value.boardContext).toBe(source);
			expect((yield* fleet.get("one")).value.responses).toBeUndefined();
		}),
	));
