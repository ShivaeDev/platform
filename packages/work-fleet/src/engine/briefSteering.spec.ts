import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { views } from "#engine/views.ts";
import { Fleet } from "#fleet.ts";
import { renderStatus } from "#host/renderStatus.ts";
import { taskPrompt } from "#prompt/task.ts";
import { SessionFailure } from "#session/schema.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { finishWorkers, prepareWork } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";

for (const failure of [false, true]) {
	postgresTests("test")(`approved edits steer once per running turn and retain revised review after restart: failure=${failure}`, () =>
		briefSteering(failure),
	);
}

function briefSteering(failure: boolean) {
	let calls = 0;
	return withFleetBoard(
		{
			decorateTransport: (transport) => ({
				...transport,
				steer: (receipt, prompt) =>
					Effect.gen(function* () {
						calls += 1;
						if (failure) {
							return yield* new SessionFailure({ message: "Steer unavailable", reason: "unavailable" });
						}
						yield* transport.steer?.(receipt, prompt) ?? Effect.die("Missing synthetic steer");
					}),
			}),
			reviewRunning: true,
		},
		(fixture, root, source) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				const original = source.replace("kind: task", "kind: task\ncriteria: [{ id: behavior, text: Original behavior. }]");
				const current = original.replace("Original behavior.", "Changed behavior.");
				const files = boardHttpFiles(root);
				files.write("one.md", original);
				yield* prepareWork("one");
				const worker = yield* fleet.dispatch("one");
				files.write("one.md", current);
				const approved = yield* fleet.reconcile("one");
				expect(approved.value).toMatchObject({ boardContext: current, prompt: current, step: "working" });
				expect(approved.value.attempts[0]?.receipt).toEqual(worker.value.attempts[0]?.receipt);
				expect(approved.value.attempts[0]?.briefSteers).toEqual([
					expect.objectContaining(failure ? { error: "Steer unavailable" } : { steeredAt: 100 }),
				]);
				expect(renderStatus(views([approved.value]))).toContain(
					failure ? "failed: Steer unavailable" : "brief edit steered 1970-01-01T00:00:00.100Z",
				);
				if (!failure) {
					expect(fixture.steered).toEqual([
						{
							prompt: expect.stringContaining("Criterion behavior: Original behavior. -> Changed behavior."),
							receipt: worker.value.attempts[0]?.receipt,
						},
					]);
					expect(fixture.steered[0]?.prompt).toContain(`Full new brief:\n\n${current}`);
				}
				yield* fixture.restart(Fleet.pipe(Effect.flatMap((resumed) => resumed.reconcile("one"))));
				yield* fleet.reconcile("one");
				expect(calls).toBe(1);
				files.write("one.md", original);
				yield* fleet.reconcile("one");
				files.write("one.md", current);
				yield* fleet.reconcile("one");
				expect(calls).toBe(2);
				finishWorkers(fixture);
				const reviewing = yield* fleet.reconcile("one");
				expect(reviewing.value.step).toBe("reviewing");
				expect(reviewing.value.attempts.at(-1)?.prompt).toContain(taskPrompt(current));
				files.write("one.md", `${current}\nChanged during review.\n`);
				yield* fleet.reconcile("one");
				expect(calls).toBe(2);
			}),
	);
}
