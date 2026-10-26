import { Option } from "effect";
import { expect, it } from "vitest";
import { rejectedField } from "./rejectedField.ts";

it("extracts a field rejection from tagged JSON", () => {
	expect(rejectedField({ _tag: "Conflict", field: "name", message: "Encoded" })).toEqual(Option.some({ field: "name", message: "Encoded" }));
});

it.each([
	{ field: "title", message: "Untagged" },
	{ _tag: 1, field: "title", message: "Numeric tag" },
	{ _tag: "Invalid", field: 1, message: "Numeric field" },
	{ _tag: "Invalid", field: "title" },
	null,
])("rejects malformed field rejections: %j", (value) => {
	expect(rejectedField(value)).toEqual(Option.none());
});
