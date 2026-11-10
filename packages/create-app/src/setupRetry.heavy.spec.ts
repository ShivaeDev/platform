import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { application } from "#test/application.ts";
import { generated, installedPackageManager, qualityGateExits } from "#test/traits.ts";

const GATE_TIMEOUT = 120_000;

application.it(
	"pnpm run setup, the retry create-app suggests, succeeds again on an installed app and keeps Quality's hook",
	[qualityGateExits(0), installedPackageManager, generated("my-app")],
	function* ({ pnpm, preCommitHook, scriptResult }) {
		expect(yield* preCommitHook()).toBe("Quality's hook");

		yield* pnpm("run", "setup");

		yield* outcomes([
			["pnpm run setup", () => scriptResult(), "passed"],
			["pre-commit hook", () => preCommitHook(), "Quality's hook"],
		]);
	},
	GATE_TIMEOUT,
);
