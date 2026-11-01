import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { acquiredInScope, heldBy, inheritsHolderIdOf, liveCli, lockPathsFrom, lockStory } from "#test/kit.ts";

for (const { locked, sources } of [
	{ locked: "explicit", sources: ["explicit", "HEAVY_PROCESS_LOCK", "HOME"] },
	{ locked: "HEAVY_PROCESS_LOCK", sources: ["HEAVY_PROCESS_LOCK", "HOME"] },
	{ locked: "HOME", sources: ["HOME"] },
] as const) {
	lockStory.it(
		`a child joins build's acquired hold at the ${locked} path and leaves build holding it`,
		[lockPathsFrom(sources), acquiredInScope("build")],
		function* ({ cli, lock }) {
			yield* cli.runsInside("check", "build", cli.commands.reportsHolderId);

			yield* outcomes([
				["check's exit code", () => cli.exitCodeOf("check"), 0],
				["check's lock path", () => cli.lockPathGivenTo("check"), locked],
				["check's holder id", () => cli.holderIdGivenTo("check"), "build's holder id"],
				["lock holder after check exits", () => lock.holder(locked), "build"],
			]);
		},
		liveCli,
	);
}

lockStory.it(
	"a child of a joined hold receives build's explicit lock path and holder id while build keeps the lock",
	[heldBy("build"), inheritsHolderIdOf("build"), lockPathsFrom(["explicit", "HEAVY_PROCESS_LOCK", "HOME"]), acquiredInScope("joined")],
	function* ({ cli, lock }) {
		yield* cli.runsInside("check", "joined", cli.commands.reportsHolderId);

		yield* outcomes([
			["check's lock path", () => cli.lockPathGivenTo("check"), "explicit"],
			["check's holder id", () => cli.holderIdGivenTo("check"), "build's holder id"],
			["lock holder after check exits", () => lock.holder(), "build"],
		]);
	},
	liveCli,
);
