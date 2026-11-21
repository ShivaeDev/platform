import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
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

fieldScope.it(
	"an RPC whose payload hides state registers when its success showing state is generated, and is refused when that success is declared",
	[],
	function* ({ registerPrivatePayload }) {
		yield* outcomes([
			["generated success", () => registerPrivatePayload("generated"), "accepted"],
			[
				"declared success",
				() => registerPrivatePayload("declared"),
				{ conflicts: [{ field: "state", publicSchema: "Read.success.state", sensitiveSchema: "Read.payload.state" }] },
			],
		]);
	},
);

for (const carrier of ["a generated success that holds Visit under mutable keys in an object and in an array", "a stream of Visit"] as const) {
	fieldScope.it(
		`an RPC whose payload shows state and whose success is ${carrier}, a class marking state, registers and masks state while day stays visible`,
		[],
		function* ({ carriedMasks }) {
			expect(yield* carriedMasks(carrier, ["state", "day"])).toEqual(["state"]);
		},
	);
}

fieldScope.it(
	"an RPC whose success holds a Redacted refresh inside a union with null masks the refresh name and leaves scope visible",
	[],
	function* ({ maskedNames }) {
		expect(yield* maskedNames("a Redacted refresh beside null", ["refresh", "scope"])).toEqual(["refresh"]);
	},
);

fieldScope.it(
	"an RPC whose success is a folder of folders, with an outline of nested outlines, registers and masks only the Redacted key's name",
	[],
	function* ({ maskedNames }) {
		expect(yield* maskedNames("a folder of folders with a Redacted key", ["children", "key", "name", "outline"])).toEqual(["key"]);
	},
);
