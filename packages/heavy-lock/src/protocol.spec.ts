import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { lockStory, referenceLock, running } from "#test/kit.ts";

for (const startedAtMs of ["last", "first"] as const) {
	lockStory.it(
		`publishing the reference holder with startedAtMs as its ${startedAtMs} field writes the reference file byte for byte`,
		[],
		function* ({ lock, protocol }) {
			yield* protocol.publishes({ startedAtMs });

			expect(yield* lock.contents()).toBe(protocol.reference);
		},
	);
}

lockStory.it("reading the reference file gives back the reference holder", [referenceLock("the reference pid")], function* ({ protocol }) {
	expect(yield* protocol.recordedHolder()).toEqual(protocol.referenceHolder);
});

lockStory.it(
	"waiter's attempt on a reference file naming this live process is blocked by the reference holder and leaves the file as it was",
	[referenceLock("this process")],
	function* ({ lock }) {
		const before = yield* lock.contents();

		yield* lock.tries("waiter");

		yield* outcomes({
			"lock file": [lock.contents(), before],
			"waiter's answer": [lock.answerOf("waiter"), "blocked by the reference holder"],
		});
	},
);

lockStory.it("ready's lock records ready's command and this process's pid, start time and directory", [running("ready")], function* ({ protocol }) {
	expect(yield* protocol.recordedHolder()).toMatchObject({ command: "pnpm ready", ...(yield* protocol.thisProcess()) });
});
