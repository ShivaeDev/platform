import { expect } from "@effect/vitest";
import { racingAnswers as answers, first, second } from "#test/arrayRaces.ts";

answers.it(
	"a late rejection addresses its submitted key after reorder during a save",
	[answers.rejects(["answers", 1, "text"], "Rejected"), answers.delayed()],
	function* ({ form, submit, reject, waitForSave, finishSave, errorAt }) {
		errorAt(["answers", 0, "text"]);
		submit();
		yield* waitForSave();
		form.change("answers", [{ ...second }, { ...first }]);
		yield* finishSave();
		yield* reject();
		expect(errorAt(["answers", 0, "text"])).toBe("Rejected");
		expect(errorAt(["answers", 1, "text"])).toBeUndefined();
		form.field("answers").set([first]);
		expect(errorAt(["answers", 0, "text"])).toBeUndefined();
		form.field("answers").set([second, first]);
		expect(errorAt(["answers", 0, "text"])).toBeUndefined();
	},
);

for (const kind of ["edit", "remove", "replace"] as const) {
	answers.it(
		`a late rejection does not attach after ${kind} of the submitted element`,
		[answers.rejects(["answers", 1, "text"], "Rejected"), answers.delayed()],
		function* ({ form, submit, reject, waitForSave, finishSave, errorAt, errors }) {
			errorAt(["answers", 1, "text"]);
			submit();
			yield* waitForSave();
			form.change(
				"answers",
				kind === "remove" ? [first] : [first, kind === "edit" ? { ...second, text: "New" } : { id: "replacement", text: "Same" }],
			);
			yield* finishSave();
			yield* reject();
			expect(errorAt(["answers", 0, "text"])).toBeUndefined();
			expect(errorAt(["answers", 1, "text"])).toBeUndefined();
			expect(errors("answers")).toBeUndefined();
		},
	);
}

answers.it(
	"received values and revert rebase current rejections and duplicate keys do not guess a target",
	[answers.rejects(["answers", 1, "text"], "Rejected")],
	function* ({ form, submit, reject, errorAt }) {
		errorAt(["answers", 1, "text"]);
		submit();
		yield* reject();
		form.receive({ answers: [{ ...second }, { ...first }] });
		expect(errorAt(["answers", 0, "text"])).toBe("Rejected");
		form.change("answers", [first, second]);
		expect(errorAt(["answers", 1, "text"])).toBe("Rejected");
		form.revert();
		expect(errorAt(["answers", 0, "text"])).toBe("Rejected");
		form.change("answers", [second, { ...second }]);
		expect(errorAt(["answers", 0, "text"])).toBeUndefined();
		expect(errorAt(["answers", 1, "text"])).toBeUndefined();
	},
);
