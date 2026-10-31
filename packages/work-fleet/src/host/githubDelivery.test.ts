import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { githubHost } from "#test/githubHostStory.ts";

const result = { head: "reviewed-head", kind: "change", paths: ["src/task.ts"], pr: "https://github.com/example/repository/pull/42" } as const;
const open = { headRefOid: result.head, mergeCommit: null, mergedAt: null, state: "OPEN", url: result.pr };
const merged = { ...open, mergeCommit: { oid: "merge-revision" }, mergedAt: "2026-01-01T00:00:00Z", state: "MERGED" };
const conflicting = { ...open, baseRefOid: "main-revision", mergeable: "CONFLICTING" };

githubHost.it("an open adopted PR waits for a human merge after reading only that PR", [], function* (github) {
	const delivery = yield* github.deliveryOutcome(Effect.succeed(open), result);

	expect(delivery).toBe("waiting");
	expect(github.deliveryRequests()).toEqual([result.pr]);
});

for (const [name, observation, expected] of [
	["a merged PR records the reviewed head and actual merge revision", merged, `merged merge-revision at reviewed-head for ${result.pr}`],
	[
		"a merged PR at another head reports that head before checking whether the head moved",
		{ ...merged, headRefOid: "unreviewed-head" },
		`merged merge-revision at unreviewed-head for ${result.pr}`,
	],
	[
		"a conflicting open PR at the adopted head carries the conflicting main revision",
		conflicting,
		expect.stringMatching(/^conflict: .* \(pr-conflicting, main main-revision\)$/u),
	],
	[
		"a conflicting open PR at a new head reports the moved head without a main revision",
		{ ...conflicting, headRefOid: "new-head" },
		expect.stringMatching(/^conflict: .* \(pr-head-moved, head new-head\)$/u),
	],
	["a merged PR wins over a conflicting observation", { ...conflicting, ...merged }, `merged merge-revision at reviewed-head for ${result.pr}`],
	["a mergeable PR behind main waits", { ...open, baseRefOid: "main-revision", mergeable: "MERGEABLE", mergeStateStatus: "BEHIND" }, "waiting"],
	["an unknown mergeability waits", { ...open, baseRefOid: "main-revision", mergeable: "UNKNOWN" }, "waiting"],
	["a conflict without a main revision waits", { ...open, mergeable: "CONFLICTING" }, "waiting"],
	[
		"a closed unmerged PR is reported explicitly even when its head changed",
		{ ...open, headRefOid: "changed-head", state: "CLOSED" },
		expect.stringContaining("closed without merging"),
	],
	[
		"an open PR at a moved head carries the observed head",
		{ ...open, headRefOid: "current-head" },
		expect.stringMatching(/^conflict: .* \(pr-head-moved, head current-head\)$/u),
	],
	[
		"a moved head with merge time but no merge state is inconsistent and carries no head",
		{ ...open, headRefOid: "current-head", mergedAt: merged.mergedAt },
		expect.stringMatching(/^bad request: [^(]*inconsistent[^(]*$/u),
	],
	[
		"a merged observation of another PR is refused",
		{ ...merged, url: "https://github.com/example/repository/pull/43" },
		expect.stringMatching(/^bad request: /u),
	],
	["a merged PR without a merge revision is refused", { ...merged, mergeCommit: null }, expect.stringMatching(/^bad request: /u)],
	["a merged PR without a merge time is refused", { ...merged, mergedAt: null }, expect.stringMatching(/^bad request: /u)],
	["contradictory open evidence is refused", { ...open, mergedAt: merged.mergedAt }, expect.stringMatching(/^bad request: /u)],
	["an unknown response is unavailable", {}, expect.stringMatching(/^unavailable: /u)],
] as const) {
	githubHost.it(name, [], function* (github) {
		const delivery = yield* github.deliveryOutcome(Effect.succeed(observation), result);

		expect(delivery).toEqual(expected);
	});
}

githubHost.it("a failed PR read keeps its own failure", [], function* (github) {
	const delivery = yield* github.deliveryOutcome(Effect.fail(new ServiceUnavailable({ message: "Read failed" })), result);

	expect(delivery).toBe("unavailable: Read failed");
});

githubHost.it("an unsupported PR URL is refused before reading GitHub", [], function* (github) {
	const delivery = yield* github.deliveryOutcome(Effect.succeed(open), { ...result, pr: "--repo=example/repository" });

	expect(delivery).toBe("bad request: Delivery requires the adopted GitHub PR URL (delivery-pr-required)");
	expect(github.deliveryRequests()).toEqual([]);
});
