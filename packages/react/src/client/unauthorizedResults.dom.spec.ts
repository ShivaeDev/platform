import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { results, savedOrderThenUnauthorized, unauthorizedOnce } from "#test/resultStories.ts";

for (const kind of ["query", "action"] as const) {
	results.it(`an Unauthorized ${kind} result asks the session for one recheck`, [savedOrderThenUnauthorized(kind)], function* ({ rechecks, run }) {
		expect(yield* rechecks()).toEqual([]);

		yield* run();

		expect(yield* rechecks()).toEqual(["session-0"]);
	});

	results.it(
		`an Unauthorized ${kind} result keeps the last data beside its Unauthorized failure`,
		[savedOrderThenUnauthorized(kind)],
		function* ({ cause, data, run }) {
			yield* run();

			yield* outcomes({
				cause: [cause(), "failed with Unauthorized: Session expired"],
				data: [data(), "present: Saved order"],
			});
		},
	);

	results.it(
		`another Unauthorized ${kind} result asks the session's current recheck once more`,
		[unauthorizedOnce(kind)],
		function* ({ rechecks, run }) {
			expect(yield* rechecks()).toEqual(["session-0"]);

			yield* run();

			expect(yield* rechecks()).toEqual(["session-0", "session-1"]);
		},
	);

	results.it(
		`rendering again after an Unauthorized ${kind} result asks for no second recheck`,
		[unauthorizedOnce(kind)],
		function* ({ rechecks, rerender }) {
			yield* rerender();

			expect(yield* rechecks()).toEqual(["session-0"]);
		},
	);
}
