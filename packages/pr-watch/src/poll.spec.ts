import { readFile } from "node:fs/promises";
import { Clock, Effect } from "effect";
import { expect } from "vitest";
import { effectApp } from "#test/services.ts";
import { Watcher } from "#Watcher.ts";

effectApp("ETag 304 reuses all successful snapshots without events", function* (h) {
	yield* h.cycle;
	yield* h.cycle;
	const last = h.requests.slice(-4);
	expect(last).toHaveLength(4);
	expect(last.every((request) => request.status === 304 && request.etag !== undefined)).toBe(true);
	expect(last.every((request) => request.authorization === "Bearer test-token")).toBe(true);
	expect(h.lines).toEqual([]);
});
effectApp("restart observes downtime differences and does not repeat acknowledged events", function* (h) {
	yield* h.cycle;
	h.setPull(1, { merged: true, state: "closed" });
	yield* h.restart;
	yield* h.restart;
	expect(h.lines.map((line) => JSON.parse(line).event)).toEqual(["merged"]);
	const persisted = yield* Effect.promise(() => readFile(h.options.stateFile, "utf8"));
	expect(JSON.parse(persisted).prs["1"].merged).toBe(true);
});
effectApp("fleet discovers later PRs, follows closed PRs and paginates discovery", function* (h) {
	h.options.fleet = true;
	h.options.numbers = [];
	yield* h.cycle;
	h.setPull(2);
	h.set("/pulls?state=open&per_page=100", {
		body: [{ number: 1 }],
		headers: { link: `<${h.options.apiUrl}/repos/acme/project/pulls?page=2>; rel="next"` },
	});
	h.set("/pulls?page=2", { body: [{ number: 2 }] });
	yield* h.cycle;
	h.setPull(2, { state: "closed" });
	h.set("/pulls?state=open&per_page=100", { body: [{ number: 1 }] });
	yield* h.cycle;
	expect(h.lines.map((line) => JSON.parse(line))).toEqual([{ branch: "feature-2", event: "closed", number: 2, title: "Change 2" }]);
});
effectApp("multiple explicit PRs share one queue request per cycle", function* (h) {
	h.options.numbers = [1, 2];
	h.setPull(2);
	yield* h.cycle;
	h.setPull(1, { state: "closed" });
	h.setPull(2, { merged: true, state: "closed" });
	yield* h.cycle;
	expect(h.lines.map((line) => JSON.parse(line).event)).toEqual(["closed", "merged"]);
	expect(h.requests.filter((request) => request.path.includes("matching-refs"))).toHaveLength(2);
});
effectApp.each([500, 403, 429])("HTTP $item produces no inferred events", function* (status, h) {
	yield* h.cycle;
	h.setPull(1, { mergeable: false, "mergeable_state": "dirty" });
	h.set("/commits/sha1/status", { body: {}, headers: { "retry-after": "2" }, status });
	expect((yield* Effect.result(h.cycle))._tag).toBe("Failure");
	const watcher = yield* Watcher;
	expect((yield* watcher.load(h.options)).prs["1"]?.dirty).toBe(false);
	expect(h.lines).toEqual([]);
	expect(h.diagnostics).toHaveLength(1);
});
effectApp("a failed queue request does not imply dequeue", function* (h) {
	h.set("/git/matching-refs/heads/gh-readonly-queue/", { body: [{ ref: "refs/heads/gh-readonly-queue/main/pr-1-abc" }] });
	yield* h.cycle;
	h.set("/git/matching-refs/heads/gh-readonly-queue/", { body: [], status: 500 });
	yield* Effect.result(h.cycle);
	expect(h.lines).toEqual([]);
	h.set("/git/matching-refs/heads/gh-readonly-queue/", { body: [] });
	yield* h.cycle;
	expect(h.lines.map((line) => JSON.parse(line).event)).toEqual(["dequeued"]);
});
effectApp("malformed responses and unknown mergeability retain the old state", function* (h) {
	yield* h.cycle;
	h.set("/pulls/1", { body: {} });
	yield* Effect.result(h.cycle);
	h.setPull(1, { mergeable: null, "mergeable_state": "unknown" });
	yield* Effect.result(h.cycle);
	expect(h.lines).toEqual([]);
	expect(h.diagnostics).toHaveLength(2);
});
effectApp("invalid state and a different repository fail without overwriting it", function* (h) {
	yield* h.withStateText("broken");
	expect((yield* Effect.result(h.cycle))._tag).toBe("Failure");
	yield* h.withStateText(JSON.stringify({ prs: {}, repository: "other/project", version: 1 }));
	expect((yield* Effect.result(h.cycle))._tag).toBe("Failure");
	expect(h.requests).toEqual([]);
});
effectApp("quota headers slow down polling and honor retry-after without further requests", function* (h) {
	const watcher = yield* Watcher;
	yield* h.cycle;
	expect(yield* watcher.delay(60_000)).toBe(60_000);
	h.set("/commits/sha1/status", {
		body: { state: "success" },
		headers: {
			"x-ratelimit-limit": "5000",
			"x-ratelimit-remaining": "400",
			"x-ratelimit-reset": String(Math.ceil((yield* Clock.currentTimeMillis) / 1000) + 3600),
		},
	});
	yield* h.cycle;
	expect(yield* watcher.delay(60_000)).toBeGreaterThanOrEqual(600_000);
	h.set("/commits/sha1/status", { body: {}, headers: { "retry-after": "900" }, status: 429 });
	yield* Effect.result(h.cycle);
	expect(yield* watcher.delay(60_000)).toBeGreaterThan(890_000);
	const count = h.requests.length;
	yield* Effect.result(h.cycle);
	expect(h.requests).toHaveLength(count);
	expect(h.lines).toEqual([]);
});
