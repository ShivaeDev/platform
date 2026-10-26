import { Effect } from "effect";
import { expect } from "vitest";
import { database } from "#test/database.ts";
import { exhaustedRole, roleLimit } from "#test/databaseTraits.ts";

database.it(
	"other PostgreSQL failures keep their original identity through both test wrappers",
	[],
	function* ({ divideByZero, failInRollback, failInClone }) {
		const error = yield* divideByZero().pipe(Effect.flip);
		expect(yield* failInRollback(error).pipe(Effect.flip)).toBe(error);
		expect(yield* failInClone(error).pipe(Effect.flip)).toBe(error);
	},
);
database.it(
	"a worker releases its admin connection before migrations, tests and clone creation",
	[roleLimit(2)],
	function* ({ readSharedItems, inClone, readItems }) {
		expect(yield* readSharedItems()).toEqual([{ value: "seed" }]);
		expect(yield* inClone(readItems())).toEqual([{ value: "seed" }]);
	},
);
for (const phase of ["setup", "rollback", "clone"] as const) {
	database.it(
		`connection exhaustion during ${phase} retains SQLSTATE and adds worker guidance`,
		[roleLimit(), ...(phase === "setup" ? [exhaustedRole] : [])],
		function* ({ readAcquisition, exhaustRollback, exhaustClone }) {
			const error =
				phase === "setup" ? yield* readAcquisition() : yield* (phase === "rollback" ? exhaustRollback() : exhaustClone()).pipe(Effect.result);
			expect(error).toMatchObject({
				_tag: "Failure",
				failure: {
					_tag: "SqlError",
					message: expect.stringContaining("max_connections"),
					reason: { cause: { code: "53300" } },
				},
			});
			expect(error).toMatchObject({ failure: { message: expect.stringContaining("vitest run --maxWorkers=4") } });
		},
	);
}
