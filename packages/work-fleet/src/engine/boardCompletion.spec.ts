import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { expect } from "vitest";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { completionEdit } from "#test/completionEdit.ts";
import { mergedReviewGithub } from "#test/mergedReviewGithub.ts";
import { postgresTests } from "#test/postgres.ts";
import { reportWorker } from "#test/reportWorker.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";

const test = postgresTests("test");

for (const released of [false, true]) {
	test(`a synthetic merge marks ${released ? "released" : "completed"} Board work done without changing other bytes or its cycle`, () =>
		mergedCompletion(released));
}

function mergedCompletion(released: boolean) {
	return Effect.scoped(
		Effect.gen(function* () {
			const github = yield* mergedReviewGithub();
			github.state.failed = released;
			yield* withFleetBoard(
				{ ...github, checksQuery: (result) => github.checksQuery(result).pipe(Effect.map((checks) => ({ ...checks, repairPrompt: undefined }))) },
				(fixture, root, source) =>
					Effect.gen(function* () {
						const file = join(root, "one.md");
						const files = boardHttpFiles(root);
						const original = source.replace("kind: task", "kind: task\nstatus: planned # keep this comment\nnext_action: Implement the work.");
						files.write("one.md", original);
						yield* reportWorker(fixture);
						const fleet = yield* Fleet;
						yield* cycle;
						const waiting = yield* fleet.get("one");
						expect(waiting.value.stage).toBe("needs-human");
						github.state.status = "MERGED";
						yield* cycle;
						const done = yield* fleet.get("one");
						expect(done.value.stage).toBe(released ? "released" : "completed");
						expect(readFileSync(file, "utf8")).toBe(
							original.replace("status: planned", "status: done").replace("Implement the work.", '"Done; PR #7 merged."'),
						);
						expect(done.value.boardRevision).toBe(waiting.value.boardRevision);
						expect(done.value.boardContext).toBe(original);
						expect(done.value.history ?? []).toEqual(waiting.value.history ?? []);
						const stat = statSync(file);
						yield* cycle;
						expect(yield* fleet.get("one")).toEqual(done);
						expect(statSync(file).ino).toBe(stat.ino);
						expect(fixture.launched).toHaveLength(2);
					}),
			);
		}),
	);
}

test("a Board edit between the scheduler read and completion write survives and is marked done on a later pass", () =>
	Effect.scoped(
		Effect.gen(function* () {
			const github = yield* mergedReviewGithub();
			let edit: (() => void) | undefined;
			function applyEdit() {
				edit?.();
				edit = undefined;
			}
			yield* withFleetBoard(
				{
					...github,
					decorateBoard: (board) => completionEdit(board, applyEdit),
				},
				(fixture, root, source) =>
					Effect.gen(function* () {
						const file = join(root, "one.md");
						const files = boardHttpFiles(root);
						yield* reportWorker(fixture);
						yield* cycle;
						const fleet = yield* Fleet;
						const waiting = yield* fleet.get("one");
						const changed = `${source}\nA human added this note.\n`;
						edit = () => files.write("one.md", changed);
						github.state.status = "MERGED";
						yield* cycle;
						const done = yield* fleet.get("one");
						expect(done.value.stage).toBe("completed");
						expect(readFileSync(file, "utf8")).toBe(changed);
						yield* fixture.restart(cycle);
						expect(readFileSync(file, "utf8")).toBe(
							changed.replace("fleet: approved\n", 'fleet: approved\nstatus: done\nnext_action: "Done; PR #7 merged."\n'),
						);
						expect(yield* fleet.get("one")).toEqual(done);
						expect(done.value.boardRevision).toBe(waiting.value.boardRevision);
						expect(done.value.history ?? []).toEqual(waiting.value.history ?? []);
						expect(fixture.launched).toHaveLength(2);
					}),
			);
		}),
	));

test("a report completion marks only Board bookkeeping fields and preserves its recorded report and cycle", () =>
	withFleetBoard({}, (fixture, root, source) =>
		Effect.gen(function* () {
			const file = join(root, "one.md");
			const files = boardHttpFiles(root);
			const original = source.replace("fleet: approved", "fleet: approved\nfleet-deliverable: report");
			files.write("one.md", original);
			yield* reportWorker(fixture);
			yield* cycle;
			const fleet = yield* Fleet;
			const done = yield* fleet.get("one");
			expect(done.value.stage).toBe("completed");
			expect(done.value.report).toBeDefined();
			expect(readFileSync(file, "utf8")).toBe(
				original.replace("fleet-deliverable: report\n", 'fleet-deliverable: report\nstatus: done\nnext_action: "Done; report recorded."\n'),
			);
			yield* cycle;
			expect(yield* fleet.get("one")).toEqual(done);
			expect(done.value.history).toBeUndefined();
		}),
	));

test("no-change completion marks Board work done without a new cycle", () =>
	withFleetBoard({ noChange: true }, (fixture, root, source) =>
		Effect.gen(function* () {
			yield* reportWorker(fixture);
			yield* cycle;
			const fleet = yield* Fleet;
			const done = yield* fleet.get("one");
			expect(done.value.stage).toBe("completed");
			expect(readFileSync(join(root, "one.md"), "utf8")).toBe(
				source.replace("fleet: approved\n", 'fleet: approved\nstatus: done\nnext_action: "Done; no change needed."\n'),
			);
			yield* cycle;
			expect(yield* fleet.get("one")).toEqual(done);
			expect(done.value.history).toBeUndefined();
		}),
	));
