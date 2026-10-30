import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { baselineSaved, openPr, watching } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

for (const operation of ["read", "write", "rename"] as const) {
	watch.it(
		`a refused state file ${operation} fails the poll and keeps PR 1's last saved snapshot`,
		[openPr(1), watching(1), baselineSaved],
		function* ({ fileOperationFails, lastPoll, merges, poll, savedSnapshot }) {
			yield* merges(1);
			yield* fileOperationFails(operation);

			yield* poll();

			yield* outcomes({
				"poll": [lastPoll(), `failed: PermissionDenied: FileSystem.${operation}`],
				"saved snapshot of PR 1": [savedSnapshot(1), "open, auto-merge"],
			});
		},
	);
}

watch.it("the state file is readable and writable only by its owner", [openPr(1), watching(1)], function* ({ poll, stateFileMode }) {
	yield* poll();

	expect(yield* stateFileMode()).toBe("rw-------");
});

watch.it(
	"a transport failure fails the poll without inferring PR 1's merge",
	[openPr(1), watching(1), baselineSaved],
	function* ({ lastPoll, merges, poll, printed, savedSnapshot, transportFails }) {
		yield* merges(1);
		yield* transportFails();

		yield* poll();

		yield* outcomes({
			"poll": [lastPoll(), "failed: GitHub network error at /repos/acme/project/git/matching-refs/heads/gh-readonly-queue/"],
			"printed": [printed(), []],
			"saved snapshot of PR 1": [savedSnapshot(1), "open, auto-merge"],
		});
	},
);
