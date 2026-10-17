import { expect, it } from "vitest";
import { isSensitiveKey, redactText } from "./sensitive.ts";

it.each([
	["error: sig=abc&x=1", "error: sig=<redacted>&x=1"],
	["error:sig=abc&x=1", "error:sig=<redacted>&x=1"],
	["error: context: sig=abc&x=1", "error: context: sig=<redacted>&x=1"],
	['"error":"sig=abc"', '"error":"sig=<redacted>"'],
	["error: token=abc&sig=def", "error: token=<redacted>&sig=<redacted>"],
	["password=sig=abc&x=1", "password=<redacted>&x=1"],
	["error: status=ready&x=1", "error: status=ready&x=1"],
])("checks nested assignments in %s", (input, expected) => {
	expect(redactText(input, isSensitiveKey)).toBe(expected);
});

it("uses the caller's sensitive-name policy for nested assignments", () => {
	expect(redactText("error: email=person@example.test", (key) => key === "email")).toBe("error: email=<redacted>");
});
