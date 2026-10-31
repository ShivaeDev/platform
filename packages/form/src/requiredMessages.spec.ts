import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { required } from "#test/requiredFields.ts";

required.it("submitting empty required fields shows each field's own message", [], function* ({ feedbackOn, submit }) {
	expect(yield* feedbackOn("name")).toBeUndefined();

	yield* submit();

	yield* outcomes({
		name: [feedbackOn("name"), "Enter your name"],
		role: [feedbackOn("role"), "Choose a role"],
	});
});

required.it("leaving an empty field shows its required message through path feedback", [], function* ({ feedbackAt, leave }) {
	expect(yield* feedbackAt(["name"])).toBeUndefined();

	yield* leave("name");

	expect(yield* feedbackAt(["name"])).toBe("Enter your name");
});

required.it("entering a name clears its required message", [required.submitted()], function* ({ enter, feedbackOn }) {
	expect(yield* feedbackOn("name")).toBe("Enter your name");

	yield* enter("name", "Ada");

	expect(yield* feedbackOn("name")).toBeUndefined();
});

required.it("required messages preserve longer minimums and explicit schema messages", [], function* ({ feedbackOn, submit }) {
	yield* submit();

	yield* outcomes({
		code: [feedbackOn("code"), "Expected a value with a length of at least 3"],
		slug: [feedbackOn("slug"), "Choose a slug"],
	});
});

required.it(
	"an invalid submission carries the same custom messages and never reaches the handler",
	[],
	function* ({ serverReceived, submissionMessages, submit }) {
		yield* submit();

		yield* outcomes({
			messages: [
				submissionMessages(),
				{ code: "Expected a value with a length of at least 3", name: "Enter your name", role: "Choose a role", slug: "Choose a slug" },
			],
			"values received by the handler": [serverReceived(), []],
		});
	},
);
