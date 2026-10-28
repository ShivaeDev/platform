import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { nameTaken, rejections, storageError, storageUnavailable } from "#test/rpc/rejections.ts";

rejections.it("an anonymous save of a taken name is rejected as a conflict on the name field", [nameTaken], function* ({ rejection, save }) {
	yield* save();

	expect(yield* rejection()).toBe("Conflict on name: Name is taken");
});

rejections.it(
	"an anonymous save while storage is unavailable is rejected as service unavailable",
	[storageUnavailable],
	function* ({ rejection, save }) {
		yield* save();

		expect(yield* rejection()).toBe("ServiceUnavailable: Storage is unavailable");
	},
);

for (const fault of ["fails", "crashes"] as const) {
	rejections.it(
		`when storage ${fault} with a secret, an anonymous caller gets a bare internal server error`,
		[storageError(fault, "password=private-value")],
		function* ({ rejection, rejectionCause, rejectionMentions, save }) {
			yield* save();

			yield* outcomes({
				"the caller's rejection": [rejection(), "InternalServerError: Internal server error"],
				"the cause sent to the caller": [rejectionCause(), "none"],
				"the secret in the caller's answer": [rejectionMentions("private-value"), false],
			});
		},
	);

	rejections.it(
		`when storage ${fault} with a secret, the server trace keeps the original storage error`,
		[storageError(fault, "password=private-value")],
		function* ({ save, tracedCause }) {
			yield* save();

			expect(yield* tracedCause()).toEqual(["Storage failed with password=private-value"]);
		},
	);
}
