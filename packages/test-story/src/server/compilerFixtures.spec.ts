import { expect } from "vitest";
import { outcomes } from "#outcomes.ts";
import { compilerStory } from "#test/compilerStory.ts";

const COMPILER_TIMEOUT = 60_000;

compilerStory.it(
	"unmet generator, Effect and partial-layer creation requirements name PgBoss instead of rejecting after",
	[],
	function* ({ compile, diagnostics, output, status }) {
		yield* compile();

		yield* outcomes({
			"compilation fails": [status(), 1],
			"effect creation": [diagnostics("effectCreate"), expect.stringContaining("Layer<PgBoss")],
			"generator creation with after": [diagnostics("missingLayer"), expect.stringContaining("Layer<PgBoss")],
			"no unrelated after error": [output(), expect.not.stringContaining("'after' does not exist")],
			"partial layer": [diagnostics("partialLayer"), expect.stringContaining("Type 'PgBoss' is not assignable to type 'Ledger'")],
		});
	},
	COMPILER_TIMEOUT,
);

compilerStory.it(
	"composed kits name duplicate verbs in compiler errors",
	[],
	function* ({ compile, diagnostics }) {
		yield* compile();

		expect(yield* diagnostics("duplicateVerbs")).toContain('"Cannot compose story kits: duplicate verb names": "read"');
	},
	COMPILER_TIMEOUT,
);
