import { expect } from "@effect/vitest";
import { Deferred, Effect, Fiber } from "effect";
import { views } from "#engine/views.ts";
import { Fleet } from "#fleet.ts";
import { renderStatus } from "#host/status.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { finishWorkers, prepareWork } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";

postgresTests("test", "isolated")("an interrupted steer keeps its durable intent and revised review without replay", function* () {
	const entered = yield* Deferred.make<void>();
	let calls = 0;
	yield* withFleetBoard(
		{
			decorateTransport: (transport) => ({
				...transport,
				steer: () =>
					Effect.gen(function* () {
						calls += 1;
						yield* Deferred.succeed(entered, undefined);
						yield* Effect.never;
					}),
			}),
			reviewRunning: true,
		},
		(fixture, root, source) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				const current = `${source}\nChanged scope.\n`;
				boardHttpFiles(root).write("one.md", current);
				const approving = yield* fleet.reconcile("one").pipe(Effect.forkChild);
				yield* Deferred.await(entered);
				yield* Fiber.interrupt(approving);
				const pending = yield* fleet.get("one");
				expect(pending.value.boardContext).toBe(current);
				expect(pending.value.attempts[0]?.briefSteers).toEqual([{ requestedAt: 100, revision: pending.value.boardRevision }]);
				expect(renderStatus(views([pending.value]))).toContain("delivery unconfirmed");
				yield* fixture.restart(Fleet.pipe(Effect.flatMap((resumed) => resumed.reconcile("one"))));
				expect(calls).toBe(1);
				finishWorkers(fixture);
				const review = yield* fleet.reconcile("one");
				expect(review.value.attempts.at(-1)?.prompt).toContain(current.trim());
			}),
	);
});

postgresTests("test")("a provider without steering records the failure and keeps revised review", () =>
	withFleetBoard(
		{
			decorateTransport: ({ steer: _steer, ...transport }) => transport,
			reviewRunning: true,
		},
		(fixture, root, source) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				const current = `${source}\nChanged scope.\n`;
				boardHttpFiles(root).write("one.md", current);
				const approved = yield* fleet.reconcile("one");
				expect(approved.value.stage).toBe("executing");
				expect(renderStatus(views([approved.value]))).toContain("failed: Provider does not support steering");
				finishWorkers(fixture);
				const review = yield* fleet.reconcile("one");
				expect(review.value.attempts.at(-1)?.prompt).toContain(current.trim());
			}),
	),
);

postgresTests("test")("a repair turn can receive a revision already steered into its worker turn", () =>
	withFleetBoard({ repairs: true, reviewRunning: true }, (fixture, root, source) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			const worker = yield* fleet.dispatch("one");
			const current = `${source}\nRevised scope.\n`;
			const files = boardHttpFiles(root);
			files.write("one.md", current);
			yield* fleet.reconcile("one");
			files.write("one.md", source);
			yield* fleet.reconcile("one");
			finishWorkers(fixture);
			yield* fleet.reconcile("one");
			finishWorkers(fixture);
			const repair = yield* fleet.reconcile("one");
			expect(repair.value.attempts.at(-1)?.role).toBe("repair");
			files.write("one.md", current);
			const revised = yield* fleet.reconcile("one");
			expect(fixture.steered).toHaveLength(3);
			expect(fixture.steered.at(-1)?.receipt).toEqual(repair.value.attempts.at(-1)?.receipt);
			expect(fixture.steered.at(-1)?.receipt.turnId).not.toBe(worker.value.attempts[0]?.receipt?.turnId);
			expect(revised.value.attempts.at(-1)?.briefSteers).toHaveLength(1);
		}),
	),
);

postgresTests("test")("an edit observed after worker completion reaches review without steering the completed turn", () =>
	withFleetBoard({ reviewRunning: true }, (fixture, root, source) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers(fixture);
			const current = `${source}\nRevised scope.\n`;
			boardHttpFiles(root).write("one.md", current);
			const reviewed = yield* fleet.reconcile("one");
			expect(fixture.steered).toEqual([]);
			expect(reviewed.value.attempts.at(-1)?.prompt).toContain(current.trim());
		}),
	),
);
