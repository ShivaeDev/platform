import { expect, it } from "vitest";
import { ciFailureDigest } from "#host/ciFailureDigest.ts";

it("keeps the first failure in full and counts later occurrences without repeating their assertions", () => {
	const digest = ciFailureDigest([
		{
			name: "verify",
			status: "readable",
			text: [
				" FAIL src/one.spec.ts > rejects the request",
				"AssertionError: expected 403 to be 200",
				"Expected: 200",
				"Received: 403",
				" ❯ src/one.spec.ts:10:4",
				" FAIL src/one.spec.ts > rejects the request",
				"AssertionError: later retry differs",
				" FAIL src/two.test.ts > saves the name",
				"AssertionError: expected alice to be bob",
			].join("\n"),
		},
	]);
	expect(digest).toContain(
		"Occurrences: 2 (1 repeat)\nAssertionError: expected 403 to be 200\nExpected: 200\nReceived: 403\n ❯ src/one.spec.ts:10:4",
	);
	expect(digest).not.toContain("later retry differs");
	expect(digest).toContain("FAIL src/two.test.ts > saves the name\nAssertionError: expected alice to be bob");
});

it("bounds the combined jobs and marks the cut while preserving the first complete failure", () => {
	const first = "FAIL src/one.spec.ts > first\nAssertionError: expected true to be false";
	const digest = ciFailureDigest([
		{ name: "verify", status: "readable", text: first },
		{ name: "browser", status: "readable", text: `FAIL src/two.spec.ts > second\nAssertionError: ${"details ".repeat(8000)}` },
	]);
	expect(digest.length).toBeLessThanOrEqual(24_000);
	expect(digest).toContain(first);
	expect(digest).toContain("CI failure digest truncated; remaining output omitted.");
});

it("includes compiler diagnostics when a failed job has no test failures", () => {
	const digest = ciFailureDigest([
		{
			name: "typecheck",
			status: "readable",
			text: "##[group]Run pnpm typecheck\nProgress: resolved 497\nsrc/app.ts(3,2): error TS2322: Type 'string' is not assignable to type 'number'.\n##[endgroup]",
		},
	]);
	expect(digest).toContain("Job: typecheck\nsrc/app.ts(3,2): error TS2322: Type 'string' is not assignable to type 'number'.");
	expect(digest).not.toContain("##[");
	expect(digest).not.toContain("Progress:");
});
