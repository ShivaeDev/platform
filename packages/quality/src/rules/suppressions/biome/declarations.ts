import { Schema } from "effect";
import { type Decoded, decodeWith } from "#decoded.ts";

export const Declaration = Schema.Struct({
	includes: Schema.NonEmptyArray(Schema.NonEmptyString),
	reason: Schema.String.check(Schema.isPattern(/\S/u, { expected: "a reason that says why the scope needs the rule weakened" })),
	rule: Schema.NonEmptyString,
});

export type Declaration = typeof Declaration.Type;

export const PRESET_DECLARATIONS = "declarations.json";

const ShippedDeclarations = Schema.fromJsonString(Schema.Array(Declaration));

export function decodeShipped(text: string | undefined): Promise<Decoded<readonly Declaration[]>> {
	return text === undefined ? Promise.resolve({ _tag: "Valid", value: [] }) : decodeWith(ShippedDeclarations, text);
}

export interface Scoped {
	readonly includes: readonly string[];
	readonly rule: string;
}

function sameScope(left: readonly string[], right: readonly string[]): boolean {
	return new Set(left).size === new Set(right).size && left.every((glob) => right.includes(glob));
}

export function matches(declaration: Scoped, weakening: Scoped): boolean {
	return declaration.rule === weakening.rule && sameScope(declaration.includes, weakening.includes);
}

export function scoped(base: string, glob: string): string {
	const { negation = "", path = glob } = /^(?<negation>!*)(?<path>.*)$/u.exec(glob)?.groups ?? {};
	return base === "" ? glob : `${negation}${base}/${path}`;
}

export function scopeText(includes: readonly string[]): string {
	return includes.map((glob) => `"${glob}"`).join(", ");
}
