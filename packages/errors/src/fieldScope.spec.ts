import { expect } from "vitest";
import { fieldScope } from "#test/fieldScope.ts";

for (const [shape, field, sensitiveSchema, publicSchema] of [
	["publicEncoded", "state", "Read.success.state", "Read.error.encoded.state"],
	["bothEncoded", "wireState", "Read.success.encoded.wireState", "Read.error.encoded.wireState"],
	["nestedEncoded", "state", "Read.success.state", "Read.error.details.encoded.state"],
] as const) {
	fieldScope.it(`a ${shape} sensitivity conflict refuses registration and names both paths`, [], function* ({ register }) {
		const registration = yield* register(shape);

		expect(registration).toMatchObject({ conflicts: [{ field, publicSchema, sensitiveSchema }] });
	});
}

for (const shape of ["threeConflicts", "multipleRpcs"] as const) {
	fieldScope.it(`${shape} refuses registration with every conflicting field and both paths in one failure and message`, [], function* ({ register }) {
		const registration = yield* register(shape);

		const conflicts = [
			{ field: "category", publicSchema: "Read.error.details.category", sensitiveSchema: "Read.success.category" },
			{ field: "location", publicSchema: "Read.error.details.location", sensitiveSchema: "Read.success.location" },
			{ field: "state", publicSchema: "Read.error.state", sensitiveSchema: "Read.success.state" },
			...(shape === "multipleRpcs"
				? [{ field: "wireState", publicSchema: "Other.error.encoded.wireState", sensitiveSchema: "Other.success.encoded.wireState" }]
				: []),
		];
		expect(registration).toEqual({
			conflicts,
			message: conflicts
				.map(
					({ field, publicSchema, sensitiveSchema }) =>
						`Sensitive field "${field}" in schema ${sensitiveSchema} conflicts with public field in schema ${publicSchema}; RPC diagnostics cannot distinguish these fields. Use distinct field names or mark both fields sensitive.`,
				)
				.join("\n"),
		});
	});
}

fieldScope.it("explicit application keys resolve every mixed-visibility field", [], function* ({ register }) {
	const registration = yield* register("threeConflicts", ["state", "location", "category"]);

	expect(registration).toBe("accepted");
});

for (const shape of ["distinct", "bothSensitive", "publicOnly"] as const) {
	fieldScope.it(`${shape} encoded fields register without a sensitivity conflict`, [], function* ({ register }) {
		const registration = yield* register(shape);

		expect(registration).toBe("accepted");
	});
}
