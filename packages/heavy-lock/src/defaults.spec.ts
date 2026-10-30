import { expect } from "vitest";
import { lockPathsFrom, lockStory, noCommandOption, processArguments } from "#test/kit.ts";

for (const { locked, sources } of [
	{ locked: "explicit", sources: ["explicit", "HEAVY_PROCESS_LOCK", "HOME"] },
	{ locked: "HEAVY_PROCESS_LOCK", sources: ["HEAVY_PROCESS_LOCK", "HOME"] },
	{ locked: "HOME", sources: ["HOME"] },
] as const) {
	lockStory.it(
		`with lock paths from ${sources.join(", ")}, ready locks only the ${locked} path`,
		[lockPathsFrom(sources)],
		function* ({ lock, starts }) {
			expect(yield* lock.lockedPaths()).toEqual([]);

			yield* starts("ready");

			expect(yield* lock.lockedPaths()).toEqual([locked]);
		},
	);
}

lockStory.it(
	"with no command given, ready's lock records this process's arguments after the executable",
	[noCommandOption(), processArguments("scripts/build.ts", "--target", "heavy build")],
	function* ({ protocol, starts }) {
		yield* starts("ready");

		expect(yield* protocol.recordedHolder()).toMatchObject({ command: "scripts/build.ts --target heavy build" });
	},
);
