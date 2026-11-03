import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { application } from "#test/application.ts";
import { enclosingRepository, installedPackageManager, realSetup } from "#test/traits.ts";

const GATE_TIMEOUT = 120_000;

application.it(
	"inside an enclosing repository, create-app still installs my-app but installs no hook into that repository",
	[realSetup, installedPackageManager, enclosingRepository],
	function* ({ answer, createApp, enclosingHook, exists }) {
		yield* createApp("my-app");

		yield* outcomes([
			["answer", () => answer(), "created"],
			["enclosing pre-commit hook", () => enclosingHook(), "no hook"],
			["node_modules", () => exists("node_modules"), true],
		]);
	},
	GATE_TIMEOUT,
);
