import { Schema } from "effect";
import { type Decoded, decodeWith } from "../../../decoded.ts";

export const Declaration = Schema.Struct({
	includes: Schema.NonEmptyArray(Schema.NonEmptyString),
	reason: Schema.String.check(Schema.isPattern(/\S/, { expected: "a reason that says why the scope needs the rule weakened" })),
	rule: Schema.NonEmptyString,
});

export type Declaration = typeof Declaration.Type;

export const PRESET_DECLARATIONS = "declarations.json";

const shipped = Schema.toStandardSchemaV1(Schema.fromJsonString(Schema.Array(Declaration)), {
	parseOptions: { errors: "all", onExcessProperty: "error" },
});

export const decodeShipped = (text: string | undefined): Promise<Decoded<ReadonlyArray<Declaration>>> =>
	text === undefined ? Promise.resolve({ _tag: "Valid", value: [] }) : decodeWith(shipped, text);

export interface Scoped {
	readonly includes: ReadonlyArray<string>;
	readonly rule: string;
}

const sameScope = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean =>
	new Set(left).size === new Set(right).size && left.every((glob) => right.includes(glob));

export const matches = (declaration: Scoped, weakening: Scoped): boolean =>
	declaration.rule === weakening.rule && sameScope(declaration.includes, weakening.includes);

export const scoped = (base: string, glob: string): string => {
	const [, negation = "", path = glob] = /^(!*)(.*)$/.exec(glob) ?? [];
	return base === "" ? glob : `${negation}${base}/${path}`;
};

export const scopeText = (includes: ReadonlyArray<string>): string => includes.map((glob) => `"${glob}"`).join(", ");
