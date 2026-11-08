import { Effect } from "effect";
import { ImportCompiler } from "#adapters/import-compiler/service.ts";
import type { SpecifierSite } from "#imports/specifiers.ts";
import { workspacePackages } from "#imports/workspace.ts";
import type { RuleInputs } from "#rule.ts";

export interface Departure extends SpecifierSite {
	readonly file: string;
	readonly installed: string | undefined;
	readonly workspace: string | undefined;
}

export const departures = Effect.fn("Imports.departures")(function* (inputs: RuleInputs) {
	const packages = yield* workspacePackages(inputs);
	const compiler = yield* ImportCompiler;
	return yield* compiler.departures(inputs, packages);
}, Effect.provide(ImportCompiler.layer));
