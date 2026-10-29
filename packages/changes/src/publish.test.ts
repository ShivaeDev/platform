import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { changes, failedPublishDies, type SinkFailure, sinkFails } from "#test/kit.ts";

const failures: ReadonlyArray<readonly [SinkFailure, string]> = [
	["a failed Effect", "bus unavailable"],
	["a defect", "listener threw"],
	["a synchronous throw", "emit threw synchronously"],
];

for (const [failure, reason] of failures) {
	changes.it(
		`when the sink fails with ${failure} after ada's transaction commits, her order stays committed and the failure is logged with its cause`,
		[sinkFails(failure, reason)],
		function* ({ saveOrder, orderEnding, committedRows, loggedErrors }) {
			yield* saveOrder("ada");

			yield* outcomes({
				"committed rows": [committedRows(), ["ada's order"]],
				"how the transaction ended": [orderEnding(), "committed"],
				"logged errors": [
					loggedErrors(),
					[
						{
							cause: expect.stringContaining(reason),
							changes: 1,
							channel: "Test",
							message: expect.stringContaining("the committed result stands"),
						},
					],
				],
			});
		},
	);

	changes.it(
		`when failed publishes die and the sink fails with ${failure} after ada's transaction commits, the transaction dies with that cause, her order stays committed and nothing is logged`,
		[sinkFails(failure, reason), failedPublishDies()],
		function* ({ saveOrder, orderEnding, orderDefect, committedRows, loggedErrors }) {
			yield* saveOrder("ada");

			yield* outcomes({
				"committed rows": [committedRows(), ["ada's order"]],
				"how the transaction ended": [orderEnding(), "died"],
				"logged errors": [loggedErrors(), []],
				"the defect": [orderDefect(), expect.stringContaining(reason)],
			});
		},
	);
}
