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
	moduleWithoutWire: "Property 'wire' is missing",
	readPolicyError: "ServiceUnavailable, never>",
	readPolicyServices: "Database",
	readsPayload: "Property 'slug' does not exist on type '{ readonly id: number; }'",
	rejectionTag: "must have that _tag",
	runCollectionsPolicy: "Property 'readPolicy' is missing",
	undeclaredRejection: "Type 'Other' is not assignable to type 'Denied | MissingReadPolicy | NoteMissing | QueryReadDenied | WebSocketRequired'",
	unknownReject: "Property 'Other' does not exist",
	wrongPayload: "Type 'string' is not assignable to type 'number'",
	zeroRejections: "Property 'members' does not exist on type 'Never'",
} as const;

const runFixtures = {
	runReturnsAny: 'RunReturnsAny<"parsesDraft", "decode the value with a schema, or give run\'s return a type">',
} as const;

const moduleFixtures = {
	moduleMissingFromWire: ["missingFromWire", 'OperationMissingFromWire<"count", "the generated file is stale; run pnpm generate">'],
	modulePolicyService: ["owned", 'OperationNeedsUndeclaredServices<"owned", NotesRepository>'],
	moduleRejectionMissingFromWire: ["removes", 'OperationMissingFromWire<"remove", "the generated file is stale; run pnpm generate">'],
	moduleRepeatedName: ["lists", 'OperationNameRepeated<"list">'],
	moduleStaleAutomaticRejection: [
		"listsAutomatic",
		'WireRejectionsStale<"listsAutomatic", "the generated file is stale; run pnpm generate", never, "ServiceUnavailable">',
	],
	moduleStaleDroppedOptional: [
		"neverPins",
		'WireSuccessStale<"neverPins", "the generated file is stale; run pnpm generate", { id: number; title: string; }, { readonly id: number; readonly pinned?: boolean | undefined; readonly title: string; }>',
	],
	moduleStaleInfrastructureRejection: [
		"listsInfrastructure",
		'WireRejectionsStale<"listsInfrastructure", "the generated file is stale; run pnpm generate", never, "QueryReadDenied">',
	],
	moduleStaleLeakedRow: [
		"leaksRow",
		'WireSuccessStale<"leaksRow", "the generated file is stale; run pnpm generate", StoredNote, { readonly id: number; readonly title: string; }>',
	],
	moduleStaleMutableArray: ["titles", 'WireSuccessStale<"titles", "the generated file is stale; run pnpm generate", string[], readonly string[]>'],
	moduleStaleNestedClassArray: [
		"listsPlainNotes",
		'WireSuccessStale<"listsPlainNotes", "the generated file is stale; run pnpm generate", readonly { id: number; title: string; }[], readonly Note[]>',
	],
	moduleStaleNestedClassField: [
		"createsPlainNote",
		'WireSuccessStale<"createsPlainNote", "the generated file is stale; run pnpm generate", { note: { id: number; title: string; }; saved: boolean; }, { readonly note: Note; readonly saved: boolean; }>',
	],
	moduleStaleNeverRaised: [
		"listsTooMuch",
		'WireRejectionsStale<"listsTooMuch", "the generated file is stale; run pnpm generate", never, "NoteMissing">',
	],
	moduleStaleOptional: [
		"staleOptional",
		'WireSuccessStale<"latest", "the generated file is stale; run pnpm generate", PinnableNote, { readonly id: number; readonly title: string; }>',
	],
	moduleStaleOptionalFieldClass: [
		"featuresPlainNote",
		'WireSuccessStale<"featuresPlainNote", "the generated file is stale; run pnpm generate", { readonly note?: { id: number; title: string; } | undefined; }, { readonly note?: Note | undefined; }>',
	],
	moduleStaleOptionalInArray: [
		"listsPinnable",
		'WireSuccessStale<"listsPinnable", "the generated file is stale; run pnpm generate", readonly PinnableNote[], readonly { readonly id: number; readonly title: string; }[]>',
	],
	moduleStaleOptionalInMutableField: [
		"holdsPinnable",
		'WireSuccessStale<"holdsPinnable", "the generated file is stale; run pnpm generate", { note: PinnableNote; }, { note: { readonly id: number; readonly title: string; }; }>',
	],
	moduleStaleOptionalInOption: [
		"latestPinnable",
		'WireSuccessStale<"latestPinnable", "the generated file is stale; run pnpm generate", Option<PinnableNote>, Option<{ readonly id: number; readonly title: string; }>>',
	],
	moduleStaleOptionalInOptionalField: [
		"featuresPinnable",
		'WireSuccessStale<"featuresPinnable", "the generated file is stale; run pnpm generate", { readonly note?: PinnableNote | undefined; }, { readonly note?: { readonly id: number; readonly title: string; } | undefined; }>',
	],
	moduleStaleOptionalInUnion: [
		"findsPinnable",
		'WireSuccessStale<"findsPinnable", "the generated file is stale; run pnpm generate", PinnableNote | null, { readonly id: number; readonly title: string; } | null>',
	],
	moduleStaleOptionalInUnionDiscriminant: [
		"changesWithExtra",
		'WireSuccessStale<"changesWithExtra", "the generated file is stale; run pnpm generate", { readonly extra?: number | undefined; readonly kind: "moved" | "renamed"; readonly note?: string | undefined; }, { readonly kind: "moved"; readonly note?: string | undefined; } | { readonly kind: "renamed"; readonly note?: string | undefined; }>',
	],
	moduleStalePolicyRejection: [
		"forgetsPolicyFailure",
		'WireRejectionsStale<"forgetsPolicyFailure", "the generated file is stale; run pnpm generate", "NotFound", never>',
	],
	moduleStaleRejection: [
		"staleRejection",
		'WireRejectionsStale<"create", "the generated file is stale; run pnpm generate", "TitleTaken" | "Unauthorized", "Unauthorized">',
	],
	moduleStaleRejectionClass: [
		"raisesOtherTitleTaken",
		'WireRejectionsStale<"raisesOtherTitleTaken", "the generated file is stale; run pnpm generate", "TitleTaken", "TitleTaken">',
	],
	moduleStaleSuccess: [
		"staleSuccess",
		'WireSuccessStale<"list", "the generated file is stale; run pnpm generate", readonly Note[], readonly { readonly id: number; readonly title: string; }[]>',
	],
	moduleStaleSuccessClass: [
		"returnsPlainNote",
		'WireSuccessStale<"returnsPlainNote", "the generated file is stale; run pnpm generate", { id: number; title: string; }, Note>',
	],
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
		const diagnostics = yield* compileInvalid("staleNotes");

		expect(diagnostics.split("\n")[0]).toContain(
			`is not assignable to type 'ClientDiffersFromModule<"create", "the generated file is stale; run pnpm generate">'`,
		);
	},
	COMPILER_TIMEOUT,
);
