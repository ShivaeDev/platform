import { Effect, Schema } from "effect";
import type ts from "typescript";
import { typeScriptProgram } from "#adapters/typeScriptProgram.ts";
import { defineConfig, type QualityConfig } from "#config.ts";
import type { FilesystemFailure } from "#inventory/filesystem.ts";
import { defineRule, type Findings, type RegisteredRule, type Rule, type RuleContext, type RuleInputs, type TypeScriptProgram } from "#rule.ts";
import { customServiceRule, type LineAllowance } from "#test/customServiceRule.ts";

const numeric = defineRule({
	check: ({ options }) => [{ file: "limit", message: options.max.toFixed(0) }],
	description: "Reports a numeric limit.",
	id: "local/numeric",
	options: Schema.toStandardSchemaV1(Schema.Struct({ max: Schema.Number })),
	validate: ({ options }) => (options.max > 0 ? [] : ["max must be positive"]),
});

const textual = defineRule({
	check: ({ options }) => Effect.succeed([{ file: "label", message: options.label.toUpperCase() }]),
	description: "Reports a label.",
	id: "local/textual",
	options: Schema.toStandardSchemaV1(Schema.Struct({ label: Schema.String })),
});

const none = defineRule({
	check: ({ options }) => {
		const absent: undefined = options;
		return [{ file: "none", message: String(absent) }];
	},
	description: "Takes no options.",
	id: "local/none",
});

export const registry = [numeric, textual, none, customServiceRule] as const satisfies readonly RegisteredRule<unknown>[];

export const erased: readonly RegisteredRule<unknown>[] = registry;

export const annotated: QualityConfig = { rules: { "structure/max-lines": { options: { source: 100 } } } };

export const annotatedWrong: QualityConfig = {
	// @ts-expect-error Erasing local rules preserves the built-in option types.
	rules: { "structure/max-lines": { options: { source: "100" } } },
};

export const mixed = defineConfig({
	local: registry,
	rules: {
		"local/line-limit": { options: { max: "2" } },
		"local/none": "error",
		"local/numeric": { options: { max: 2 } },
		"local/textual": { options: { label: "hello" } },
	},
});

export const mixedWrong = defineConfig({
	local: registry,
	// @ts-expect-error A heterogeneous registry preserves each rule's options.
	rules: { "local/numeric": { options: { label: "hello" } } },
});

export const configured = numeric.configure({ max: 2 });
// @ts-expect-error Direct configuration rejects the wrong input type.
export const wrongNumericOptions = numeric.configure({ max: "2" });
// @ts-expect-error No-options rules reject supplied options.
export const unexpectedOptions = none.configure({ max: 2 });
// @ts-expect-error A typed callback cannot promise to accept arbitrary registry input.
export const widened: Rule<string, unknown> = numeric;
// @ts-expect-error Callback input variance stays strict between different options.
export const incompatible: Rule<string, { readonly max: number | string }> = numeric;

export const decoded = defineRule({
	check: ({ options }) => [{ file: "decoded", message: options.max.toFixed(0) }],
	description: "Uses decoded options.",
	id: "local/decoded",
	options: Schema.toStandardSchemaV1(Schema.Struct({ max: Schema.NumberFromString })),
	validate: ({ options }) => {
		// @ts-expect-error Validation receives decoded numbers, not schema input strings.
		options.max.toUpperCase();
		return [];
	},
});

export const configuredDecoded = decoded.configure({ max: "2" });
// @ts-expect-error Direct configuration takes schema input, not decoded output.
export const wrongDecodedOptions = decoded.configure({ max: 2 });

export const narrowedCheck = defineRule({
	// @ts-expect-error The overload without options also refuses a narrowed callback.
	check: ({ options }: RuleContext<{ readonly max: 1 }>) => [{ file: "limit", message: String(options.max) }],
	description: "Rejects an unsafely narrow callback.",
	id: "local/narrowed",
	// @ts-expect-error A check must handle every value its schema decodes.
	options: Schema.toStandardSchemaV1(Schema.Struct({ max: Schema.Number })),
});

