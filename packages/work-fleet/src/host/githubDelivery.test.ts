import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Conflict, ServiceUnavailable } from "@shivaedev/contract/errors/taxonomy.ts";
import { failureCode } from "#engine/failureCode.ts";
import { failureContext } from "#engine/failureContext.ts";
import { githubHost } from "#test/githubHostStory.ts";

const result = { head: "reviewed-head", kind: "change", paths: ["src/task.ts"], pr: "https://github.com/example/repository/pull/42" } as const;
const open = { headRefOid: result.head, mergeCommit: null, mergedAt: null, state: "OPEN", url: result.pr };
const merged = { ...open, mergeCommit: { oid: "merge-revision" }, mergedAt: "2026-01-01T00:00:00Z", state: "MERGED" };

githubHost.it("reads only the adopted PR and waits for a human merge", [], function* (github) {
	expect(yield* github.delivery(Effect.succeed(open), result)).toBeUndefined();
	expect(github.deliveryRequests()).toEqual([result.pr]);
});

githubHost.it("records the reviewed head and actual merge revision", [], function* (github) {
	expect(yield* github.delivery(Effect.succeed(merged), result)).toEqual({
		head: result.head,
		revision: "merge-revision",
		url: result.pr,
	});
});

githubHost.it("reports a merged PR at its actual head before checking whether the head moved", [], function* (github) {
	expect(yield* github.delivery(Effect.succeed({ ...merged, headRefOid: "unreviewed-head" }), result)).toEqual({
		head: "unreviewed-head",
		revision: "merge-revision",
		url: result.pr,
	});
});

githubHost.it("carries the conflicting main revision only for an open PR at the adopted head", [], function* (github) {
	const conflict = { ...open, baseRefOid: "main-revision", mergeable: "CONFLICTING" };
	const error = yield* github.delivery(Effect.succeed(conflict), result).pipe(Effect.flip);
	expect(error).toBeInstanceOf(Conflict);
	expect(failureContext(error)).toMatchObject({ code: "pr-conflicting", mainRevision: "main-revision" });
	const moved = yield* github.delivery(Effect.succeed({ ...conflict, headRefOid: "new-head" }), result).pipe(Effect.flip);
	expect(moved).toBeInstanceOf(Conflict);
	expect(yield* github.delivery(Effect.succeed({ ...conflict, ...merged }), result)).toMatchObject({
		revision: "merge-revision",
	});
});

githubHost.it("waits for mergeable, unknown or incomplete mergeability observations", [], function* (github) {
	for (const observation of [
		{ ...open, baseRefOid: "main-revision", mergeable: "MERGEABLE", mergeStateStatus: "BEHIND" },
		{ ...open, baseRefOid: "main-revision", mergeable: "UNKNOWN" },
		{ ...open, mergeable: "CONFLICTING" },
	]) {
		expect(yield* github.delivery(Effect.succeed(observation), result)).toBeUndefined();
	}
});

githubHost.it("reports a closed unmerged PR explicitly even when its head changed", [], function* (github) {
	const error = yield* github.delivery(Effect.succeed({ ...open, headRefOid: "changed-head", state: "CLOSED" }), result).pipe(Effect.flip);
	expect(error.message).toContain("closed without merging");
});

githubHost.it("carries the observed head only when the adopted PR has consistent delivery evidence", [], function* (github) {
	const headRefOid = "current-head";
	const moved = yield* github.delivery(Effect.succeed({ ...open, headRefOid }), result).pipe(Effect.flip);
	expect(moved).toBeInstanceOf(Conflict);
	expect(failureContext(moved)).toEqual({ code: "pr-head-moved", head: headRefOid });
	const inconsistent = yield* github.delivery(Effect.succeed({ ...open, headRefOid, mergedAt: merged.mergedAt }), result).pipe(Effect.flip);
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
	githubHost.it(`rejects ${name}`, [], function* (github) {
		expect(yield* github.delivery(Effect.succeed(observation), result).pipe(Effect.flip)).toMatchObject({
			_tag: tag,
		});
	});
}

githubHost.it("preserves read failures and rejects unsupported URLs before invoking the CLI", [], function* (github) {
	const failure = Effect.fail(new ServiceUnavailable({ message: "Read failed" }));
	expect(yield* github.delivery(failure, result).pipe(Effect.flip)).toMatchObject({ message: "Read failed" });
	const invalid = yield* github.delivery(failure, { ...result, pr: "--repo=example/repository" }).pipe(Effect.flip);
	expect(failureCode(invalid)).toBe("delivery-pr-required");
	expect(invalid).toMatchObject({
		_tag: "BadRequest",
		message: "Delivery requires the adopted GitHub PR URL",
	});
});
