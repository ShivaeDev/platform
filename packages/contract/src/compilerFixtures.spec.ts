import { expect } from "vitest";
import { compilerStory } from "#test/compilerStory.ts";

const COMPILER_TIMEOUT = 60_000;

const invalidFixtures = {
	commandQuery: "Property 'query' does not exist",
	duplicateCommand: "Operation names must be unique; duplicated: save",
	duplicateName: "Operation names must be unique; duplicated: same",
	duplicateQuery: "Operation names must be unique; duplicated: get",
	fieldRejection: `Type '"body"' is not assignable to type '"title"'`,
	handlerMismatch: "missing the following properties from type 'Note': body, title",
	incompatibleClient: "is not assignable",
	incompatibleErrors: "is not assignable",
	incompleteClient: "is not assignable",
	inlineReject: "Property 'Anything' does not exist",
	inlineSuccess: "Type 'number' is not assignable to type 'void",
	invalidatesResult: "Property 'missing' does not exist on type 'Note'",
	keyId: "Argument of type 'string' is not assignable to parameter of type 'number'",
	readPolicyError: "ServiceUnavailable, never>",
	readPolicyServices: "Database",
	readsPayload: "Property 'slug' does not exist on type '{ readonly id: number; }'",
	rejectionTag: "must have that _tag",
	undeclaredRejection: "Type 'Other' is not assignable to type 'NoteMissing | QueryReadDenied'",
	unknownReject: "Property 'Other' does not exist",
	wrongPayload: "Type 'string' is not assignable to type 'number'",
	zeroRejections: "Property 'members' does not exist on type 'Never'",
} as const;

compilerStory.it(
	"the valid contract, binding and handlers compile cleanly and declare the notes.rename RPC",
	[],
	function* ({ compileValid }) {
		expect(yield* compileValid()).toBe('compiled cleanly, declaring Rpc<"notes.rename"');
	},
	COMPILER_TIMEOUT,
);

for (const [fixture, diagnostic] of Object.entries(invalidFixtures)) {
	compilerStory.it(
		`tsc rejects the invalid ${fixture} fixture with ${diagnostic}`,
		[],
		function* ({ compileInvalid }) {
			expect(yield* compileInvalid(fixture)).toContain(diagnostic);
		},
		COMPILER_TIMEOUT,
	);
}
