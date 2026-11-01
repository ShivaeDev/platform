import { expect } from "vitest";
import { fieldScope } from "#test/fieldScope.ts";

for (const [shape, field, sensitiveSchema, publicSchema] of [
	["publicEncoded", "state", "Read.success.state", "Read.error.encoded.state"],
	["bothEncoded", "wireState", "Read.success.encoded.wireState", "Read.error.encoded.wireState"],
	["nestedEncoded", "state", "Read.success.state", "Read.error.details.encoded.state"],
] as const) {
	fieldScope.it(`a ${shape} sensitivity conflict refuses registration and names both paths`, [], function* ({ register }) {
		const registration = yield* register(shape);

		expect(registration).toEqual({ field, publicSchema, sensitiveSchema });
	});
}

for (const shape of ["distinct", "bothSensitive", "publicOnly"] as const) {
	fieldScope.it(`${shape} encoded fields register without a sensitivity conflict`, [], function* ({ register }) {
		const registration = yield* register(shape);

		expect(registration).toBe("accepted");
	});
}
