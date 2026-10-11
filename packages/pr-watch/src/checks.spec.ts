import { Effect } from "effect";
import { expect } from "vitest";
import { effectApp } from "#test/services.ts";

effectApp.each(["failure", "timed_out", "cancelled", "action_required", "startup_failure", "stale"])(
	"completed $item is failure evidence",
	function* (conclusion, h) {
		yield* h.cycle;
		h.set("/commits/sha1/check-runs?per_page=100&filter=latest", { body: { "check_runs": [{ conclusion, status: "completed" }] } });
		yield* h.cycle;
		expect(h.lines.map((line) => JSON.parse(line).event)).toEqual(["checks-failed", "stuck"]);
	},
);
effectApp.each(["neutral", "skipped", "success", null])("$item and pending check runs do not infer failure", function* (conclusion, h) {
	yield* h.cycle;
	h.set("/commits/sha1/check-runs?per_page=100&filter=latest", {
		body: {
			"check_runs": [
				{ conclusion, status: "completed" },
				{ conclusion: "failure", status: "in_progress" },
			],
		},
	});
	yield* h.cycle;
	expect(h.lines).toEqual([]);
});
effectApp("checks and queue refs include later pages", function* (h) {
	yield* h.cycle;
	h.set("/commits/sha1/check-runs?per_page=100&filter=latest", {
		body: { "check_runs": [] },
		headers: { link: `<${h.options.apiUrl}/repos/acme/project/checks?page=2>; rel="next"` },
	});
	h.set("/checks?page=2", { body: { "check_runs": [{ conclusion: "failure", status: "completed" }] } });
	h.set("/git/matching-refs/heads/gh-readonly-queue/", {
		body: [],
		headers: { link: `<${h.options.apiUrl}/repos/acme/project/refs?page=2>; rel="next"` },
	});
	h.set("/refs?page=2", { body: [{ ref: "refs/heads/gh-readonly-queue/main/pr-1-abc" }] });
	const state = yield* h.cycle;
	expect(state.prs["1"]?.queued).toBe(true);
	expect(h.lines.map((line) => JSON.parse(line).event)).toEqual(["queued", "checks-failed", "stuck"]);
});
effectApp("a new head uses its own checks and preserves updated event identity", function* (h) {
	yield* h.cycle;
	h.setPull(1, { head: { ref: "new-branch", sha: "new-head" }, title: "Changed\ntitle" });
	h.set("/commits/new-head/check-runs?per_page=100&filter=latest", { body: { "check_runs": [] } });
	h.set("/commits/new-head/status", { body: { state: "failure" } });
	yield* h.cycle;
	expect(JSON.parse(h.lines[0] ?? "")).toEqual({ branch: "new-branch", event: "checks-failed", number: 1, title: "Changed\ntitle" });
	expect(h.lines).toHaveLength(2);
});
effectApp("a failed later checks page retains the last successful snapshot", function* (h) {
	yield* h.cycle;
	h.set("/commits/sha1/check-runs?per_page=100&filter=latest", {
		body: { "check_runs": [{ conclusion: "failure", status: "completed" }] },
		headers: { link: `<${h.options.apiUrl}/repos/acme/project/checks?page=2>; rel="next"` },
	});
	h.set("/checks?page=2", { body: {}, status: 500 });
	expect((yield* Effect.result(h.cycle))._tag).toBe("Failure");
	expect(h.lines).toEqual([]);
});
