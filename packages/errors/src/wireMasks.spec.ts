import { expect } from "vitest";
import { wireMasks } from "#test/wireMasks.ts";

for (const shape of ["missing", "invalid", "missingContainer", "missingTransform"] as const) {
	wireMasks.it(
		`a ${shape} mask refuses the constrained sensitive schema at definition with a typed field error and instructions`,
		[],
		function* ({ define }) {
			const definition = yield* define(shape);

			expect(definition).toEqual({
				field: "Save.error[0].amount",
				message: 'Sensitive field "Save.error[0].amount" needs a schema-compatible mask; supply a redactionMask annotation on its wire schema.',
				refused: "invalid redaction mask",
			});
		},
	);
}

for (const shape of ["explicit", "generic", "explicitContainer", "explicitTransform"] as const) {
	wireMasks.it(`a compatible ${shape} mask accepts the sensitive schema definition`, [], function* ({ define }) {
		const definition = yield* define(shape);

		expect(definition).toBe("accepted");
	});
}
