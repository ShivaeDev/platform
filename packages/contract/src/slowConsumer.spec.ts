import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { slowConsumer } from "#test/slowConsumer.ts";

for (const edits of [257, 1000]) {
	slowConsumer.it(
		`a stalled consumer retains one Resync after ${edits} edits and recovers the newest notes`,
		[],
		function* ({ received, renameRepeatedly, resume, shown, untilReRead }) {
			expect(yield* shown()).toEqual(["One", "Other"]);

			yield* renameRepeatedly(edits);

			yield* outcomes({
				"hints before resuming": [received(), ["resync"]],
				"notes while stalled": [shown(), ["One", "Other"]],
			});

			yield* resume();
			yield* untilReRead();

			yield* outcomes({
				"hints including the entire pending queue": [received(), ["resync", "resync"]],
				"newest notes": [shown(), [`Edit ${edits}`, "Other"]],
			});
		},
	);
}
