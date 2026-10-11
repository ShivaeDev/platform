import { Effect } from "effect";
import { expect } from "vitest";
import { effectApp } from "#test/services.ts";
import { Watcher } from "#Watcher.ts";

const refs = [{ ref: "refs/heads/gh-readonly-queue/main/pr-1-abc" }];

effectApp("fleet reports a downtime merge once across clean restarts", function* (h) {
	h.options.fleet = true;
	h.options.numbers = [];
	yield* h.cycle;
	h.setPull(1, { merged: true, state: "closed" });
	h.set("/pulls?state=open&per_page=100", { body: [] });
	yield* h.restart;
	const count = h.requests.length;
	yield* h.restart;
	expect(h.lines.map((line) => JSON.parse(line))).toEqual([{ branch: "feature-1", event: "merged", number: 1, title: "Change 1" }]);
	expect(h.requests.slice(count).map((request) => request.path)).toEqual(["/repos/acme/project/pulls?state=open&per_page=100"]);
});

effectApp("a PR can enter the queue and merge entirely between polls", function* (h) {
	h.options.fleet = true;
	h.options.numbers = [];
	yield* h.cycle;
	h.set("/git/matching-refs/heads/gh-readonly-queue/", { body: refs });
	h.setPull(1, { "auto_merge": null });
	h.set("/git/matching-refs/heads/gh-readonly-queue/", { body: [] });
	h.setPull(1, { "auto_merge": null, merged: true, state: "closed" });
	h.set("/pulls?state=open&per_page=100", { body: [] });
	yield* h.cycle;
	yield* h.restart;
	expect(h.lines.map((line) => JSON.parse(line).event)).toEqual(["merged"]);
	expect(h.requests.some((request) => request.path === "/graphql")).toBe(false);
});

effectApp.each(["mergeability", "checks", "detail", "queue"])(
	"fleet remembers an open PR when its first $item observation fails",
	function* (failure, h) {
		h.options.fleet = true;
		h.options.numbers = [];
		h.set("/git/matching-refs/heads/gh-readonly-queue/", { body: refs });
		h.setPull(1, { "auto_merge": null, mergeable: null, "mergeable_state": "unknown" });
		if (failure !== "mergeability") {
			h.setPull(1, { "auto_merge": null });
		}
		if (failure === "checks") {
			h.set("/commits/sha1/status", { body: {}, status: 500 });
		}
		if (failure === "detail") {
			h.set("/pulls/1", { body: {}, status: 500 });
		}
		if (failure === "queue") {
			h.set("/git/matching-refs/heads/gh-readonly-queue/", { body: {}, status: 500 });
		}
		expect((yield* Effect.result(h.cycle))._tag).toBe("Failure");
		expect(h.lines).toEqual([]);
		const watcher = yield* Watcher;
		expect(yield* watcher.load(h.options)).toMatchObject({ openNumbers: [1], prs: {} });
		h.setPull(1, { "auto_merge": null, merged: true, state: "closed" });
		h.set("/pulls?state=open&per_page=100", { body: [] });
		h.set("/git/matching-refs/heads/gh-readonly-queue/", { body: [] });
		expect((yield* h.restart).openNumbers).toEqual([]);
		yield* h.restart;
		expect(h.lines.map((line) => JSON.parse(line).event)).toEqual(["merged"]);
	},
);

effectApp.each([false, true])("discovery-only tracking reports a later terminal merged=$item observation once", function* (merged, h) {
	h.options.fleet = true;
	h.options.numbers = [];
	h.setPull(1, { mergeable: null, "mergeable_state": "unknown" });
	yield* Effect.result(h.cycle);
	h.set("/pulls?state=open&per_page=100", { body: [] });
	h.setPull(1, { merged, state: "closed" });
	yield* h.cycle;
	yield* h.restart;
	expect(h.lines.map((line) => JSON.parse(line).event)).toEqual([merged ? "merged" : "closed"]);
});

effectApp("a discovered PR still establishes its first complete open baseline", function* (h) {
	h.options.fleet = true;
	h.options.numbers = [];
	h.set("/git/matching-refs/heads/gh-readonly-queue/", { body: refs });
	h.setPull(1, { mergeable: null, "mergeable_state": "unknown" });
	yield* Effect.result(h.cycle);
	h.setPull(1, { mergeable: false, "mergeable_state": "dirty" });
	yield* h.restart;
	expect(h.lines.map((line) => JSON.parse(line).event)).toEqual(["conflict", "stuck"]);
	h.setPull(1, { merged: true, state: "closed" });
	h.set("/pulls?state=open&per_page=100", { body: [] });
	h.set("/git/matching-refs/heads/gh-readonly-queue/", { body: [] });
	yield* h.restart;
	yield* h.restart;
	expect(h.lines.map((line) => JSON.parse(line).event)).toEqual(["conflict", "stuck", "merged"]);
});

effectApp("fleet reports a PR that merges between discovery and its first detail response", function* (h) {
	h.options.fleet = true;
	h.options.numbers = [];
	h.setPull(1, { merged: true, state: "closed" });
	yield* h.cycle;
	yield* h.restart;
	expect(h.lines.map((line) => JSON.parse(line).event)).toEqual(["merged"]);
});
