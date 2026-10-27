import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Invalid } from "#shape.ts";
import { memoizedAnswers, profiles, unanswered } from "#test/nestedForms.ts";

memoizedAnswers.it("nested error atoms are memoized by path value", [], ({ form }) => {
	const path: readonly ["answers", number, string] = ["answers", 0, "text"];
	const first = form.errorAt(path);
	expect(form.errorAt(path)).toBe(first);
	expect(form.errorAt(["answers", 0, "text"])).toBe(first);
	expect(form.errorAt(["answers", 1, "text"])).not.toBe(first);
	expect(form.errorAt(["answers", "0", "text"])).not.toBe(first);
	expect(form.errorAt(["answers", 0, "selected"])).not.toBe(first);
	expect(form.errorAt(["answers", 0])).not.toBe(first);
});

unanswered.it(
	"nested Schema messages address each unanswered control and retain the top-level summary",
	[],
	function* ({ form, read, submit, result, reject, errors, submissions }) {
		const first = form.errorAt(["answers", 0, "text"]);
		const second = form.errorAt(["answers", 1, "text"]);
		const selections = form.errorAt(["answers", 0, "selected"]);
		expect(read(first)).toBeUndefined();
		expect(read(second)).toBeUndefined();
		submit();
		expect(yield* reject()).toBeInstanceOf(Invalid);
		expect(submissions.length).toBe(0);
		expect(read(first)).toBe("Choose or write an answer");
		expect(form.errorAt(["answers", 0, "text"])).toBe(first);
		expect(read(second)).toBe("Choose or write an answer");
		expect(read(selections)).toBeUndefined();
		expect(errors("answers")).toBe("Choose or write an answer");
		form.change("answers", [
			{ selected: ["option"], text: "" },
			{ selected: [], text: "" },
		]);
		expect(read(first)).toBeUndefined();
		expect(form.errorAt(["answers", 0, "text"])).toBe(first);
		expect(read(second)).toBe("Choose or write an answer");
		form.change("answers", [
			{ selected: ["option"], text: "" },
			{ selected: [], text: "Another answer" },
		]);
		expect(read(second)).toBeUndefined();
		submit();
		expect(yield* result()).toEqual(form.values.value);
		expect(submissions).toEqual([form.values.value]);
	},
);

profiles.it("blur reveals descendant Schema feedback without inventing sibling paths", [], function* ({ form, read, errorAt }) {
	const name = form.errorAt(["profile", "name"]);
	expect(read(name)).toBeUndefined();
	yield* Effect.sync(() => form.blur("profile"));
	expect(form.errorAt(["profile", "name"])).toBe(name);
	expect(read(name)).toBe("Required");
	expect(errorAt(["profile"])).toBe("Required");
	expect(errorAt(["profile", "name"])).toBe("Required");
	expect(errorAt(["profile", "other"])).toBeUndefined();
});
