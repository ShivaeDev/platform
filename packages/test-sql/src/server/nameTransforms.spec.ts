import { expect } from "vitest";
import { names, unmapped } from "#test/nameTransforms.ts";

for (const client of ["the shared database", "an isolated block", "an explicit clone"] as const) {
	names.it(`${client} reads the snake_case run_id column as runId through the app's repository`, [], function* ({ rows }) {
		expect(yield* rows(client)).toEqual([{ id: 1, runId: "seed" }]);
	});

	names.it(`${client} checks the snake_case columns against the model in field terms`, [], function* ({ columnCheck }) {
		expect(yield* columnCheck(client)).toBe("matches the model");
	});
}

names.it("without name transforms, the shared database reads the runId column as written", [unmapped], function* ({ rows }) {
	expect(yield* rows("the shared database")).toEqual([{ id: 1, runId: "seed" }]);
});

for (const [change, problem] of [
	["dropping run_id", "Missing column: runId"],
	["changing run_id's type", "Wrong type for runId: expected text, received character varying(8)"],
	["adding extra_field", "Extra column: extraField"],
	['renaming run_id to "runId"', "Missing column: runId; Extra column: runId"],
] as const) {
	names.it(`after ${change}, the model check reports ${problem} in model field terms`, [], function* ({ changeSchema, columnCheck }) {
		expect(yield* columnCheck("the shared database")).toBe("matches the model");

		yield* changeSchema(change);

		expect(yield* columnCheck("the shared database")).toBe(`mismatch: ${problem}`);
	});
}
