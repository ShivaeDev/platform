import { expect } from "vitest";
import { watch } from "#test/watch.ts";

watch.it("CLI prints a failed round and polling stop as JSON alongside successful transitions", [], function* (h) {
	yield* h.poll;
	h.merged(1);
	h.pullIs(2, { mergeable: null, "mergeable_state": "unknown" });
	const result = yield* h.cliRun("1", "2", "--once");
	expect(result.code).toBe(1);
	expect(result.stderr).toContain("Mergeability pending for PR #2");
	expect(
		result.stdout
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line)),
	).toEqual([
		{ branch: "feature-1", event: "merged", number: 1, title: "Change 1" },
		expect.objectContaining({ event: "error", message: "Mergeability pending for PR #2" }),
		expect.objectContaining({ event: "stopped" }),
	]);
});
