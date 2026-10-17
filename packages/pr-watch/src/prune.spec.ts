import { expect } from "vitest";
import { hasMergedPull, watchesFleet } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

for (const merged of [false, true]) {
	watch.it(`terminal merged=${merged} PRs make no further requests, even across restart`, [], function* (h) {
		yield* h.poll;
		h.pullIs(1, { merged, state: "closed" });
		const state = yield* h.poll;
		expect(state.prs["1"]).toMatchObject({ merged, state: "closed" });
		expect(h.eventNames()).toEqual([merged ? "merged" : "closed"]);
		const requests = h.requests.length;
		h.reply("/pulls/1", { body: {}, status: 500 });
		h.reply("/git/matching-refs/heads/gh-readonly-queue/", { body: {}, status: 500 });
		yield* h.poll;
		yield* h.restart;
		expect(h.requests).toHaveLength(requests);
		expect(h.events()).toHaveLength(1);
	});
}
watch.it("fleet retains terminal history and polls only new and still-open PRs", [watchesFleet()], function* (h) {
	yield* h.poll;
	h.merged(1);
	h.openPulls();
	yield* h.poll;
	const count = h.requests.length;
	yield* h.restart;
	expect(h.requests.slice(count).map((request) => request.path)).toEqual(["/repos/acme/project/pulls?state=open&per_page=100"]);
	h.pullIs(2);
	h.pullIs(3);
	h.openPulls(2, 3);
	const state = yield* h.poll;
	expect(state.prs["1"]?.merged).toBe(true);
	expect(Object.keys(state.prs)).toEqual(["1", "2", "3"]);
	expect(h.requests.filter((request) => request.path.endsWith("/pulls/1"))).toHaveLength(2);
	expect(h.events()).toHaveLength(1);
});
watch.it("a PR first observed as terminal is saved without a historical event and then pruned", [hasMergedPull(1)], function* (h) {
	yield* h.poll;
	const requests = h.requests.length;
	yield* h.restart;
	expect(h.requests).toHaveLength(requests);
	expect(h.events()).toEqual([]);
});
