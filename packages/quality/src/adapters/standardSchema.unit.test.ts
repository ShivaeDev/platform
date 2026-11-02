import { describe, expect, it } from "vitest";
import { describeIssue } from "./standardSchema.ts";

describe("describeIssue", () => {
	for (const [issue, path] of [
		[{ message: "needs a value" }, "no path"],
		[{ message: "needs a value", path: [] }, "an empty path"],
	] as const) {
		it(`returns the bare message for an issue with ${path}`, () => {
			expect(describeIssue(issue)).toBe("needs a value");
		});
	}

	it("joins string, number, keyed and symbol path segments with dots before the message", () => {
		expect(describeIssue({ message: "is invalid", path: ["rules", 0, { key: "options" }, Symbol("limit")] })).toBe(
			"rules.0.options.Symbol(limit): is invalid",
		);
	});
});
