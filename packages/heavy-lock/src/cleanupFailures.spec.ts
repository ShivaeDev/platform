import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { failingCleanup, heldBy, lockStory, partialDraftWrite, running } from "#test/kit.ts";

lockStory.it(
	"a partial draft write fails acquisition and leaves no draft or lock",
	[partialDraftWrite()],
	function* ({ failureCauseOf, lock, starts }) {
		yield* starts("ready");

		yield* outcomes([
			["write failure", () => failureCauseOf("ready"), expect.stringContaining("disk full after a partial draft write")],
			["files beside the lock", () => lock.filesBesideLock(), []],
		]);
	},
);

lockStory.it("interrupting a partial draft write removes the draft and leaves the attempt interrupted", [], function* ({ draft, lock }) {
	yield* draft.startsWriting("ready");

	yield* draft.interrupts();

	yield* outcomes([
		["attempt", () => draft.result(), "interrupted"],
		["files beside the lock", () => lock.filesBesideLock(), []],
	]);
});

lockStory.it(
	"a draft cleanup failure fails acquisition and rolls back the acquired hold",
	[failingCleanup("draft")],
	function* ({ failureCauseOf, lock, starts }) {
		yield* starts("ready");

		yield* outcomes([
			["cleanup failure", () => failureCauseOf("ready"), expect.stringContaining("cannot remove the draft")],
			["lock holder", () => lock.holder(), "nobody"],
		]);
	},
);

lockStory.it(
	"a reclamation gate cleanup failure fails acquisition and removes the contender's draft",
	[heldBy("crashed", "exited"), failingCleanup("gate")],
	function* ({ failureCauseOf, lock, starts }) {
		yield* starts("ready");

		yield* outcomes([
			["cleanup failure", () => failureCauseOf("ready"), expect.stringContaining("cannot remove the gate")],
			["files beside the lock", () => lock.filesBesideLock(), ["heavy-process.lock.reclaim"]],
		]);
	},
);

lockStory.it(
	"a release failure reports a heavy-lock error when ready finishes its work",
	[failingCleanup("lock"), running("ready")],
	function* ({ finishes, stateOf }) {
		yield* finishes("ready");

		expect(yield* stateOf("ready")).toContain("Could not release the heavy-process lock");
	},
);

lockStory.it(
	"a release failure keeps ready's work failure and reports the cleanup error",
	[failingCleanup("lock"), running("ready")],
	function* ({ fails, failureReportOf }) {
		yield* fails("ready", "build failed");

		yield* outcomes([
			["work failure", () => failureReportOf("ready"), expect.stringContaining("build failed")],
			["cleanup failure", () => failureReportOf("ready"), expect.stringContaining("Could not release the heavy-process lock")],
		]);
	},
);

lockStory.it(
	"a release failure is reported when ready is interrupted",
	[failingCleanup("lock"), running("ready")],
	function* ({ interrupts, stateOf }) {
		yield* interrupts("ready");

		expect(yield* stateOf("ready")).toContain("Could not release the heavy-process lock");
	},
);
