import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { type PartialWrite, partialRowsExist, partialTargets, planMode } from "#test/partialTargets.ts";

const oneX = { a: "one", kind: "X", value: 10 };
const oneY = { a: "one", kind: "Y", value: 20 };
const twoX = { a: "two", kind: "X", value: 30 };

for (const mode of ["auto", "force_generic_plan"] as const) {
	partialTargets.it(
		`insertFromSelectOrIgnore skips existing rows inside the partial target (${mode})`,
		[planMode(mode), partialRowsExist([oneX])],
		function* ({ insertFromSelectOrIgnore, returned, storedRows }) {
			yield* insertFromSelectOrIgnore();

			yield* outcomes([
				["returned rows", () => returned(), [[]]],
				["stored rows", () => storedRows(), [oneX]],
			]);
		},
	);

	partialTargets.it(
		`insertOrIgnore of a taken key inside the partial target is ignored (${mode})`,
		[planMode(mode), partialRowsExist([oneX])],
		function* ({ insertOrIgnore, returned, storedRows }) {
			yield* insertOrIgnore({ ...oneX, value: 99 });

			yield* outcomes([
				["returned value", () => returned(), ["ignored"]],
				["stored rows", () => storedRows(), [oneX]],
			]);
		},
	);

	partialTargets.it(
		`insertOrIgnore of the same key outside the partial target inserts a second row (${mode})`,
		[planMode(mode), partialRowsExist([oneX])],
		function* ({ insertOrIgnore, storedRows }) {
			yield* insertOrIgnore(oneY);

			expect(yield* storedRows()).toEqual([oneX, oneY]);
		},
	);

	partialTargets.it(
		`insertManyOrIgnore skips the taken key inside the partial target and returns, in order, the rows outside it or with new keys (${mode})`,
		[planMode(mode), partialRowsExist([oneX])],
		function* ({ insertManyOrIgnore, returned, storedRows }) {
			yield* insertManyOrIgnore([{ ...oneX, value: 99 }, oneY, twoX]);

			yield* outcomes([
				["returned rows", () => returned(), [[oneY, twoX]]],
				["stored rows", () => storedRows(), [oneX, oneY, twoX]],
			]);
		},
	);

	partialTargets.it(
		`upsert of a taken key inside the partial target updates its value and reports an update (${mode})`,
		[planMode(mode), partialRowsExist([oneX])],
		function* ({ returned, storedRows, upsert }) {
			yield* upsert({ ...oneX, value: 99 });

			yield* outcomes([
				["returned value", () => returned(), [{ inserted: false, row: { ...oneX, value: 99 } }]],
				["stored rows", () => storedRows(), [{ ...oneX, value: 99 }]],
			]);
		},
	);

	partialTargets.it(
		`upsert of the same key outside the partial target inserts a second row and reports an insert (${mode})`,
		[planMode(mode), partialRowsExist([oneX])],
		function* ({ returned, storedRows, upsert }) {
			yield* upsert(oneY);

			yield* outcomes([
				["returned value", () => returned(), [{ inserted: true, row: oneY }]],
				["stored rows", () => storedRows(), [oneX, oneY]],
			]);
		},
	);

	partialTargets.it(
		`upsertMany reports, in order, an update inside the partial target and an insert outside it (${mode})`,
		[planMode(mode), partialRowsExist([oneX, oneY])],
		function* ({ returned, storedRows, upsertMany }) {
			yield* upsertMany([
				{ ...oneX, value: 30 },
				{ ...oneY, value: 40 },
			]);

			yield* outcomes([
				[
					"returned results",
					() => returned(),
					[
						[
							{ inserted: false, row: { ...oneX, value: 30 } },
							{ inserted: true, row: { ...oneY, value: 40 } },
						],
					],
				],
				["stored rows", () => storedRows(), [{ ...oneX, value: 30 }, oneY, { ...oneY, value: 40 }]],
			]);
		},
	);

	for (const write of ["insertManyOrIgnore", "insertOrIgnore", "upsert", "upsertMany"] as const satisfies readonly PartialWrite[]) {
		partialTargets.it(
			`${write} through a partial target no index matches fails with SQLSTATE 42P10 and writes nothing (${mode})`,
			[planMode(mode), partialRowsExist([oneX])],
			function* ({ endings, storedRows, writeThroughUnmatchedTarget }) {
				yield* writeThroughUnmatchedTarget(write, twoX);

				yield* outcomes([
					["stored rows", () => storedRows(), [oneX]],
					[`${write} ending`, () => endings(), ["failed with a SQL syntax error (SQLSTATE 42P10)"]],
				]);
			},
		);
	}
}
