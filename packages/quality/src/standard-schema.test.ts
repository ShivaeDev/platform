import { describe, expect, it } from "vitest";
import { describeIssue } from "#standard-schema.ts";

describe("describeIssue", () => {
	it("returns the bare message for an issue without a path", () => {
		expect(describeIssue({ message: "needs a value" })).toBe("needs a value");
		expect(describeIssue({ message: "needs a value", path: [] })).toBe("needs a value");
	});

	it("joins string, number, symbol and keyed path segments before the message", () => {
		expect(describeIssue({ message: "is invalid", path: ["rules", 0, { key: "options" }, Symbol("limit")] })).toBe(
			"rules.0.options.Symbol(limit): is invalid",
		);
	});
});
