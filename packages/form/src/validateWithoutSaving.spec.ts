import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { names } from "#test/lifecycle.ts";
import { required } from "#test/requiredFields.ts";
import { runtimeValidation } from "#test/runtimeValidation.ts";
import { passwords } from "#test/schemaMessages.ts";

names.it(
	"validation returns encoded and decoded input without saving or clearing the draft",
	[names.draftsStored(), names.edited("name", "  Ada  ")],
	function* ({ serverReceived, shownValues, storedDraft, unsavedChanges, validate, validatedSnapshot }) {
		yield* outcomes([
			["unsaved changes before validation", () => unsavedChanges(), true],
			["stored draft before validation", () => storedDraft(), { name: "  Ada  " }],
		]);

		yield* validate();

		yield* outcomes([
			["validated snapshot", () => validatedSnapshot(), { decoded: { name: "Ada" }, encoded: { name: "  Ada  " } }],
			["input", () => shownValues(), { name: "  Ada  " }],
			["unsaved changes", () => unsavedChanges(), true],
			["stored draft", () => storedDraft(), { name: "  Ada  " }],
			["handler calls", () => serverReceived(), []],
		]);
	},
);

required.it(
	"validation reveals every untouched field's message and returns typed feedback without saving",
	[],
	function* ({ feedbackAt, feedbackOn, serverReceived, validate, validationFeedback }) {
		yield* outcomes([
			["name before validation", () => feedbackOn("name"), undefined],
			["role before validation", () => feedbackOn("role"), undefined],
		]);

		yield* validate();

		yield* outcomes([
			["name", () => feedbackOn("name"), "Enter your name"],
			["name path", () => feedbackAt(["name"]), "Enter your name"],
			["role", () => feedbackOn("role"), "Choose a role"],
			["code", () => feedbackOn("code"), "Expected a value with a length of at least 3"],
			["slug", () => feedbackOn("slug"), "Choose a slug"],
			[
				"typed feedback",
				() => validationFeedback(),
				{ messages: { code: "Expected a value with a length of at least 3", name: "Enter your name", role: "Choose a role", slug: "Choose a slug" } },
			],
			["handler calls", () => serverReceived(), []],
		]);
	},
);

passwords.it("validation reveals whole-form feedback and returns it in Invalid", [], function* ({ feedbackAt, validate, validationFeedback }) {
	expect(yield* feedbackAt([])).toBeUndefined();

	yield* validate();

	yield* outcomes([
		["whole form", () => feedbackAt([]), "Passwords must match"],
		["typed feedback", () => validationFeedback(), { formMessage: "Passwords must match" }],
	]);
});

runtimeValidation.it(
	"validation decodes through the supplied service runtime and retains its snapshot while input changes",
	[],
	function* ({ beginValidation, enter, finishDecoding, serverReceived, shownValues, validatedSnapshot }) {
		yield* beginValidation();
		yield* enter("name", "Grace");

		yield* finishDecoding();

		yield* outcomes([
			["validated snapshot", () => validatedSnapshot(), { decoded: { name: "Ada" }, encoded: { name: "  Ada  " } }],
			["current input", () => shownValues(), { name: "Grace" }],
			["handler calls", () => serverReceived(), []],
		]);
	},
);

runtimeValidation.it(
	"validation returns typed feedback for invalid input decoded by an asynchronous service without saving",
	[runtimeValidation.startsWith({ name: "   " })],
	function* ({ beginValidation, feedbackOn, finishDecoding, serverReceived, validationFeedback }) {
		yield* beginValidation();

		yield* finishDecoding();

		yield* outcomes([
			["typed feedback", () => validationFeedback(), { messages: { name: "Required" } }],
			["field feedback", () => feedbackOn("name"), "Required"],
			["handler calls", () => serverReceived(), []],
		]);
	},
);
