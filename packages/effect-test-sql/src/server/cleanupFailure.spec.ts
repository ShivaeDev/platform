import { Exit } from "effect";
import { expect } from "vitest";
import { cleanup, limitedCleanupRole } from "#test/cleanup.ts";

cleanup.it(
	"a permanent drop failure surfaces as a SQL defect when the run closes",
	[limitedCleanupRole],
	function* ({ openClone, denyDrop, closeClone, closeRunExit }) {
		yield* openClone();
		yield* denyDrop();
		yield* closeClone();
		const exit = yield* closeRunExit();
		expect(Exit.isFailure(exit) && exit.cause.reasons).toMatchObject([
			{ _tag: "Die", defect: { _tag: "SqlError", reason: { cause: { code: "42501" } } } },
		]);
	},
);
