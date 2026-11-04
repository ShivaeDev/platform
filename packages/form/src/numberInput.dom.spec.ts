import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { numberScreen } from "#test/numberScreen.ts";

for (const blank of ["", "   "]) {
	numberScreen.it(`an optional number entered as ${JSON.stringify(blank)} saves as null`, [], function* ({ enter, saved, submit }) {
		yield* enter("amount", blank);

		yield* submit();

		expect(yield* saved()).toBe('{"amount":null,"portion":1}');
	});
}

for (const [input, message] of [
	["invalid", "Expected a finite number"],
	["NaN", "Expected a finite number"],
	["Infinity", "Expected a finite number"],
	["-Infinity", "Expected a finite number"],
	["1e309", "Expected a finite number"],
	["-1", "Expected a value greater than or equal to 0"],
	["101", "Expected a value less than or equal to 100"],
	["1.5", "Expected an integer"],
] as const) {
	numberScreen.it(
		`the optional integer keeps ${input}, displays its error and refuses to save`,
		[],
		function* ({ enter, message: shownMessage, saved, shown, submit }) {
			yield* enter("amount", input);

			yield* submit();

			yield* outcomes([
				["input", () => shown("amount"), input],
				["amount feedback", () => shownMessage("amount"), message],
				["save", () => saved(), "unsaved"],
			]);
		},
	);
}

for (const value of ["0", "100"]) {
	numberScreen.it(`the optional integer accepts its inclusive boundary ${value}`, [], function* ({ enter, message, saved, submit }) {
		yield* enter("amount", value);

		yield* submit();

		yield* outcomes([
			["amount feedback", () => message("amount"), ""],
			["save", () => saved(), JSON.stringify({ amount: Number(value), portion: 1 })],
		]);
	});
}

numberScreen.it("a required number saves a negative fraction", [], function* ({ enter, saved, submit }) {
	yield* enter("portion", "-2.5");

	yield* submit();

	expect(yield* saved()).toBe('{"amount":7,"portion":-2.5}');
});

numberScreen.it("leaving a blank required number displays Required and prevents saving", [], function* ({ enter, leave, message, saved, submit }) {
	yield* enter("portion", "");

	yield* leave("portion");

	expect(yield* message("portion")).toBe("Required");

	yield* submit();

	expect(yield* saved()).toBe("unsaved");
});

numberScreen.it("correcting an invalid number clears its feedback and saves the correction", [], function* ({ enter, message, saved, submit }) {
	yield* enter("amount", "wrong");
	expect(yield* message("amount")).toBe("Expected a finite number");

	yield* enter("amount", "42");

	expect(yield* message("amount")).toBe("");

	yield* submit();

	expect(yield* saved()).toBe('{"amount":42,"portion":1}');
});
