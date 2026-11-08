import { expect, it } from "vitest";
import { releaseHoldReason } from "#release/holdReason.ts";

const pull = { headRefOid: "current-head", mergeQueueEntry: null, state: "OPEN" };
const currentRun = { headSha: pull.headRefOid };

for (const [name, status, conclusion, expected] of [
	["waiting for approval", "completed", "action_required", undefined],
	["waiting", "waiting", null, undefined],
	["approved and running", "in_progress", null, "approved CI in_progress"],
	["succeeded", "completed", "success", "CI succeeded"],
	["failed", "completed", "failure", undefined],
	["cancelled", "completed", "cancelled", undefined],
	["approved and queued", "queued", null, "approved CI queued"],
] as const) {
	it(`${name} CI determines whether to hold the release`, () => {
		expect(releaseHoldReason(pull, { ...currentRun, conclusion, status })).toBe(expected);
	});
}

it("holds a release in the merge queue even if CI was cancelled", () => {
	expect(
		releaseHoldReason({ ...pull, mergeQueueEntry: { id: "queue-entry" } }, { ...currentRun, conclusion: "cancelled", status: "completed" }),
	).toBe("merge queue");
});

it("releases a closed PR even if its CI succeeded or it was queued", () => {
	expect(
		releaseHoldReason(
			{ ...pull, mergeQueueEntry: { id: "queue-entry" }, state: "CLOSED" },
			{ ...currentRun, conclusion: "success", status: "completed" },
		),
	).toBe(undefined);
});

it("does not hold for CI on a previous head or for a missing run or PR", () => {
	expect(releaseHoldReason(pull, { ...currentRun, conclusion: "success", headSha: "previous-head", status: "completed" })).toBe(undefined);
	expect(releaseHoldReason(pull)).toBe(undefined);
	expect(releaseHoldReason(undefined)).toBe(undefined);
});
