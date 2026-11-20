import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { compilerStory } from "#test/compilerStory.ts";

const COMPILER_TIMEOUT = 120_000;

compilerStory.it(
	"appModules refuses a defined module whose run or read policy uses a service that no registration or the host provides, naming the module, the operation and the service",
	[],
	function* ({ compile, diagnostics }) {
		yield* compile();

		yield* outcomes([
			[
				"service a run yields",
				() => diagnostics("unprovidedService"),
				expect.stringContaining(`is not assignable to type 'OperationServicesNotProvided<"imports", "importTitle", NoteSource>'`),
			],
			[
				"service a read policy yields",
				() => diagnostics("unprovidedPolicyService"),
				expect.stringContaining(`is not assignable to type 'OperationServicesNotProvided<"owned", "title", Owners>'`),
			],
		]);
	},
	COMPILER_TIMEOUT,
);
