import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { application } from "#test/application.ts";
import { installedPackageManager, qualityGateExits } from "#test/traits.ts";

const GATE_TIMEOUT = 120_000;
const STAGED_FOR_THE_GATE = expect.arrayContaining(["package.json", "pnpm-lock.yaml", "src/server/server.ts"]);

application.it(
	"a Quality hook that fails with exit 7 stops the initial commit, and create-app names the failed commit and where the files remain",
	[qualityGateExits(7), installedPackageManager],
	function* ({ answer, commits, createApp, qualityGateSaw }) {
		yield* createApp("my-app");

		yield* outcomes([
			[
				"answer",
				() => answer(),
				"create-app: git commit -m 'Initialize a generated app' failed (exit 1). The generated files remain in <workspace>/my-app.",
			],
			["commits", () => commits(), []],
			["the gate saw staged", () => qualityGateSaw(), STAGED_FOR_THE_GATE],
		]);
	},
	GATE_TIMEOUT,
);
