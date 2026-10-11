import { expect } from "vitest";
import { effectApp } from "#test/services.ts";

const cases = [
	{ changes: { merged: true, state: "closed" }, event: "merged" },
	{ changes: { state: "closed" }, event: "closed" },
	{ changes: { mergeable: false, "mergeable_state": "dirty" }, event: "conflict" },
	{ changes: { "auto_merge": null }, event: "auto-merge-off" },
];
effectApp.each(cases)("observes $event once with PR identity", function* ({ event, changes }, h) {
	yield* h.cycle;
	h.setPull(1, changes);
	yield* h.cycle;
	expect(h.lines).toContain(JSON.stringify({ branch: "feature-1", event, number: 1, title: "Change 1" }));
	expect(h.lines.some((line) => line.includes('"stuck"'))).toBe(event === "conflict");
	const count = h.lines.length;
	yield* h.restart;
	expect(h.lines).toHaveLength(count);
});
effectApp("confirmed queue disappearance emits dequeued only while open", function* (h) {
	h.set("/git/matching-refs/heads/gh-readonly-queue/", { body: [{ ref: "refs/heads/gh-readonly-queue/main/pr-1-abc" }] });
	yield* h.cycle;
	h.set("/git/matching-refs/heads/gh-readonly-queue/", { body: [] });
	h.setPull(1, { "auto_merge": null });
	yield* h.cycle;
	expect(h.lines.map((line) => JSON.parse(line).event)).toEqual(["dequeued", "auto-merge-off"]);
	h.setPull(1, { merged: true, state: "closed" });
	yield* h.cycle;
	expect(h.lines).toHaveLength(3);
});
effectApp("failed check runs and commit statuses produce checks-failed and stuck", function* (h) {
	yield* h.cycle;
	h.set("/commits/sha1/check-runs?per_page=100&filter=latest", { body: { "check_runs": [{ conclusion: "timed_out", status: "completed" }] } });
	yield* h.cycle;
	expect(h.lines.map((line) => JSON.parse(line).event)).toEqual(["checks-failed", "stuck"]);
	h.set("/commits/sha1/check-runs?per_page=100&filter=latest", { body: { "check_runs": [{ conclusion: "neutral", status: "completed" }] } });
	yield* h.cycle;
	h.set("/commits/sha1/status", { body: { state: "error" } });
	yield* h.cycle;
	expect(h.lines.map((line) => JSON.parse(line).event)).toEqual(["checks-failed", "stuck", "checks-failed", "stuck"]);
});
effectApp("enabling auto-merge on failing checks emits stuck without repeating checks-failed", function* (h) {
	h.setPull(1, { "auto_merge": null });
	h.set("/commits/sha1/status", { body: { state: "failure" } });
	yield* h.cycle;
	h.set("/pulls/1", {
		body: {
			"auto_merge": { "merge_method": "squash" },
			head: { ref: "feature-1", sha: "sha1" },
			mergeable: true,
			"mergeable_state": "clean",
			merged: false,
			number: 1,
			state: "open",
			title: "Change 1",
		},
	});
	yield* h.cycle;
	expect(h.lines.map((line) => JSON.parse(line).event)).toEqual(["stuck"]);
});
