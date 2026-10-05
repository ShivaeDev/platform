import { Data, Schema } from "effect";
import { expect, it } from "vitest";
import { fieldRejectionOf } from "#field-rejection.ts";

class Rejected extends Data.TaggedError("Rejected")<{ readonly field: string; readonly message: string }> {}

it("only a tagged rejection naming a form field becomes a field message", () => {
	const recognise = fieldRejectionOf(Schema.Struct({ name: Schema.String }));
	expect(recognise(new Rejected({ field: "name", message: "Taken" }))).toEqual({ field: "name", message: "Taken" });
	expect(recognise(new Rejected({ field: "other", message: "Taken" }))).toBeUndefined();
	expect(recognise({ field: "name", message: "Taken" })).toBeUndefined();
	expect(recognise({ _tag: 1, field: "name", message: "Taken" })).toBeUndefined();
});
