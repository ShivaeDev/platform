import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { importFences } from "#rules/imports/fences.ts";
import { BROWSER_BOUNDARY, boundaryWorkspace, browserFence } from "#test/boundaryWorkspace.ts";
import { CLI_TIMEOUT } from "#test/cli.ts";
import { importStory, repositoryHolds } from "#test/importStory.ts";
import { repositoryHas, repositoryStory } from "#test/repositoryStory.ts";
import { config } from "#test/tree.ts";

const UNREADABLE = [
	["export const fences = [];", "export an array of fence() declarations as the default export"],
	["export default {};", "export an array of fence() declarations:\nExpected array"],
	["export default [null];", "export an array of fence() declarations:\n0: Expected object"],
	['export default [{ _tag: "Fence" }];', "export an array of fence() declarations:\n0"],
	["throw new Error('broken policy');", "broken policy"],
];

repositoryStory.it(
	"quality lint discovers a workspace package's boundary outside the selected sources, ignores one outside the workspace and reports each path that reaches across it",
	[repositoryHas(...boundaryWorkspace().files, config('{ sources: ["packages/ui/src"] }'))],
	function* ({ outcome, runs, stdout }) {
		yield* runs("lint");

		yield* outcomes({
			"bridge.ts": [stdout(), expect.stringContaining("packages/ui/src/bridge.ts:1  Reaches node:fs through packages/ui/src/bridge.ts -> node:fs")],
			"exit": [outcome(), "rejected"],
			"fence findings": [stdout(), expect.stringContaining("error imports/fences (2)")],
			"main.ts": [
				stdout(),
				expect.stringContaining(
					'packages/ui/src/main.ts:1  Reaches node:fs through packages/ui/src/main.ts -> packages/ui/src/bridge.ts -> node:fs across the fence "browser-stays-off-disk": The browser code runs without Node.',
				),
			],
		});
	},
	CLI_TIMEOUT,
);

for (const [boundary, problem] of UNREADABLE) {
	importStory.it(
		`imports/fences refuses an unreadable boundary, naming its file and the problem: ${boundary}`,
		[repositoryHolds(boundaryWorkspace(boundary))],
		function* ({ refusal }) {
			expect(yield* refusal(importFences)).toContain(`cannot load boundary at packages/ui/quality.fences.config.ts: ${problem}`);
		},
		CLI_TIMEOUT,
	);
}

importStory.it(
	"imports/fences validates discovered and configured fences as one policy, refusing a configured fence with a discovered fence's name",
	[repositoryHolds(boundaryWorkspace())],
	function* ({ refusal }) {
		expect(yield* refusal(importFences, { fences: [browserFence] })).toContain('fence "browser-stays-off-disk": an earlier fence has this name');
	},
	CLI_TIMEOUT,
);

importStory.it(
	"imports/fences discovers a boundary beside the root manifest",
	[repositoryHolds(boundaryWorkspace(BROWSER_BOUNDARY, "."))],
	function* ({ check, files }) {
		yield* check(importFences);

		expect(yield* files()).toEqual(["packages/ui/src/bridge.ts", "packages/ui/src/main.ts"]);
	},
	CLI_TIMEOUT,
);

importStory.it(
	"imports/fences reads a changed boundary again during a later scan",
	[repositoryHolds(boundaryWorkspace())],
	function* ({ check, files, writes }) {
		yield* check(importFences);
		expect(yield* files()).toEqual(["packages/ui/src/bridge.ts", "packages/ui/src/main.ts"]);

		yield* writes({ content: "export default [];", path: "packages/ui/quality.fences.config.ts" });

		expect(yield* check(importFences)).toEqual([]);
	},
	CLI_TIMEOUT,
);
