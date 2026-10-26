import { expect } from "@effect/vitest";
import { FieldFailure, Invalid } from "#shape.ts";
import { first, indexedAnswers, rejectedAnswers, schemaAnswers, second, third } from "#test/arrayForms.ts";

schemaAnswers.it("Schema errors follow their element through insertion, removal and reorder", [], function* ({ form, submit, reject, errorAt }) {
	function message(index: number) {
		return errorAt(["answers", index, "text"]);
	}
	expect(message(2)).toBeUndefined();
	submit();
	expect(yield* reject()).toBeInstanceOf(Invalid);
	expect(message(0)).toBeUndefined();
	expect(message(1)).toBeUndefined();
	expect(message(2)).toBe("Required");
	form.change("answers", [{ id: "inserted", text: "New" }, first, second, third]);
	expect(message(2)).toBeUndefined();
	expect(message(3)).toBe("Required");
	form.change("answers", [second, { ...third }]);
	expect(message(0)).toBeUndefined();
	expect(message(1)).toBe("Required");
	form.change("answers", [{ ...third }, second]);
	expect(message(0)).toBe("Required");
	expect(message(1)).toBeUndefined();
	form.change("answers", [second]);
	expect(message(0)).toBeUndefined();
	expect(message(1)).toBeUndefined();
});

rejectedAnswers.it(
	"a typed server rejection follows the keyed answer and clears only when its input changes or disappears",
	[],
	function* ({ form, submit, reject, errors, errorAt }) {
		function message(index: number) {
			return errorAt(["answers", index, "text"]);
		}
		submit();
		const rejection = yield* reject();
		expect(rejection).toBeInstanceOf(FieldFailure);
		expect(rejection).toMatchObject({ path: "answers", segments: ["answers", 2, "text"] });
		expect(message(2)).toBe("Answer is closed");
		expect(errorAt(["answers", 2])).toBe("Answer is closed");
		expect(errorAt(["answers", 2, "id"])).toBeUndefined();
		expect(errors("answers")).toBe("Answer is closed");
		const rejected = { id: "third", text: "Rejected" };
		form.change("answers", [{ id: "inserted", text: "Rejected" }, first, second, rejected]);
		expect(message(0)).toBeUndefined();
		expect(message(2)).toBeUndefined();
		expect(message(3)).toBe("Answer is closed");
		form.change("answers", [{ ...second, text: "Edited sibling" }, { ...rejected }]);
		expect(message(1)).toBe("Answer is closed");
		form.blur("answers");
		expect(message(1)).toBe("Answer is closed");
		form.change("answers", [{ ...rejected }, second]);
		expect(message(0)).toBe("Answer is closed");
		expect(message(1)).toBeUndefined();
		form.change("answers", [{ ...rejected, text: "Corrected" }, second]);
		expect(message(0)).toBeUndefined();
		form.change("answers", [rejected, second]);
		expect(message(0)).toBeUndefined();
		submit();
		yield* reject();
		expect(message(2)).toBeUndefined();
	},
);

indexedAnswers.it("unconfigured arrays retain index paths rather than guessing element identity", [], function* ({ form, submit, reject, errorAt }) {
	submit();
	yield* reject();
	form.change("answers", [{ id: "second", text: "One" }, first]);
	expect(errorAt(["answers", 0, "text"])).toBe("Rejected");
	expect(errorAt(["answers", 1, "text"])).toBeUndefined();
});
