import { Effect } from "effect";
import { expect } from "vitest";
import { names, unmapped } from "#test/nameTransforms.ts";

for (const client of ["shared", "isolated", "clone"] as const) {
	names.it(`the ${client} client reads snake_case rows through the app repository`, [], function* ({ readRows }) {
		expect(yield* readRows(client)).toEqual([{ id: 1, runId: "seed" }]);
	});

	names.it(`the ${client} client checks snake_case columns in model field terms`, [], function* ({ checkColumns }) {
		yield* checkColumns(client);
	});

	names.it(`the ${client} client preserves repository fields without mapping`, [unmapped], function* ({ readRows, checkColumns }) {
		expect(yield* readRows(client)).toEqual([{ id: 1, runId: "seed" }]);
		yield* checkColumns(client);
	});
}

names.it("a mapped missing column is reported with its model field name", [], function* ({ dropRunId, checkColumns }) {
	yield* dropRunId();
	const mismatch = yield* checkColumns("shared").pipe(Effect.flip);
	expect(mismatch).toMatchObject({ _tag: "ModelColumnMismatch", problems: ["Missing column: runId"] });
});

names.it("a missing column still fails without mapping", [unmapped], function* ({ dropRunId, checkColumns }) {
	yield* dropRunId();
	const mismatch = yield* checkColumns("shared").pipe(Effect.flip);
	expect(mismatch).toMatchObject({ _tag: "ModelColumnMismatch", problems: ["Missing column: runId"] });
});

names.it("mapped type and extra-column mismatches use model field names", [], function* ({ changeRunIdType, addColumn, checkColumns }) {
	yield* changeRunIdType();
	yield* addColumn();
	const mismatch = yield* checkColumns("shared").pipe(Effect.flip);
	expect(mismatch).toMatchObject({
		_tag: "ModelColumnMismatch",
		problems: ["Wrong type for runId: expected text, received character varying(8)", "Extra column: extraField"],
	});
});

names.it("a column with the wrong SQL spelling fails even when its result name matches", [], function* ({ renameRunId, checkColumns }) {
	yield* renameRunId();
	const mismatch = yield* checkColumns("shared").pipe(Effect.flip);
	expect(mismatch).toMatchObject({ _tag: "ModelColumnMismatch", problems: ["Missing column: runId", "Extra column: runId"] });
});
