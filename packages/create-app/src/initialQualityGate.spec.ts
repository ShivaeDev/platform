import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { application } from "#test/application.ts";
import { enclosingRepository, failingQualityGate, generated, installedPackageManager, realSetup } from "#test/traits.ts";

const GATE_TIMEOUT = 60_000;
const STAGED_FOR_THE_GATE = expect.arrayContaining(["package.json", "pnpm-lock.yaml", "src/server/server.ts"]);

for (const flags of [[], ["--minimal"]] as const) {
	const app = ["my-app", ...flags].join(" ");
	application.it(
		`create-app ${app} installs Quality's hook before anything is staged, and the initial commit passes through it with the generated files staged`,
		[realSetup, installedPackageManager],
		function* ({ commits, createApp, preCommitHook, qualityGateSaw, setupSaw }) {
			yield* createApp("my-app", ...flags);

			yield* outcomes({
				commits: [commits(), ["Create App <create-app@localhost>: Initialize a generated app"]],
				"pre-commit hook": [preCommitHook(), "Quality's hook"],
				"setup saw": [setupSaw(), { commit: "no commit", staged: [] }],
				"the gate saw staged": [qualityGateSaw(), STAGED_FOR_THE_GATE],
			});
		},
		GATE_TIMEOUT,
	);
}

application.it(
	"pnpm run setup, the retry create-app suggests, succeeds again on an installed app and keeps Quality's hook",
	[realSetup, installedPackageManager, generated("my-app")],
	function* ({ pnpm, preCommitHook, scriptResult }) {
		expect(yield* preCommitHook()).toBe("Quality's hook");

		yield* pnpm("run", "setup");

		yield* outcomes({
			"pnpm run setup": [scriptResult(), "passed"],
			"pre-commit hook": [preCommitHook(), "Quality's hook"],
		});
	},
	GATE_TIMEOUT,
);

application.it(
	"a failing Quality gate stops the initial commit, and create-app names the failed commit and where the files remain",
	[failingQualityGate, installedPackageManager],
	function* ({ answer, commits, createApp, qualityGateSaw }) {
		yield* createApp("my-app");

		yield* outcomes({
			answer: [answer(), "create-app: git commit -m 'Initialize a generated app' failed (exit 1). The generated files remain in <workspace>/my-app."],
			commits: [commits(), []],
			"the gate saw staged": [qualityGateSaw(), STAGED_FOR_THE_GATE],
		});
	},
	GATE_TIMEOUT,
);

application.it(
	"inside an enclosing repository, create-app still installs my-app but installs no hook into that repository",
	[realSetup, installedPackageManager, enclosingRepository],
	function* ({ answer, createApp, enclosingHook, exists }) {
		yield* createApp("my-app");

		yield* outcomes({
			answer: [answer(), "created"],
			"enclosing pre-commit hook": [enclosingHook(), "no hook"],
			"node_modules": [exists("node_modules"), true],
		});
	},
	GATE_TIMEOUT,
);
