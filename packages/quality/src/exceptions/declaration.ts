import { Schema } from "effect";
import { type Decoded, decodeWith } from "#decoded.ts";
import { ConsumerDeclaration } from "#rules/suppressions/biome/ConsumerDeclaration.ts";

const FILE = /^(?!\.\/)(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[^*!?[\]{}\\]+$/u;

export const ExceptionDeclaration = Schema.Struct({
	files: Schema.NonEmptyArray(Schema.NonEmptyString),
	reason: Schema.String.check(Schema.isPattern(/\S/u, { expected: "a reason that says why the exception is permanent" })),
	rules: Schema.NonEmptyArray(Schema.NonEmptyString),
	subject: Schema.optionalKey(Schema.NonEmptyString),
}).check(
	Schema.makeFilter(
		({ files, reason, rules, subject }) =>
			rules.every((rule) => {
				if (rule.startsWith("biome/")) {
					return (
						subject === undefined
						&& (rule === "biome/files/includes" || files.every((file) => FILE.test(file)))
						&& Schema.is(ConsumerDeclaration)({ includes: files, reason, rule: rule.slice(6) })
					);
				}
				return files.every((file) => FILE.test(file));
			}),
		{
			message:
				"Exceptions name explicit repository files and individual rules. Biome rules use biome/lint/<group>/<rule> or biome/assist/<group>/<action>, without a subject. Only biome/files/includes accepts ** and named directory exclusions.",
		},
	),
);

export type ExceptionDeclaration = typeof ExceptionDeclaration.Type;

const ExceptionDeclarations = Schema.Array(ExceptionDeclaration);

export function decodeExceptions(value: unknown): Promise<Decoded<readonly ExceptionDeclaration[]>> {
	return decodeWith(ExceptionDeclarations, value);
}
