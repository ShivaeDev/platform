import { Effect, Schema } from "effect";
import ignore from "ignore";
import ts from "typescript";
import { CONFIG_FILE } from "../../config/file.ts";
import { defineRule, type Finding, type SourceFile } from "../../rule.ts";
import { type Assertion, assertionsIn, bridgeOf, lineOf } from "./assertions.ts";

const Declaration = Schema.Struct({
	includes: Schema.NonEmptyArray(Schema.NonEmptyString),
	reason: Schema.String.check(Schema.isPattern(/\S/, { expected: "a reason that says why these files cannot prove the types they assert" })),
});

type Declaration = typeof Declaration.Type;

const NoTypeAssertionOptions = Schema.Struct({
	declared: Schema.Array(Declaration).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
});

const doubleCastParts = (assertions: ReadonlyArray<Assertion>): ReadonlySet<Assertion> =>
	new Set(
		assertions.flatMap((node) => {
			const bridge = bridgeOf(node);
			return bridge === undefined ? [] : [node, bridge.inner];
		}),
	);

const castsIn = (file: SourceFile): ReadonlyArray<Finding> => {
	const parsed = assertionsIn(file);
	if (parsed === undefined) {
		return [];
	}
	const doubleCasts = doubleCastParts(parsed.assertions);
	return parsed.assertions
		.filter((node) => !ts.isConstTypeReference(node.type) && !doubleCasts.has(node))
		.map((node) => ({
			file: file.path,
			line: lineOf(parsed.source, node),
			message: `Asserts the type "${node.type.getText(parsed.source)}" instead of proving it.`,
		}));
};

const allows = (declaration: Declaration, finding: Finding): boolean =>
	ignore()
		.add([...declaration.includes])
		.ignores(finding.file);

const unused = (declaration: Declaration): Finding => ({
	file: CONFIG_FILE,
	message: `Declares type assertions for ${declaration.includes.map((glob) => `"${glob}"`).join(", ")}, which match none. Remove the declaration.`,
});

export const noTypeAssertion = defineRule({
	id: "suppressions/no-type-assertion",
	description:
		"A type assertion makes the compiler trust a type the code never proved. Decode the value at its boundary with Schema, narrow it, or check it with satisfies; as const is not an assertion. Where a scope truly cannot prove its types, declare its includes and reason under this rule's declared option.",
	options: Schema.toStandardSchemaV1(NoTypeAssertionOptions, { parseOptions: { errors: "all", onExcessProperty: "error" } }),
	registrable: false,
	check: ({ options, sources }) => {
		const casts = sources.flatMap(castsIn);
		return [
			...casts.filter((cast) => !options.declared.some((declaration) => allows(declaration, cast))),
			...options.declared.filter((declaration) => !casts.some((cast) => allows(declaration, cast))).map(unused),
		];
	},
});
