import { expect, it } from "vitest";
import { isSensitiveKey, redactText } from "#sensitive.ts";

it.each([
	["before -----BEGIN RSA PRIVATE KEY-----\nMIIkey\n-----END RSA PRIVATE KEY----- after", "before <redacted> after"],
	[String.raw`{"key":"-----BEGIN PRIVATE KEY-----\nMIIkey\n-----END PRIVATE KEY-----","status":"ready"}`, '{"key":"<redacted>","status":"ready"}'],
	["-----BEGIN EC PRIVATE KEY-----\nfirst\n-----BEGIN EC PRIVATE KEY-----\nsecond\n-----END EC PRIVATE KEY----- after", "<redacted> after"],
	["-----BEGIN EC PRIVATE KEY-----\nfirst\n-----END RSA PRIVATE KEY----- -----END EC PRIVATE KEY----- after", "<redacted> after"],
	[
		"one <-----BEGIN PRIVATE KEY-----a-----END PRIVATE KEY-----> two <-----BEGIN PRIVATE KEY-----b-----END PRIVATE KEY----->",
		"one <<redacted>> two <<redacted>>",
	],
	["-----END RSA PRIVATE KEY----- after", "-----END RSA PRIVATE KEY----- after"],
])("masks the private-key block in %s", (input, expected) => {
	expect(redactText(input, isSensitiveKey)).toBe(expected);
});

it.each([
	["a block cut before its footer", "excerpt: -----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXk", "excerpt: <redacted>"],
	["a block whose footer names another kind", "-----BEGIN RSA PRIVATE KEY-----\nMIIkey\n-----END EC PRIVATE KEY----- after", "<redacted>"],
])("masks %s to the end of the text", (_name, input, expected) => {
	expect(redactText(input, isSensitiveKey)).toBe(expected);
});

it.each([
	["unterminated headers", "-----BEGIN RSA PRIVATE KEY-----".repeat(20_000)],
	["unterminated headers of many kinds", Array.from({ length: 20_000 }, (_, index) => `-----BEGIN K${index} PRIVATE KEY-----`).join("")],
	["headers without a key type", "-----BEGIN A ".repeat(50_000)],
	["closed blocks", "-----BEGIN PRIVATE KEY-----a-----END PRIVATE KEY-----".repeat(10_000)],
])("scans %s in linear time", (_name, input) => {
	const started = performance.now();
	redactText(input, isSensitiveKey, Number.POSITIVE_INFINITY);
	expect(performance.now() - started).toBeLessThan(1000);
});
