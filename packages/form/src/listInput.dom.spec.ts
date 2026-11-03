import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { listScreen } from "#test/listScreen.ts";

listScreen.it(
	"adding, editing and removing quick amounts saves the remaining decoded list",
	[],
	function* ({ add, edit, items, remove, saved, submit }) {
		expect(yield* items()).toEqual([
			{ amount: "1", id: "first" },
			{ amount: "2", id: "second" },
		]);

		yield* add();

		expect(yield* items()).toEqual([
			{ amount: "1", id: "first" },
			{ amount: "2", id: "second" },
			{ amount: "3", id: "3" },
		]);

		yield* edit("3", "4.5");
		yield* remove("first");
		yield* submit();

		yield* outcomes([
			[
				"inputs",
				() => items(),
				[
					{ amount: "2", id: "second" },
					{ amount: "4.5", id: "3" },
				],
			],
			["save", () => saved(), "second=2, 3=4.5"],
		]);
	},
);

listScreen.it("a bounded list saves five items and refuses a sixth with list feedback", [], function* ({ add, message, saved, submit, summary }) {
	for (const _id of ["3", "4", "5"]) {
		yield* add();
	}
	yield* submit();
	expect(yield* saved()).toBe("first=1, second=2, 3=3, 4=3, 5=3");

	yield* add();
	yield* submit();

	yield* outcomes([
		["list feedback", () => summary(), "Expected a value with a length of at most 5"],
		["sixth item feedback", () => message("6"), ""],
		["save", () => saved(), "unsaved"],
	]);
});

listScreen.it("removing the last item refuses submission with minimum list feedback", [], function* ({ remove, saved, submit, summary }) {
	yield* remove("first");

	yield* remove("second");
	yield* submit();

	yield* outcomes([
		["list feedback", () => summary(), "Required"],
		["save", () => saved(), "unsaved"],
	]);
});

listScreen.it(
	"invalid list feedback stays beside its item after an earlier item is removed and clears on correction",
	[],
	function* ({ edit, message, remove, saved, submit }) {
		yield* edit("second", "invalid");
		yield* outcomes([
			["first item feedback", () => message("first"), ""],
			["second item feedback", () => message("second"), "Expected a finite number"],
		]);

		yield* remove("first");

		expect(yield* message("second")).toBe("Expected a finite number");

		yield* edit("second", "5");

		expect(yield* message("second")).toBe("");

		yield* submit();

		expect(yield* saved()).toBe("second=5");
	},
);

listScreen.it(
	"a server rejection follows its keyed item after removal of an earlier item and clears on edit",
	[],
	function* ({ edit, message, remove, submit }) {
		yield* edit("second", "13");
		yield* submit();
		yield* outcomes([
			["first item feedback", () => message("first"), ""],
			["second item feedback", () => message("second"), "This amount is unavailable"],
		]);

		yield* remove("first");

		expect(yield* message("second")).toBe("This amount is unavailable");

		yield* edit("second", "14");

		expect(yield* message("second")).toBe("");
	},
);
