import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { authStartup, missingImageColumn, unavailableContext } from "#test/better-auth/startup.ts";

authStartup.it(
	"the mount Layer waits for the auth context and its PostgreSQL schema check before becoming ready",
	[],
	function* ({ awaitSchemaCheck, beginBuild, buildOutcome, buildState, finishInitialization, releaseSchemaCheck }) {
		yield* beginBuild();
		expect(yield* buildState()).toBe("waiting");

		yield* finishInitialization();
		yield* awaitSchemaCheck();
		expect(yield* buildState()).toBe("waiting");

		yield* releaseSchemaCheck();
		expect(yield* buildOutcome()).toBe("ready");
	},
);

authStartup.it(
	"a missing PostgreSQL user image column fails the mount Layer as auth unavailable and logs the schema failure",
	[missingImageColumn],
	function* ({ beginBuild, buildOutcome, finishInitialization, recordedProviderFailures, releaseSchemaCheck }) {
		yield* beginBuild();
		yield* finishInitialization();
		yield* releaseSchemaCheck();

		yield* outcomes([
			["mount startup", () => buildOutcome(), "auth unavailable"],
			[
				"recorded provider failure",
				() => recordedProviderFailures(),
				[["Authentication provider failed", expect.objectContaining({ message: expect.stringContaining("image") })]],
			],
		]);
	},
);

authStartup.it(
	"a refused auth context fails the mount Layer as auth unavailable",
	[unavailableContext],
	function* ({ beginBuild, buildOutcome, finishInitialization }) {
		yield* beginBuild();
		yield* finishInitialization();

		expect(yield* buildOutcome()).toBe("auth unavailable");
	},
);
