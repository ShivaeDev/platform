import assert from "node:assert/strict";
import { test as it } from "node:test";
import { releaseHoldReason } from "./holdReason.ts";

const pull = { headRefOid: "current-head", mergeQueueEntry: null, state: "OPEN" };
const currentRun = { "head_sha": pull.headRefOid };

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
		assert.equal(releaseHoldReason(pull, { ...currentRun, conclusion, status }), expected);
	});
}

it("holds a release in the merge queue even if CI was cancelled", () => {
	assert.equal(
		releaseHoldReason({ ...pull, mergeQueueEntry: { id: "queue-entry" } }, { ...currentRun, conclusion: "cancelled", status: "completed" }),
		"merge queue",
	);
});

it("releases a closed PR even if its CI succeeded or it was queued", () => {
	assert.equal(
		releaseHoldReason(
			{ ...pull, mergeQueueEntry: { id: "queue-entry" }, state: "CLOSED" },
			{ ...currentRun, conclusion: "success", status: "completed" },
		),
		undefined,
	);
});

it("does not hold for CI on a previous head or for a missing run or PR", () => {
	assert.equal(releaseHoldReason(pull, { ...currentRun, conclusion: "success", "head_sha": "previous-head", status: "completed" }), undefined);
	assert.equal(releaseHoldReason(pull), undefined);
	assert.equal(releaseHoldReason(undefined), undefined);
});
