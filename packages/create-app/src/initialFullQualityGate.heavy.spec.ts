import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { application } from "#test/application.ts";
import { installedPackageManager, realSetup } from "#test/traits.ts";

const GATE_TIMEOUT = 120_000;
const STAGED_FOR_THE_GATE = expect.arrayContaining(["package.json", "pnpm-lock.yaml", "src/server/server.ts"]);

application.it(
	"create-app my-app installs Quality's hook before anything is staged, and commits the generated files with retained template findings recorded",
	[realSetup, installedPackageManager],
	function* ({ baselineEntries, commits, createApp, preCommitHook, qualityGateSaw, setupSaw }) {
		yield* createApp("my-app");

		yield* outcomes([
			["commits", () => commits(), ["Create App <create-app@localhost>: Initialize a generated app"]],
			[
				"Quality baseline",
				() => baselineEntries(),
				expect.arrayContaining([{ count: 1, path: "src/server/applicationHost.ts", rule: "effect/context-capture" }]),
			],
			["pre-commit hook", () => preCommitHook(), "Quality's hook"],
			["setup saw", () => setupSaw(), { commit: "no commit", staged: [] }],
			["the gate saw staged", () => qualityGateSaw(), STAGED_FOR_THE_GATE],
		]);
	},
	GATE_TIMEOUT,
);
