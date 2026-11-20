import { expect } from "vitest";
import { compilerStory } from "#test/compilerStory.ts";

const COMPILER_TIMEOUT = 120_000;

const invalidFixtures = {
	useCreateMissingFixed:
		"Type '{ title: string; }' is missing the following properties from type '{ readonly id: number; readonly title: string; readonly version: number; }': id, version",
	useExtraFixed: `Type '"ada"' is not assignable to type '"is not a field of the command's payload"'`,
	useFixedValueType: "Type 'string' is not assignable to type 'number'.",
	useIncompleteFixed: "Property 'expectedVersion' is missing in type '{ id: number; }'",
	useMissingFixed: "but required in type '{ readonly fixed: NoFixed & {} & { readonly expectedVersion: number; }; }'",
	useMissingInitialValue: "Property 'title' is missing in type '{}' but required in type '{ readonly title: string; }'",
	useQueryAction: `is not assignable to type '"a bound query only reads: read it with useQuery, and pass a command here"'`,
	useUnknownInitialValue: "Object literal may only specify known properties, but 'titel' does not exist in type '{ readonly title: string; }'",
} as const;

compilerStory.it(
	"hooks that take bound commands, a custom operation, fixed payload fields and an undoable change compile cleanly",
	[],
	function* ({ compileValid }) {
		expect(yield* compileValid()).toBe("compiled cleanly");
	},
	COMPILER_TIMEOUT,
);

for (const [fixture, problem] of Object.entries(invalidFixtures)) {
	compilerStory.it(
		`tsc rejects the invalid ${fixture} fixture with ${problem}`,
		[],
		function* ({ compileInvalid }) {
			expect(yield* compileInvalid(fixture)).toContain(problem);
		},
		COMPILER_TIMEOUT,
	);
}
