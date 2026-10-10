import { StandardSchemaV1Error, TRPCError } from "@trpc/server";
import { expect, it } from "vitest";
import { withRejection } from "#rejection-formatter.ts";

it("formats Standard Schema paths containing primitive and keyed segments", () => {
	const error = new TRPCError({
		cause: new StandardSchemaV1Error([{ message: "Must be a nonempty string", path: ["profiles", 1, { key: "name" }] }]),
		code: "BAD_REQUEST",
	});

	expect(withRejection({ data: { path: "save" } }, error)).toEqual({
		data: {
			path: "save",
			rejection: { _tag: "BadRequest", field: "profiles.1.name", invalidInput: true, message: "Must be a nonempty string" },
		},
	});
});

it("omits the field for a Standard Schema root issue without a path", () => {
	const error = new TRPCError({
		cause: new StandardSchemaV1Error([{ message: "Must be a record" }]),
		code: "BAD_REQUEST",
	});

	expect(withRejection({ data: {} }, error)).toEqual({
		data: { rejection: { _tag: "BadRequest", invalidInput: true, message: "Must be a record" } },
	});
});
