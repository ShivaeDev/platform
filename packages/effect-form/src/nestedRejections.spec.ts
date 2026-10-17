import { expect } from "@effect/vitest";
import { answerNotes, notes, wholeAnswers } from "#test/nestedRejections.ts";

notes.it(
	"handler paths reject omitted optional inputs",
	[notes.rejects("note", "Explain your choice")],
	function* ({ form, submit, reject, errors, errorAt }) {
		errors("note");
		submit();
		yield* reject();
		expect(errors("note")).toBe("Explain your choice");
		expect(errorAt(["note"])).toBe("Explain your choice");
		form.change("note", "An explanation");
		expect(errors("note")).toBeUndefined();
	},
);

answerNotes.it(
	"handler paths reject omitted inputs without attaching to missing array elements",
	[answerNotes.rejects(["answers", 0, "note"], "Explain your choice")],
	function* ({ form, submit, reject, errorAt }) {
		errorAt(["answers", 0, "note"]);
		submit();
		yield* reject();
		expect(errorAt(["answers", 0, "note"])).toBe("Explain your choice");
		form.change("answers", []);
		expect(errorAt(["answers", 0, "note"])).toBeUndefined();
	},
);

wholeAnswers.it(
	"a whole-element rejection follows recreated elements and clears on a change inside that element",
	[wholeAnswers.rejects(["answers", 0], "Rejected element")],
	function* ({ form, submit, reject, errorAt }) {
		errorAt(["answers", 0]);
		submit();
		yield* reject();
		form.change("answers", [
			{ id: 1, text: "Two" },
			{ id: 0, text: "One" },
		]);
		expect(errorAt(["answers", 0])).toBeUndefined();
		expect(errorAt(["answers", 1])).toBe("Rejected element");
		form.change("answers", [
			{ id: 1, text: "Two" },
			{ id: 0, text: "Edited" },
		]);
		expect(errorAt(["answers", 1])).toBeUndefined();
	},
);
