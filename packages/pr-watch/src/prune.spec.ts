import { expect } from "vitest";
import { effectApp } from "#test/services.ts";

effectApp.each([false, true])("terminal merged=$item PRs make no further requests, even across restart", function* (merged, h) {
	yield* h.cycle;
	h.setPull(1, { merged, state: "closed" });
	const state = yield* h.cycle;
	expect(state.prs["1"]).toMatchObject({ merged, state: "closed" });
	expect(h.lines.map((line) => JSON.parse(line).event)).toEqual([merged ? "merged" : "closed"]);
	const requests = h.requests.length;
	h.set("/pulls/1", { body: {}, status: 500 });
	h.set("/git/matching-refs/heads/gh-readonly-queue/", { body: {}, status: 500 });
	yield* h.cycle;
	yield* h.restart;
	expect(h.requests).toHaveLength(requests);
	expect(h.lines).toHaveLength(1);
});
effectApp("fleet retains terminal history and polls only new and still-open PRs", function* (h) {
	h.options.fleet = true;
	h.options.numbers = [];
	yield* h.cycle;
	h.setPull(1, { merged: true, state: "closed" });
	h.set("/pulls?state=open&per_page=100", { body: [] });
	yield* h.cycle;
	const count = h.requests.length;
	yield* h.restart;
	expect(h.requests.slice(count).map((request) => request.path)).toEqual(["/repos/acme/project/pulls?state=open&per_page=100"]);
	h.setPull(2);
	h.setPull(3);
	h.set("/pulls?state=open&per_page=100", { body: [{ number: 2 }, { number: 3 }] });
	const state = yield* h.cycle;
	expect(state.prs["1"]?.merged).toBe(true);
	expect(Object.keys(state.prs)).toEqual(["1", "2", "3"]);
	expect(h.requests.filter((request) => request.path.endsWith("/pulls/1"))).toHaveLength(2);
	expect(h.lines).toHaveLength(1);
});
effectApp("a PR first observed as terminal is saved without a historical event and then pruned", function* (h) {
	h.setPull(1, { merged: true, state: "closed" });
	yield* h.cycle;
	const requests = h.requests.length;
	yield* h.restart;
	expect(h.requests).toHaveLength(requests);
	expect(h.lines).toEqual([]);
});
