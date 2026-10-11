import { Effect } from "effect";
import { expect } from "vitest";
import { effectApp } from "#test/services.ts";

effectApp("fleet startup reports all already-stuck PRs and persists the baseline", function* (h) {
	h.options.fleet = true;
	h.options.numbers = [];
	h.setPull(1, { mergeable: false, "mergeable_state": "dirty" });
	h.setPull(2);
	h.set("/commits/sha2/status", { body: { state: "failure" } });
	h.setPull(3, { mergeable: false, "mergeable_state": "dirty" });
	h.set("/commits/sha3/check-runs?per_page=100&filter=latest", { body: { "check_runs": [{ conclusion: "failure", status: "completed" }] } });
	h.setPull(4);
	h.setPull(5, { "auto_merge": null });
	h.set("/commits/sha5/status", { body: { state: "failure" } });
	h.set("/pulls?state=open&per_page=100", { body: [1, 2, 3, 4, 5].map((number) => ({ number })) });
	const state = yield* h.cycle;
	expect(h.lines.map((line) => JSON.parse(line))).toEqual([
		{ branch: "feature-1", event: "conflict", number: 1, title: "Change 1" },
		{ branch: "feature-1", event: "stuck", number: 1, title: "Change 1" },
		{ branch: "feature-2", event: "checks-failed", number: 2, title: "Change 2" },
		{ branch: "feature-2", event: "stuck", number: 2, title: "Change 2" },
		{ branch: "feature-3", event: "conflict", number: 3, title: "Change 3" },
		{ branch: "feature-3", event: "checks-failed", number: 3, title: "Change 3" },
		{ branch: "feature-3", event: "stuck", number: 3, title: "Change 3" },
	]);
	expect(Object.keys(state.prs)).toHaveLength(5);
	yield* h.cycle;
	yield* h.restart;
	expect(h.lines).toHaveLength(7);
});
effectApp("an incomplete initial observation reports stuck only after valid evidence arrives", function* (h) {
	h.setPull(1, { mergeable: false, "mergeable_state": "dirty" });
	h.set("/commits/sha1/status", { body: {}, status: 500 });
	yield* h.cycle.pipe(Effect.result);
	expect(h.lines).toEqual([]);
	h.set("/commits/sha1/status", { body: { state: "success" } });
	yield* h.cycle;
	expect(h.lines.map((line) => JSON.parse(line).event)).toEqual(["conflict", "stuck"]);
});
