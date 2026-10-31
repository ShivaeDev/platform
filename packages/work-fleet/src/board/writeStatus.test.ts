import { expect } from "@effect/vitest";
import { boardFileStory, statusBoundary } from "#test/boardFileStory.ts";
import { statusRecord } from "#test/status.ts";

boardFileStory.it("republishing unchanged status leaves the status file untouched", [], function* ({ status }) {
	yield* status.publish([statusRecord("task.one")]);
	const first = yield* status.identity();

	yield* status.publish([statusRecord("task.one")]);

	expect(yield* status.identity()).toEqual(first);
});

boardFileStory.it("a changed record replaces the status with its new stage", [], function* ({ status }) {
	yield* status.publish([statusRecord("task.one")]);
	expect(yield* status.published()).not.toContain("Stage: done");

	yield* status.publish([statusRecord("task.one", "done")]);

	expect(yield* status.published()).toContain("Stage: done");
});

boardFileStory.it("publishing status leaves the authored task file unchanged", [], function* ({ status }) {
	yield* status.publish([statusRecord("task.one", "done")]);

	expect(yield* status.taskSource()).toBe(status.task);
});

for (const location of ["directory", "file"] as const) {
	boardFileStory.it(
		`status publication through a symlinked ${location} is refused and the outside file is kept`,
		[statusBoundary(location)],
		function* ({ status }) {
			const published = yield* status.publish([statusRecord("task.one")]);

			expect(published).toMatch(/^Board failure: /u);
			expect(yield* status.outsideSource()).toBe("Keep this source");
		},
	);
}

boardFileStory.it(
	"status publication over an authored task at fleet/status.md is refused and the task is kept",
	[statusBoundary("occupied")],
	function* ({ status }) {
		const published = yield* status.publish([statusRecord("task.one")]);

		expect(published).toMatch(/^Board failure: /u);
		expect(yield* status.published()).toBe(status.task);
	},
);
