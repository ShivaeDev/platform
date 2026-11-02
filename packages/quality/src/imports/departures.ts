import { Effect } from "effect";
import { ImportCompiler } from "#adapters/ImportCompiler.ts";
import type { RuleInputs } from "#rule.ts";
import type { SpecifierSite } from "./specifiers.ts";

export interface Departure extends SpecifierSite {
	readonly file: string;
	readonly installed: string | undefined;
	readonly workspace: string | undefined;
}

export const departures = Effect.fn("Imports.departures")(function* (inputs: RuleInputs) {
	const compiler = yield* ImportCompiler;
	return yield* compiler.departures(inputs);
}, Effect.provide(ImportCompiler.layer));
