import { expect } from "vitest";
import { submissionForm, submissions } from "#test/submitStories.ts";

submissions.it("a form-API create records its result and resets the form", [submissionForm()], function* ({ type, submit, snapshot, names }) {
	yield* type("Desk lamps ");
	yield* submit("Form submit");
	expect(snapshot()).toEqual({ created: { id: 1, name: "Desk lamps" }, values: { name: "" } });
	yield* submit("Form submit");
	expect(names()).toEqual(["Desk lamps ", ""]);
});

submissions.it("a form-API create after save() compares against its own submission", [submissionForm()], function* ({ type, submit, snapshot }) {
	yield* type("Desk lamps");
	yield* submit("Save");
	yield* type("Office chairs");
	yield* submit("Atom submit");
	expect(snapshot()).toEqual({ created: { id: 2, name: "Office chairs" }, values: { name: "" } });
});

submissions.it(
	"an edit during asynchronous Schema decoding survives the reset",
	[submissionForm("slow")],
	function* ({ type, submit, finishDecode, observe, snapshot }) {
		yield* type("Desk lamps");
		yield* submit("Save");
		yield* type("Desk lamps and chairs");
		yield* finishDecode();
		yield* observe("the original submission is created and newer input remains", () =>
			expect(snapshot()).toEqual({ created: { id: 1, name: "Desk lamps" }, values: { name: "Desk lamps and chairs" } }),
		);
	},
);

submissions.it("a form-API edit receives the normalized saved row", [submissionForm("editor")], function* ({ type, submit, snapshot }) {
	yield* type("toner");
	yield* submit("Atom submit");
	expect(snapshot()).toEqual({ dirty: false, values: { name: "TONER" } });
});
