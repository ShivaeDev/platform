import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { workerGuidance } from "#test/engineLifecycleTraits.ts";
import { engine } from "#test/engineStory.ts";
import { workerReportsCanBeAdopted } from "#test/engineWorkerReportTraits.ts";
import { PR } from "#test/githubResult.ts";

describe("report correction after worker guidance changes", () => {
	for (const nextGuidance of ["Follow changed synthetic conventions.", undefined]) {
		engine.it(
			`a second malformed report needs a human after restart with guidance ${nextGuidance === undefined ? "removed" : "changed"}`,
			[workerReportsCanBeAdopted(), workerGuidance("Follow original synthetic conventions.")],
			function* ({ workerReportReply, fleet, prepareWork, afterRestart, publishedDecisions, providerCalls, reviewedHeads }) {
				yield* prepareWork("one");
				const dispatched = yield* fleet.dispatch("one");
				yield* workerReportReply(dispatched, "Missing report");
				const followUp = yield* fleet.reconcile("one");
				expect(followUp.value.attempts.at(-1)?.prompt).toContain("Follow original synthetic conventions.");
				yield* workerReportReply(followUp, `FLEET_PR: ${PR}`);
				const turns = providerCalls().filter((call) => call.call === "turn").length;
				yield* afterRestart(
					Effect.gen(function* () {
						const restarted = yield* Fleet;
						const blocked = yield* restarted.reconcile("one");
						expect(blocked.value.step).toBe("waiting");
						expect(blocked.value.decision?.reason).toContain("FLEET_HEAD");
						expect(blocked.value.attempts).toHaveLength(2);
						expect(blocked.value.result).toBeUndefined();
						expect((yield* restarted.reconcile("one")).value.attempts).toHaveLength(2);
					}),
					({ workerGuidance: _workerGuidance, ...policy }) => (nextGuidance === undefined ? policy : { ...policy, workerGuidance: nextGuidance }),
				);
				expect(providerCalls().filter((call) => call.call === "turn")).toHaveLength(turns);
				expect(publishedDecisions()).toHaveLength(1);
				expect(reviewedHeads()).toHaveLength(0);
			},
		);
	}
});
