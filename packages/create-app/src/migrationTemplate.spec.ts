import { Cause, Effect, Exit } from "effect";
import { expect } from "vitest";
import { application } from "#test/application.ts";
import { customTemplate } from "#test/traits.ts";

application.it(
	"packing refuses migrations outside the shared sequential filename convention",
	[customTemplate({ "src/server/migrations/20261018-create-labels.ts": "export default {};" })],
	function* ({ pack }) {
		const exit = yield* pack().pipe(Effect.exit);
		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit)) {
			expect(Cause.squash(exit.cause)).toMatchObject({
				_tag: "CreateAppError",
				message: "Invalid migration filename: src/server/migrations/20261018-create-labels.ts",
			});
		}
	},
);

application.it(
	"packing checks the numbered files inside application modules",
	[customTemplate({ "src/modules/labels/server/migrations/create-labels.ts": "export default {};" })],
	function* ({ pack }) {
		const exit = yield* pack().pipe(Effect.exit);
		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit)) {
			expect(Cause.squash(exit.cause)).toMatchObject({
				_tag: "CreateAppError",
				message: "Invalid migration filename: src/modules/labels/server/migrations/create-labels.ts",
			});
		}
	},
);