export const invalidSync = defineRule({
	// @ts-expect-error A finding needs a file and message.
	check: () => [{ message: "missing file" }],
	description: "Rejects incomplete findings.",
	id: "local/invalid-sync",
});

export const promiseCheck = defineRule({
	// @ts-expect-error A check returns findings or an Effect of findings, never a Promise.
	check: () => Promise.resolve([{ file: "promised", message: "promised" }]),
	description: "Rejects a Promise check.",
	id: "local/promise-check",
});

export const reading = defineRule({
	check: ({ readText }) =>
		Effect.gen(function* () {
			const text = yield* readText("notes.md");
			const read: string | undefined = text;
			return read === undefined ? [{ file: "notes.md", message: "missing" }] : [];
		}),
	description: "Reads a file through the Effect API.",
	id: "local/reading",
});

export function readTextType(inputs: RuleInputs) {
	const text: Effect.Effect<string | undefined, FilesystemFailure> = inputs.readText("notes.md");
	// @ts-expect-error readText is an Effect, so a Promise caller cannot await its text.
	const promised: Promise<string | undefined> = inputs.readText("notes.md");
	return [text, promised];
}

export const promiseReader: RuleInputs = {
	files: [],
	// @ts-expect-error A supplied readText returns an Effect, not a Promise.
	readText: () => Promise.resolve(undefined),
	root: ".",
	sources: [],
	typeScript: typeScriptProgram(".", []),
};

export const typed = defineRule({
	check: ({ sources, typeScript }) =>
		Effect.map(typeScript, ({ checker, sourceFile }) =>
			sources.flatMap((file) => {
				const source = sourceFile(file.path);
				const module = source === undefined ? undefined : checker.getSymbolAtLocation(source);
				return (module === undefined ? [] : checker.getExportsOfModule(module)).map((exported) => ({
					file: file.path,
					message: checker.typeToString(checker.getTypeOfSymbol(exported)),
				}));
			}),
		),
	description: "Reads exported types through the shared program.",
	id: "local/typed",
});

export function typeScriptType(inputs: RuleInputs) {
	const shared: Effect.Effect<TypeScriptProgram> = inputs.typeScript;
	const compiled = Effect.map(inputs.typeScript, (typeScript): ts.Program => typeScript.program);
	const source = Effect.map(inputs.typeScript, ({ sourceFile }): ts.SourceFile | undefined => sourceFile("src/a.ts"));
	// @ts-expect-error The program is an Effect, so a rule yields it before reading the checker.
	const checker: ts.TypeChecker = inputs.typeScript.checker;
	return [shared, compiled, source, checker];
}

// @ts-expect-error Every rule receives the program, so rule inputs require it.
export const withoutProgram: RuleInputs = { files: [], readText: () => Effect.succeed(undefined), root: ".", sources: [] };

export const promiseProgram: RuleInputs = {
	files: [],
	readText: () => Effect.succeed(undefined),
	root: ".",
	sources: [],
	// @ts-expect-error A supplied program is an Effect, not a Promise.
	typeScript: Promise.resolve(undefined),
};

export const invalidEffect = defineRule({
	// @ts-expect-error Effect results must also contain valid findings.
	check: () => Effect.succeed([{ file: "bad", line: "2", message: "bad line" }]),
	description: "Rejects invalid Effect findings.",
	id: "local/invalid-effect",
});

type Ready = Extract<Awaited<ReturnType<typeof customServiceRule.configure>>, { readonly _tag: "Ready" }>;
export function serviceCheck(ready: Ready) {
	const check: Effect.Effect<Findings, unknown, LineAllowance> = ready.check({
		files: [],
		readText: () => Effect.succeed(undefined),
		root: ".",
		sources: [],
	});
	// @ts-expect-error Configuring a rule preserves the services its check needs.
	const withoutService: Effect.Effect<Findings, unknown, never> = check;
	return withoutService;
}
