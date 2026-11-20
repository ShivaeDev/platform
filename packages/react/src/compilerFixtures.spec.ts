import { expect } from "vitest";
import { compilerStory } from "#test/compilerStory.ts";

const COMPILER_TIMEOUT = 120_000;

const invalidFixtures = {
	queryViewUnhandled: "Property 'failure' is missing in type '{ content: (title: string) => string; query: QueryState<string, SubtitleRejected>; }'",
	useActionEmptyFailures:
		"Property 'SubtitleRejected' is missing in type '{}' but required in type '{ readonly SubtitleRejected: FailureChoice<SubtitleRejected,",
	useActionForeignFailure:
		"Object literal may only specify known properties, but 'TitleRejected' does not exist in type 'HandleAppRejections<\"SubtitleRejected\",",
	useActionUnhandled: `Property '"failures.SubtitleRejected"' is missing`,
	useCreateMissingFixed:
		"Type '{ title: string; }' is missing the following properties from type '{ readonly id: number; readonly title: string; readonly version: number; }': id, version",
	useCreateUnhandled:
		"Property 'failures' is missing in type '{ initialValues: { id: number; title: string; }; }' but required in type '{ readonly failures: HandleAppRejections<\"SubtitleRejected\",",
	useEditorUnhandled: 'but required in type \'{ readonly failures: HandleAppRejections<"SubtitleRejected",',
	useExtraFixed: `Type '"ada"' is not assignable to type '"is not a field of the command's payload"'`,
	useFixedValueType: "Type 'string' is not assignable to type 'number'.",
	useIncompleteFixed: "Property 'expectedVersion' is missing in type '{ id: number; }'",
	useMissingFixed: "but required in type '{ readonly fixed: NoFixed & {} & { readonly expectedVersion: number; }; }'",
	useMissingInitialValue: "Property 'title' is missing in type '{}' but required in type '{ readonly title: string; }'",
	useQueryAction: `is not assignable to type '"a bound query only reads: read it with useQuery, and pass a command here"'`,
	useUnknownInitialValue: "Object literal may only specify known properties, but 'titel' does not exist in type '{ readonly title: string; }'",
} as const;

compilerStory.it(
	"hooks that take bound commands, a custom operation, fixed payload fields, an undoable change and handlers for an app-defined rejection compile cleanly",
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
