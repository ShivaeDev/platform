import { Array as Arr, Option } from "effect";
import { expect } from "vitest";
import { emptyJobsAdmin, emptyJobsStory } from "#test/emptyJobsStory.ts";
import { jobsRole, jobsStory } from "#test/jobsStory.ts";

jobsStory.it(
	"lists and looks up a failed scheduled run with its null payload",
	[jobsRole("admin")],
	function* ({ triggerSchedule, settle, failed, deadLettered, job }) {
		yield* triggerSchedule();
		yield* settle();
		const failures = yield* failed(10, undefined, "scheduled");
		const failedRun = Option.getOrThrow(Arr.head(failures.jobs));
		expect(failures.jobs).toEqual([
			expect.objectContaining({ data: null, output: { _tag: "WorkerRejected", id: 0 }, queue: "scheduled", state: "failed" }),
		]);
		const detail = Option.getOrThrow(yield* job(failedRun.id, "scheduled"));
		expect(detail).toEqual(failedRun);
		const copies = yield* deadLettered(10, undefined, "scheduled");
		expect(copies.jobs).toEqual([
			expect.objectContaining({ data: null, queue: "scheduled-dlq", sourceId: Option.some(failedRun.id), sourceOutput: detail.output }),
		]);
		expect(failures.next).toEqual(Option.none());
		expect(copies.next).toEqual(Option.none());
	},
);

emptyJobsStory.it("serves health through a page with no queues", [emptyJobsAdmin], function* ({ health }) {
	expect(yield* health()).toEqual({ activeTotal: 0, deadLetteredTotal: 0, failedTotal: 0, jobs: [], queuedTotal: 0, readyTotal: 0 });
});
