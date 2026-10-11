import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { githubDelivery } from "#host/githubDelivery.ts";
import { MovedPrHead } from "#host/movedPrHead.ts";
import { FleetFailure } from "#policy.ts";

const result = { head: "reviewed-head", kind: "change", paths: ["src/task.ts"], pr: "https://github.com/example/repository/pull/42" } as const;
const open = { headRefOid: result.head, mergeCommit: null, mergedAt: null, state: "OPEN", url: result.pr };
const merged = { ...open, mergeCommit: { oid: "merge-revision" }, mergedAt: "2026-01-01T00:00:00Z", state: "MERGED" };

it.effect("reads only the adopted PR and waits for a human merge", function* () {
	const reads: string[][] = [];
	const observe = githubDelivery("/repository", (cwd, pr) => {
		reads.push([cwd, pr]);
		return Effect.succeed(open);
	});
	expect(yield* observe(result)).toBeUndefined();
	expect(reads).toEqual([["/repository", result.pr]]);
});

it.effect("records the reviewed head and actual merge revision", function* () {
	expect(yield* githubDelivery("/repository", () => Effect.succeed(merged))(result)).toEqual({
		head: result.head,
		revision: "merge-revision",
		url: result.pr,
	});
});

it.effect("reports a closed unmerged PR explicitly even when its head changed", function* () {
	const error = yield* githubDelivery("/repository", () => Effect.succeed({ ...open, headRefOid: "changed-head", state: "CLOSED" }))(result).pipe(
		Effect.flip,
	);
	expect(error.message).toContain("closed without merging");
});

it.effect("carries the observed head only when the adopted PR has consistent delivery evidence", function* () {
	const headRefOid = "current-head";
	const moved = yield* githubDelivery("/repository", () => Effect.succeed({ ...open, headRefOid }))(result).pipe(Effect.flip);
	expect(moved).toBeInstanceOf(MovedPrHead);
	expect(moved).toMatchObject({ head: headRefOid, reason: "stale" });
	const inconsistent = yield* githubDelivery("/repository", () => Effect.succeed({ ...open, headRefOid, mergedAt: merged.mergedAt }))(result).pipe(
		Effect.flip,
	);
	expect(inconsistent).not.toBeInstanceOf(MovedPrHead);
	expect(inconsistent.message).toContain("inconsistent");
});

for (const [name, observation] of [
	["another PR", { ...merged, url: "https://github.com/example/repository/pull/43" }],
	["a changed head", { ...merged, headRefOid: "unreviewed-head" }],
	["a missing merge revision", { ...merged, mergeCommit: null }],
	["a missing merge time", { ...merged, mergedAt: null }],
	["contradictory open evidence", { ...open, mergedAt: merged.mergedAt }],
	["an unknown response", {}],
] as const) {
	it.effect(`rejects ${name}`, function* () {
		expect(yield* githubDelivery("/repository", () => Effect.succeed(observation))(result).pipe(Effect.flip)).toMatchObject({ _tag: "FleetFailure" });
	});
}

it.effect("preserves read failures and rejects unsupported URLs before invoking the CLI", function* () {
	function read() {
		return Effect.fail(new FleetFailure({ message: "Read failed", reason: "integration" }));
	}
	expect(yield* githubDelivery("/repository", read)(result).pipe(Effect.flip)).toMatchObject({ message: "Read failed" });
	expect(yield* githubDelivery("/repository", read)({ ...result, pr: "--repo=example/repository" }).pipe(Effect.flip)).toMatchObject({
		code: "delivery-pr-required",
		message: "Delivery requires the adopted GitHub PR URL",
	});
});
