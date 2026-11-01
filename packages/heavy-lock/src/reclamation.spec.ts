import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { heldBy, lockStory } from "#test/kit.ts";

lockStory.it(
	"two reclaimers of crashed's old lock leave build's live hold in place and both contenders blocked by build",
	[heldBy("crashed", "exited")],
	function* ({ lock, reclamation }) {
		yield* lock.tries("build");
		expect(yield* lock.holder()).toBe("build");
		yield* reclamation.starts("crashed");

		yield* lock.reclaims("crashed");
		yield* lock.tries("second");
		yield* reclamation.continues();
		yield* lock.tries("first");

		yield* outcomes([
			["lock holder", () => lock.holder(), "build"],
			["first's answer", () => lock.answerOf("first"), "blocked by build"],
			["second's answer", () => lock.answerOf("second"), "blocked by build"],
			["files beside the lock", () => lock.filesBesideLock(), ["heavy-process.lock"]],
		]);
	},
);

lockStory.it("reclaiming a holder still alive leaves its lock and no temporary files", [heldBy("build")], function* ({ lock }) {
	yield* lock.reclaims("build");

	yield* outcomes([
		["lock holder", () => lock.holder(), "build"],
		["files beside the lock", () => lock.filesBesideLock(), ["heavy-process.lock"]],
	]);
});

lockStory.it(
	"a second reclaimer leaves crashed's lock and the first reclaimer's gate alone until the first finishes removing the lock",
	[heldBy("crashed", "exited")],
	function* ({ lock, reclamation }) {
		yield* reclamation.starts("crashed", "removing");

		yield* lock.reclaims("crashed");

		yield* outcomes([
			["lock holder", () => lock.holder(), "crashed"],
			["files beside the lock", () => lock.filesBesideLock(), ["heavy-process.lock", "heavy-process.lock.reclaim"]],
		]);

		yield* reclamation.continues();

		expect(yield* lock.filesBesideLock()).toEqual([]);
	},
);
