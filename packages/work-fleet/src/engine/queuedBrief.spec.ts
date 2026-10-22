import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { SessionFailure } from "#session/schema.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { prepareWork } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";

for (const rejectedCall of ["session", "turn"] as const) {
	postgresTests("test")(`a queued initial ${rejectedCall} retries the approved edited brief`, () => {
		let now = 100;
		let reject = true;
		const launch = { model: "initial-model" };
		return withFleetBoard(
			{
				launch,
				now: () => now,
				submissionFailure: (call) =>
					reject && call === rejectedCall
						? new SessionFailure({ code: "session-queue-full", message: "Request queue is full", reason: "rejected" })
						: undefined,
				workerGuidance: "Follow synthetic worker conventions.",
			},
			(fixture, root, source) =>
				Effect.gen(function* () {
					const fleet = yield* Fleet;
					yield* prepareWork("one");
					yield* fleet.dispatch("one");
					const queued = (yield* fleet.get("one")).value;
					const failed = queued.attempts.at(-1);
					const current = `${source}\nNew approved criteria.\n`;
					boardHttpFiles(root).write("one.md", current);
					launch.model = "new-host-model";
					reject = false;
					now = 30_099;
					yield* fixture.restart(cycle);
					expect(fixture.launched).toHaveLength(1);
					now = 30_100;
					yield* fixture.restart(cycle);
					const accepted = (yield* fleet.get("one")).value;
					const attempt = accepted.attempts.at(-1);
					expect(accepted.step).toBe("working");
					expect(accepted.decision).toBeUndefined();
					expect(accepted.boardContext).toBe(current);
					expect(accepted.launchRetry).toBeUndefined();
					expect(attempt).toMatchObject({ prompt: expect.stringContaining(current), settings: failed?.settings, status: "accepted" });
					expect(accepted.attempts.slice(0, -1)).toEqual(queued.attempts);
					expect(fixture.launched).toHaveLength(rejectedCall === "session" ? 2 : 1);
					expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(rejectedCall === "turn" ? 2 : 1);
				}),
		);
	});
}
