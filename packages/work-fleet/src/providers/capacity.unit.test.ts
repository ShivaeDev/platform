import { expect } from "@effect/vitest";
import { it } from "@shivaedev/test/it.ts";
import { capacity } from "./capacity.ts";

it("recognizes only explicit structured provider capacity errors", () => {
	for (const codexErrorInfo of ["rateLimitExceeded", "flexUnavailable", "serverOverloaded"]) {
		expect(capacity({ data: { codexErrorInfo }, message: "Provider cause" })).toBe(codexErrorInfo);
	}
	for (const error of [{ message: "capacity exceeded" }, { data: { codexErrorInfo: "unauthorized" } }, {}]) {
		expect(capacity(error)).toBeUndefined();
	}
});
