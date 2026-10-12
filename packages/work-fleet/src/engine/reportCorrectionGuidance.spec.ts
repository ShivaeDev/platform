import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { withEngine } from "#test/engine.ts";
import { PR, resultFixture } from "#test/githubResult.ts";
import { postgresTests } from "#test/postgres.ts";
import { startWorkerReport, workerReportReply } from "#test/workerReport.ts";

describe("report correction after worker guidance changes", () => {
	const test = postgresTests("test");
	for (const nextGuidance of ["Follow changed synthetic conventions.", undefined]) {
		test(`a second malformed report needs a human after restart with guidance ${nextGuidance === undefined ? "removed" : "changed"}`, () =>
			withEngine({ resultQuery: resultFixture().adopt, workerGuidance: "Follow original synthetic conventions." }, (fixture) =>
				Effect.gen(function* () {
					const { followUp } = yield* startWorkerReport(fixture, "Missing report");
					expect(followUp.value.attempts.at(-1)?.prompt).toContain("Follow original synthetic conventions.");
					yield* workerReportReply(fixture, followUp, `FLEET_PR: ${PR}`);
					const turns = fixture.settings.filter((call) => call.call === "turn").length;
					yield* fixture.restart(
						Effect.gen(function* () {
							const fleet = yield* Fleet;
							const blocked = yield* fleet.reconcile("one");
							expect(blocked.value.stage).toBe("needs-human");
							expect(blocked.value.decision?.reason).toContain("FLEET_HEAD");
							expect(blocked.value.attempts).toHaveLength(2);
							expect(blocked.value.result).toBeUndefined();
							expect((yield* fleet.reconcile("one")).value.attempts).toHaveLength(2);
						}),
						({ workerGuidance, ...policy }) => {
							expect(workerGuidance).toBe("Follow original synthetic conventions.");
							return nextGuidance === undefined ? policy : { ...policy, workerGuidance: nextGuidance };
						},
					);
					expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(turns);
					expect(fixture.decisions).toHaveLength(1);
					expect(fixture.reviews).toHaveLength(0);
				}),
			));
	}
});
