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

	formOptions.it(
		`a ${kind} form uses the configured debounce and ignores a check answered for older input`,
		[optionsShown(kind)],
		function* ({ type, elapse, checked, answerCheck, message }) {
			yield* type("old");
			yield* elapse(50);
			expect(yield* checked()).toContain("old");

			yield* type("new");
			yield* elapse(49);
			expect(yield* checked()).not.toContain("new");
			yield* answerCheck("old", "Old title is taken");
			expect(yield* message()).toBe("none");

			yield* elapse(1);
			expect(yield* checked()).toContain("new");
			yield* answerCheck("new", "New title is taken");
			expect(yield* message()).toBe("New title is taken");
		},
	);
	formOptions.it(
		`a ${kind} form keeps newer feedback when an older check arrives late`,
		[optionsShown(kind)],
		function* ({ type, elapse, answerCheck, message }) {
			yield* type("old");
			yield* elapse(50);
			yield* type("new");
			yield* elapse(50);
			yield* answerCheck("new", "New title is taken");
			expect(yield* message()).toBe("New title is taken");

			yield* answerCheck("old", "Old title is taken");

			expect(yield* message()).toBe("New title is taken");
		},
	);
}

formOptions.it("a successful create keeps form options for the next entry", [optionsShown("create")], function* ({ type, save, message }) {
	yield* type("accepted");
	yield* save();
	yield* save();

	expect(yield* message()).toBe("Give this editor a title");
});
