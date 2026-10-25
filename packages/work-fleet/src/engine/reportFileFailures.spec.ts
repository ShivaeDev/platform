import { expect } from "vitest";
import { engine } from "#test/engineStory.ts";
import { reportFileFailure } from "#test/reportFileFailure.ts";

for (const [scenario, cause] of [
	["escape", "Attachment path escapes scratch folder"],
	["oversized-payload", "Report payload exceeds size limit"],
	["changed-file", "Attachment changed after validation"],
] as const) {
	engine.it(
		`parks ${scenario} with the file and its cause`,
		[reportFileFailure(scenario)],
		function* ({ oversizeReportPayload, reportFailurePath, fleet, prepareWork, workerReports, launches }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			workerReports(`Findings.\nFLEET_HEAD: ${"a".repeat(40)}`);
			if (scenario === "oversized-payload") {
				yield* oversizeReportPayload();
			}
			const parked = (yield* fleet.reconcile("one")).value;
			const stored = (yield* fleet.get("one")).value;
			expect(parked.step).toBe("waiting");
			expect(parked.decision?.reason).toBe(`${reportFailurePath()}: ${cause}`);
			expect(stored.decision?.reason).toBe(`${reportFailurePath()}: ${cause}`);
			expect(parked.report).toBeUndefined();
			expect(launches()).toHaveLength(1);
		},
	);
}
