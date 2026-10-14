import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Conflict, ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { failureCode } from "#engine/failureCode.ts";
import { failureContext } from "#engine/failureContext.ts";
import { githubDelivery } from "#host/githubDelivery.ts";

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

it.effect("reports a merged PR at its actual head before checking whether the head moved", function* () {
	expect(yield* githubDelivery("/repository", () => Effect.succeed({ ...merged, headRefOid: "unreviewed-head" }))(result)).toEqual({
		head: "unreviewed-head",
		revision: "merge-revision",
		url: result.pr,
	});
});

it.effect("carries the conflicting main revision only for an open PR at the adopted head", function* () {
	const conflict = { ...open, baseRefOid: "main-revision", mergeable: "CONFLICTING" };
	const error = yield* githubDelivery("/repository", () => Effect.succeed(conflict))(result).pipe(Effect.flip);
	expect(error).toBeInstanceOf(Conflict);
	expect(failureContext(error)).toMatchObject({ code: "pr-conflicting", mainRevision: "main-revision" });
	const moved = yield* githubDelivery("/repository", () => Effect.succeed({ ...conflict, headRefOid: "new-head" }))(result).pipe(Effect.flip);
	expect(moved).toBeInstanceOf(Conflict);
	expect(yield* githubDelivery("/repository", () => Effect.succeed({ ...conflict, ...merged }))(result)).toMatchObject({
		revision: "merge-revision",
	});
});

it.effect("waits for mergeable, unknown or incomplete mergeability observations", function* () {
	for (const observation of [
		{ ...open, baseRefOid: "main-revision", mergeable: "MERGEABLE", mergeStateStatus: "BEHIND" },
		{ ...open, baseRefOid: "main-revision", mergeable: "UNKNOWN" },
		{ ...open, mergeable: "CONFLICTING" },
	]) {
		expect(yield* githubDelivery("/repository", () => Effect.succeed(observation))(result)).toBeUndefined();
	}
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
	expect(moved).toBeInstanceOf(Conflict);
	expect(failureContext(moved)).toEqual({ code: "pr-head-moved", head: headRefOid });
	const inconsistent = yield* githubDelivery("/repository", () => Effect.succeed({ ...open, headRefOid, mergedAt: merged.mergedAt }))(result).pipe(
		Effect.flip,
	);
	expect(failureContext(inconsistent).head).toBeUndefined();
	expect(inconsistent.message).toContain("inconsistent");
});

for (const [name, observation, tag] of [
	["another PR", { ...merged, url: "https://github.com/example/repository/pull/43" }, "BadRequest"],
	["a missing merge revision", { ...merged, mergeCommit: null }, "BadRequest"],
	["a missing merge time", { ...merged, mergedAt: null }, "BadRequest"],
	["contradictory open evidence", { ...open, mergedAt: merged.mergedAt }, "BadRequest"],
	["an unknown response", {}, "ServiceUnavailable"],
] as const) {
	it.effect(`rejects ${name}`, function* () {
		expect(yield* githubDelivery("/repository", () => Effect.succeed(observation))(result).pipe(Effect.flip)).toMatchObject({
			_tag: tag,
		});
	});
}

it.effect("preserves read failures and rejects unsupported URLs before invoking the CLI", function* () {
	function read() {
		return Effect.fail(new ServiceUnavailable({ message: "Read failed" }));
	}
	expect(yield* githubDelivery("/repository", read)(result).pipe(Effect.flip)).toMatchObject({ message: "Read failed" });
	const invalid = yield* githubDelivery("/repository", read)({ ...result, pr: "--repo=example/repository" }).pipe(Effect.flip);
	expect(failureCode(invalid)).toBe("delivery-pr-required");
	expect(invalid).toMatchObject({
		_tag: "BadRequest",
		message: "Delivery requires the adopted GitHub PR URL",
	});
});
