import { expect } from "vitest";
import { formOptions, optionsShown, rejectedAnswers } from "#test/formOptionsStories.tsx";

for (const kind of ["editor", "create"] as const) {
	formOptions.it(`a ${kind} form shows custom required wording`, [optionsShown(kind)], function* ({ save, message }) {
		yield* save();

		expect(yield* message()).toBe("Give this editor a title");
	});

	formOptions.it(
		`a ${kind} form keeps a rejection on its keyed answer after reorder`,
		[optionsShown(kind), rejectedAnswers(kind)],
		function* ({ reverse, rows }) {
			expect(yield* rows()).toEqual([
				{ id: "first", message: "none" },
				{ id: "second", message: "Answer is closed" },
			]);

			yield* reverse();

			expect(yield* rows()).toEqual([
				{ id: "second", message: "Answer is closed" },
				{ id: "first", message: "none" },
			]);
		},
	);

	formOptions.it(`a ${kind} form shows feedback from its configured title check`, [optionsShown(kind)], function* ({ type, answerCheck, message }) {
		yield* type("taken");
		expect(yield* message()).toBe("none");

		yield* answerCheck("taken", "Title is taken");

		expect(yield* message()).toBe("Title is taken");
	});
}

formOptions.it("a successful create keeps form options for the next entry", [optionsShown("create")], function* ({ type, save, message }) {
	yield* type("accepted");
	yield* save();
	yield* save();

	expect(yield* message()).toBe("Give this editor a title");
});
