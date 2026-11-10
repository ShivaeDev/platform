import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
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
	missingReadPolicy: "readPolicy",
	readPolicyError: "ServiceUnavailable, never>",
	readPolicyServices: "Database",
	readsPayload: "Property 'slug' does not exist on type '{ readonly id: number; }'",
	rejectionTag: "must have that _tag",
	runCollectionsPolicy: "Property 'readPolicy' is missing",
	runInvalidatesResult: "Property 'id' does not exist on type 'ResultNeedsDeclaredSuccess'",
	undeclaredRejection: "Type 'Other' is not assignable to type 'NoteMissing | QueryReadDenied'",
	unknownReject: "Property 'Other' does not exist",
	wrongPayload: "Type 'string' is not assignable to type 'number'",
	zeroRejections: "Property 'members' does not exist on type 'Never'",
} as const;

const runFixtures = {
	runAutomaticRejection: 'RejectionAutomatic<"listsAutomatic", "ServiceUnavailable">',
	runInfrastructureRejection: 'RejectionsRunNeverRaises<"listsInfrastructure", "QueryReadDenied">',
	runMissingRejection: 'RunFailsOutsideRejections<"forgetsTitleTaken", "TitleTaken">',
	runMutableArray: 'ArrayMutabilityDiffers<"titles", "return a readonly array, or declare Schema.mutable for a mutable one">',
	runNestedClassArray: 'SuccessClassNotReturned<"listsPlainNotes", { id: number; title: string; }, Note>',
	runNestedClassField: 'SuccessClassNotReturned<"createsPlainNote", { id: number; title: string; }, Note>',
	runNeverRaised: 'RejectionsRunNeverRaises<"listsTooMuch", "NoteMissing">',
	runPolicyRejection: 'RunFailsOutsideRejections<"forgetsPolicyFailure", "NotFound">',
	runRejectionClass: 'RejectionClassDiffers<"raisesOtherTitleTaken", "TitleTaken">',
	runReturnsAny: 'RunReturnsAny<"parsesDraft", "decode the value with a schema, or give run\'s return a type">',
	runSuccessClass: 'SuccessClassNotReturned<"returnsPlainNote", { id: number; title: string; }, Note>',
	runSuccessDiffers: 'SuccessDiffersFromRun<"leaksRow", StoredNote, { readonly id: number; readonly title: string; }>',
} as const;

const moduleFixtures = {
	moduleMissingFromWire: ["missingFromWire", 'OperationMissingFromWire<"count", "the generated file is stale; run pnpm generate">'],
	modulePolicyService: ["owned", 'OperationNeedsUndeclaredServices<"owned", NotesRepository>'],
	moduleRepeatedName: ["lists", 'OperationNameRepeated<"list">'],
	moduleStaleRejection: [
		"staleRejection",
		'WireRejectionsStale<"create", "the generated file is stale; run pnpm generate", "TitleTaken" | "Unauthorized", "Unauthorized">',
	],
	moduleStaleSuccess: [
		"staleSuccess",
		'WireSuccessStale<"list", "the generated file is stale; run pnpm generate", readonly Note[], readonly { readonly id: number; readonly title: string; }[]>',
	],
	moduleUndeclaredRejection: ["creates", 'OperationFailsOutsideItsRejections<"create", "TitleTaken">'],
	moduleUndeclaredService: ["imports", 'OperationNeedsUndeclaredServices<"importTitle", NoteSource>'],
} as const;

compilerStory.it(
	"valid contracts including declared subjects, bindings and handlers emit declarations with the notes.rename RPC",
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

compilerStory.it(
	"operations written as payload and run compile with run's types and fit a contract",
	[],
	function* ({ compileValidRuns }) {
		expect(yield* compileValidRuns()).toBe('compiled cleanly, declaring Contract<"runNotes"');
	},
	COMPILER_TIMEOUT,
);

for (const [fixture, problem] of Object.entries(runFixtures)) {
	compilerStory.it(
		`tsc rejects the invalid ${fixture} fixture with no matching overload and the problem ${problem}`,
		[],
		function* ({ compileInvalid }) {
			const diagnostics = yield* compileInvalid(fixture);

			yield* outcomes([
				["first line", () => Effect.succeed(diagnostics.split("\n")[0]), expect.stringContaining("No overload matches this call.")],
				["named problem", () => Effect.succeed(diagnostics), expect.stringContaining(`operationProblem: ${problem}`)],
			]);
		},
		COMPILER_TIMEOUT,
	);
}

compilerStory.it(
	"a module defined from operations written as payload and run compiles, and its handlers require exactly its requires",
	[],
	function* ({ compileValidModule }) {
		expect(yield* compileValidModule()).toBe('compiled cleanly, declaring Module<"sessionNotes"');
	},
	COMPILER_TIMEOUT,
);

for (const [fixture, [module, problem]] of Object.entries(moduleFixtures)) {
	compilerStory.it(
		`tsc rejects the ${fixture} fixture on the module's name with the problem ${problem} on the first line`,
		[],
		function* ({ compileInvalid }) {
			const diagnostics = yield* compileInvalid(fixture);

			expect(diagnostics.split("\n")[0]).toContain(`Type '"${module}"' is not assignable to type '"${module}" & NoInfer<${problem}>'`);
		},
		COMPILER_TIMEOUT,
	);
}

compilerStory.it(
	"tsc rejects a generated client that differs from its server module on the client's assertion, naming the operation and pnpm generate",
	[],
	function* ({ compileInvalid }) {
		const diagnostics = yield* compileInvalid("clientDiffersFromModule");

		expect(diagnostics.split("\n")[0]).toContain(
			`is not assignable to type 'ClientDiffersFromModule<"create", "the generated file is stale; run pnpm generate">'`,
		);
	},
	COMPILER_TIMEOUT,
);
