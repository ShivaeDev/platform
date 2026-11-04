import { Schema } from "effect";
import { expect, it } from "vitest";
import { Model } from "#Model.ts";
import { rowMapping } from "./groupColumns.ts";

it("rejects groups whose prefixes would write the same column", () => {
	const fields = {
		energy: Model.Group({ low: Schema.Number }, { prefix: "value_" }),
		protein: Model.Group({ low: Schema.Number }, { prefix: "value_" }),
	};

	expect(() => rowMapping(fields)).toThrow("Duplicate grouped column: value_low");
});
