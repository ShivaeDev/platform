import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { createdOnce, savedThenTyped, slowDecodeWithNewerInput, submissionForm, submissions, takenRejected } from "#test/submitStories.ts";

submissions.it(
	"a create through the form's own submit records the decoded row and resets the form",
	[submissionForm()],
	function* ({ created, formName, submit, type }) {
		yield* type("Desk lamps ");

		yield* submit("Form submit");

		yield* outcomes({
			created: [created(), { id: 1, name: "Desk lamps" }],
			"form name": [formName(), ""],
		});
	},
);

submissions.it("submitting the reset form submits its reset values", [createdOnce()], function* ({ submit, submittedNames }) {
	yield* submit("Form submit");

	expect(yield* submittedNames()).toEqual(["Desk lamps ", ""]);
});

submissions.it(
	"an atom submit after save() creates its own values and resets the form",
	[savedThenTyped("Office chairs")],
	function* ({ created, formName, submit }) {
		yield* submit("Atom submit");

		yield* outcomes({
			created: [created(), { id: 2, name: "Office chairs" }],
			"form name": [formName(), ""],
		});
	},
);

submissions.it(
	"input typed while the Schema decodes survives the reset after the create",
	[slowDecodeWithNewerInput()],
	function* ({ created, finishDecode, formName }) {
		yield* finishDecode();

		yield* outcomes({
			created: [created(), { id: 1, name: "Desk lamps" }],
			"form name": [formName(), "Desk lamps and chairs"],
		});
	},
);

submissions.it(
	"an editor's atom submit shows the normalized saved row and leaves nothing unsaved",
	[submissionForm("editor")],
	function* ({ dirty, formName, submit, type }) {
		yield* type("toner");

		yield* submit("Atom submit");

		yield* outcomes({
			dirty: [dirty(), "clean"],
			"form name": [formName(), "TONER"],
		});
	},
);

submissions.it(
	"a rejected name shows the server's message and keeps the submitted value",
	[submissionForm("rejected")],
	function* ({ created, fieldError, formName, submit, type }) {
		yield* type("Taken");

		yield* submit("Form submit");

		yield* outcomes({
			created: [created(), "none"],
			"field error": [fieldError(), "Name is already used"],
			"form name": [formName(), "Taken"],
		});
	},
);

submissions.it("typing after a rejection clears its field error", [takenRejected()], function* ({ fieldError, type }) {
	yield* type("Available");

	expect(yield* fieldError()).toBe("none");
});

submissions.it(
	"a corrected name after a rejection creates and resets the form",
	[takenRejected()],
	function* ({ created, fieldError, formName, submit, type }) {
		yield* type("Available");

		yield* submit("Form submit");

		yield* outcomes({
			created: [created(), { id: 1, name: "Available" }],
			"field error": [fieldError(), "none"],
			"form name": [formName(), ""],
		});
	},
);
