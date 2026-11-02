import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { requiredName } from "#test/forms.ts";
import { asyncNames, passwords } from "#test/schemaMessages.ts";

passwords.it(
	"submitting mismatched passwords keeps their refinement message in feedback and the invalid result",
	[],
	function* ({ feedbackAt, submissionMessage, submit }) {
		expect(yield* feedbackAt([])).toBeUndefined();

		yield* submit();

		yield* outcomes([
			["whole-form feedback", () => feedbackAt([]), "Passwords must match"],
			["submission message", () => submissionMessage(), "Passwords must match"],
		]);
	},
);

passwords.it("matching the passwords clears the whole-form refinement message", [passwords.submitted()], function* ({ enter, feedbackAt }) {
	expect(yield* feedbackAt([])).toBe("Passwords must match");

	yield* enter("confirmation", "first");

	expect(yield* feedbackAt([])).toBeUndefined();
});

asyncNames.it(
	"an async schema error for the current name shows on the field and its path",
	[],
	function* ({ decodeStarted, feedbackAt, feedbackOn, finishDecode, leave }) {
		yield* leave("name");
		yield* decodeStarted("empty");
		expect(yield* feedbackOn("name")).toBeUndefined();

		yield* finishDecode("empty");

		yield* outcomes([
			["name feedback", () => feedbackOn("name"), "Required"],
			["name path feedback", () => feedbackAt(["name"]), "Required"],
		]);
	},
);

asyncNames.it(
	"editing a name hides its previous async schema error while the new decode waits",
	[],
	function* ({ enter, feedbackOn, finishDecode, leave }) {
		yield* leave("name");
		yield* finishDecode("empty");
		expect(yield* feedbackOn("name")).toBe("Required");

		yield* enter("name", "Ada");

		expect(yield* feedbackOn("name")).toBeUndefined();
	},
);

asyncNames.it(
	"an async schema error arriving after the name changes is dropped",
	[],
	function* ({ decodeStarted, enter, feedbackOn, finishDecode, leave }) {
		yield* leave("name");
		yield* decodeStarted("empty");
		yield* enter("name", "Ada");
		yield* decodeStarted("valid");

		yield* finishDecode("empty");

		expect(yield* feedbackOn("name")).toBeUndefined();
	},
);

requiredName.it("a required name's field error stays out of whole-form feedback", [requiredName.submitted()], function* ({ feedbackAt }) {
	yield* outcomes([
		["name feedback", () => feedbackAt(["name"]), "Required"],
		["whole-form feedback", () => feedbackAt([]), undefined],
	]);
});
