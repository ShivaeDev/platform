import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { SessionFailure } from "#session/schema.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { prepareWork } from "#test/engine.ts";
import { storageDatabaseUrl } from "#test/storage.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";

for (const rejectedCall of ["session", "turn"] as const) {
	it.effect.skipIf(storageDatabaseUrl === undefined)(
		`a queued initial ${rejectedCall} stops before resubmission when its authored brief changes`,
		() => {
			let now = 100;
			let reject = true;
			const launch = { model: "initial-model" };
			return withFleetBoard(
				{
					launch,
					now: () => now,
					submissionFailure: (call) =>
						reject && call === rejectedCall ? new SessionFailure({ message: "Request queue is full", reason: "rejected" }) : undefined,
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
						expect(accepted.stage).toBe("needs-human");
						expect(accepted.decision?.reason).toBe("Board context changed");
						expect(accepted.boardContext).toBe(source);
						expect(accepted.launchRetry).toBeUndefined();
						expect(attempt).toEqual(failed);
						expect(accepted.attempts).toEqual(queued.attempts);
						expect(fixture.launched).toHaveLength(1);
						expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(rejectedCall === "turn" ? 1 : 0);
					}),
			);
		},
	);
}
