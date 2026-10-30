import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { watch } from "#test/watch.ts";

for (const conclusion of ["failure", "timed_out", "cancelled", "action_required", "startup_failure", "stale"]) {
	watch.it(`completed ${conclusion} is failure evidence`, [], function* (h) {
		yield* h.poll;
		h.checksAre(1, [{ conclusion, status: "completed" }]);
		yield* h.poll;
		expect(h.eventNames()).toEqual(["checks-failed", "stuck"]);
	});
}
for (const conclusion of ["neutral", "skipped", "success", null]) {
	watch.it(`${conclusion} and pending check runs do not infer failure`, [], function* (h) {
		yield* h.poll;
		h.checksAre(1, [
			{ conclusion, status: "completed" },
			{ conclusion: "failure", status: "in_progress" },
		]);
		yield* h.poll;
		expect(h.events()).toEqual([]);
	});
}
watch.it("checks and queue refs include later pages", [], function* (h) {
	yield* h.poll;
	h.pages("/commits/sha1/check-runs?per_page=100&filter=latest", { "check_runs": [] }, "/checks?page=2", {
		body: { "check_runs": [{ conclusion: "failure", "node_id": "check", status: "completed" }] },
	});
	h.pages("/git/matching-refs/heads/gh-readonly-queue/", [], "/refs?page=2", { body: [{ ref: "refs/heads/gh-readonly-queue/main/pr-1-abc" }] });
	const state = yield* h.poll;
	expect(state.prs["1"]?.queued).toBe(true);
	expect(h.eventNames()).toEqual(["queued", "checks-failed", "stuck"]);
});
watch.it("a new head uses its own checks and preserves updated event identity", [], function* (h) {
	yield* h.poll;
	h.pullIs(1, { head: { ref: "new-branch", sha: "new-head" }, title: "Changed\ntitle" });
	h.checksAre(1, [], "new-head");
	h.statusIs(1, "failure", "new-head");
	yield* h.poll;
	expect(h.events()).toEqual([
		{ branch: "new-branch", event: "checks-failed", number: 1, title: "Changed\ntitle" },
		{ branch: "new-branch", event: "stuck", number: 1, title: "Changed\ntitle" },
	]);
});
watch.it("a failed later checks page retains the last successful snapshot", [], function* (h) {
	yield* h.poll;
	h.pages(
		"/commits/sha1/check-runs?per_page=100&filter=latest",
		{ "check_runs": [{ conclusion: "failure", "node_id": "check", status: "completed" }] },
		"/checks?page=2",
		{ body: {}, status: HttpStatus.fromLiteral("InternalServerError") },
	);
	expect((yield* Effect.result(h.poll))._tag).toBe("Failure");
	expect(h.events()).toEqual([]);
});

watch.it("a cross-origin next page fails without sending credentials or inferring failed checks", [], function* (h) {
	yield* h.poll;
	h.reply("/commits/sha1/check-runs?per_page=100&filter=latest", {
		body: { "check_runs": [{ conclusion: "failure", "node_id": "check", status: "completed" }] },
		headers: { link: '<https://other.example/checks?page=2>; rel="next"' },
	});
	expect((yield* Effect.result(h.poll))._tag).toBe("Failure");
	expect(h.io.urls.every((url) => url.startsWith(h.options.apiUrl))).toBe(true);
	expect(h.events()).toEqual([]);
	expect((yield* h.saved()).prs["1"]?.failed).toBe(false);
});

watch.it("a required commit status failure on a later page still marks auto-merge stuck", [], function* (h) {
	yield* h.poll;
	h.pages("/commits/sha1/status", { state: "pending", statuses: [] }, "/statuses?page=2", {
		body: { state: "failure", statuses: [{ context: "ci", state: "failure" }] },
	});

	yield* h.poll;

	expect(h.eventNames()).toEqual(["checks-failed", "stuck"]);
});
