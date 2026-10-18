import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { boardFileStory, statusBoundary } from "#test/boardFileStory.ts";
import { statusRecord } from "#test/status.ts";

boardFileStory.it(
	"replaces the generated view only when its content changes and leaves authored task bytes intact",
	[],
	function* ({ status: folder }) {
		yield* folder.publish([statusRecord("task.one")]);
		const before = folder.stat();
		yield* folder.publish([statusRecord("task.one")]);
		expect(folder.stat().ino).toBe(before.ino);
		expect(folder.stat().mtimeMs).toBe(before.mtimeMs);
		yield* folder.publish([statusRecord("task.one", "completed")]);
		expect(folder.read()).toContain("Stage: completed");
		expect(folder.taskSource()).toBe(folder.task);
	},
);

for (const location of ["directory", "file"] as const) {
	boardFileStory.it(`rejects a symlink at the status ${location} boundary`, [statusBoundary(location)], function* ({ status: folder }) {
		expect(yield* Effect.flip(folder.publish([statusRecord("task.one")]))).toMatchObject({ _tag: "BoardFailure" });
		expect(folder.outsideSource()).toBe("Keep this source");
	});
}

boardFileStory.it("refuses to replace an authored task occupying fleet/status.md", [statusBoundary("occupied")], function* ({ status: folder }) {
	expect(yield* Effect.flip(folder.publish([statusRecord("task.one")]))).toMatchObject({ _tag: "BoardFailure" });
	expect(folder.read()).toBe(folder.task);
});
