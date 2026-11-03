import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { boardFileStory, withReportWork } from "#test/boardFileStory.ts";
import { REPORT_OBSERVATION } from "#test/reportPublicationVerbs.ts";

boardFileStory.it("concurrent report retention recovers the first completed output", [withReportWork], function* ({ files }) {
	const work = yield* files.work("one");
	expect(yield* files.savedReport(work, REPORT_OBSERVATION)).toBeUndefined();

	const [first, second] = yield* Effect.all(
		[files.retainReport(work, REPORT_OBSERVATION, "First findings"), files.retainReport(work, REPORT_OBSERVATION, "Other findings")],
		{ concurrency: "unbounded" },
	);

	expect(["First findings", "Other findings"]).toContain(first.output);
	expect(second).toEqual(first);
	expect(yield* files.savedReport(work, REPORT_OBSERVATION)).toEqual(first);
});

boardFileStory.it(
	"a retained report keeps its first output when later retention supplies different findings",
	[withReportWork],
	function* ({ files }) {
		const work = yield* files.work("one");
		yield* files.retainReport(work, REPORT_OBSERVATION, "First findings");

		const retained = yield* files.retainReport(work, REPORT_OBSERVATION, "Changed findings");

		expect(retained.output).toBe("First findings");
		expect(yield* files.savedReport(work, REPORT_OBSERVATION)).toEqual(retained);
	},
);
